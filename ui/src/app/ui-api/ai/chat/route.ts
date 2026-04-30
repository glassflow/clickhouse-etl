// Streaming chat route — POST /ui-api/ai/chat
//
// Accepts `{ pipelineId | null, messages: ChatMessage[], modelId? }`,
// invokes Anthropic with `stream: true` + tool definitions, and emits a
// stream of SSE-framed `StreamEvent`s. When the model returns a `tool_use`
// block the server dispatches it against the matching `/ui-api/ai/tools/*`
// route, sends a `tool_call_result` event, and continues the conversation
// until `stop_reason !== 'tool_use'`.

import Anthropic from '@anthropic-ai/sdk'
import type {
  MessageParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlock,
  TextDelta,
  ContentBlock,
} from '@anthropic-ai/sdk/resources/messages'
import { encodeEvent } from '@/src/modules/ai/streaming'
import type { ChatMessage, ToolCallKind, StreamEvent } from '@/src/modules/ai/types'

// Tool catalogue advertised to the model. The names are snake_case (Anthropic
// convention); we map them to dotted internal kinds for the drawer cards.
const TOOL_DEFINITIONS: Tool[] = [
  {
    name: 'library_search',
    description:
      "Search the user's saved Library resources (connections, schemas, transforms) by name.",
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Substring to match against resource names.',
        },
        kinds: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['schema', 'transform', 'kafka_connection', 'clickhouse_connection'],
          },
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'pipeline_draft',
    description:
      'Create a draft pipeline that the user can open in Canvas. Does NOT deploy.',
    input_schema: {
      type: 'object',
      properties: {
        config: { type: 'object' },
        references: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              resourceKind: {
                type: 'string',
                enum: [
                  'kafka_connection',
                  'clickhouse_connection',
                  'schema',
                  'transform',
                ],
              },
              resourceId: { type: 'string' },
              pinnedVersion: { type: 'string' },
            },
            required: ['resourceKind', 'resourceId'],
          },
        },
      },
      required: ['config'],
    },
  },
  {
    name: 'validate',
    description: 'Validate a pipeline graph (nodes + edges + configs).',
    input_schema: {
      type: 'object',
      properties: {
        nodes: { type: 'array' },
        edges: { type: 'array' },
        configs: { type: 'object' },
      },
      required: ['nodes', 'edges', 'configs'],
    },
  },
]

const SYSTEM_PROMPT = `You are GlassFlow's AI assistant. You help users build streaming pipelines (Kafka or OTLP -> transforms -> ClickHouse).

Rules:
- Always read the user's saved Library before suggesting new resources. Use library_search.
- When proposing a complete pipeline, use pipeline_draft. Don't deploy it -- the user reviews in Canvas.
- For graph validation, call validate.
- Reference Library resources by ID + version, not by name alone.
- Keep replies concise. Defer to tool calls for structured output.`

// snake_case -> internal dotted kind that matches `ToolCallKind` and the
// drawer card dispatch in `ToolCallCard.tsx`.
function anthroToolToInternal(name: string): ToolCallKind {
  if (name === 'library_search') return 'library.search'
  if (name === 'pipeline_draft') return 'pipeline.draft'
  return 'validate'
}

// snake_case -> URL slug (`library_search` -> `library-search`).
function toolNameToSlug(name: string): string {
  return name.replace(/_/g, '-')
}

/**
 * Convert our drawer `ChatMessage[]` to the Anthropic Messages API format.
 * Tool-call blocks recorded on assistant messages are NOT replayed (they
 * carry a `tool_use_id` that the API would reject mid-conversation); we
 * collapse to text. New tool calls are issued by the model on each turn.
 */
function toAnthropicMessages(messages: ChatMessage[]): MessageParam[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const text = m.blocks
        .filter((b): b is { kind: 'text'; text: string } => b.kind === 'text')
        .map((b) => b.text)
        .join('\n')
      return {
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: text,
      }
    })
    // Drop empty assistant placeholders (the drawer pre-creates an empty
    // assistant message before the stream starts streaming back).
    .filter((m) => typeof m.content !== 'string' || m.content.length > 0)
}

export async function POST(req: Request): Promise<Response> {
  let body: {
    pipelineId: string | null
    messages: ChatMessage[]
    modelId?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(`data: ${JSON.stringify({ type: 'error', message: 'invalid JSON body' })}\n\n`, {
      headers: { 'content-type': 'text/event-stream' },
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const err: StreamEvent = {
      type: 'error',
      message: 'ANTHROPIC_API_KEY not configured',
    }
    return new Response(encodeEvent(err), {
      headers: { 'content-type': 'text/event-stream' },
    })
  }

  const client = new Anthropic({ apiKey })
  const messageId = `msg-${Date.now()}`
  const requestUrl = req.url

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) =>
        controller.enqueue(encoder.encode(encodeEvent(event)))

      try {
        send({ type: 'message_start', messageId })

        let totalTokens = 0
        let currentTurnMessages: MessageParam[] = toAnthropicMessages(body.messages)

        // Tool-use loop. Continues until the model returns a non-tool-use
        // stop reason. Bounded by Anthropic's own max-token + max-turn rules.
        for (;;) {
          const turn = client.messages.stream({
            model: body.modelId ?? 'claude-haiku-4-5',
            max_tokens: 4096,
            system:
              SYSTEM_PROMPT +
              (body.pipelineId
                ? `\n\nCurrent pipeline: ${body.pipelineId}`
                : '\n\nNo current pipeline (drafting new).'),
            tools: TOOL_DEFINITIONS,
            messages: currentTurnMessages,
          })

          const toolUses: Array<ToolUseBlock> = []

          for await (const event of turn) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const delta = event.delta as TextDelta
              send({ type: 'text_delta', messageId, delta: delta.text })
            }
            if (
              event.type === 'content_block_start' &&
              event.content_block.type === 'tool_use'
            ) {
              const tu = event.content_block as ToolUseBlock
              toolUses.push(tu)
              send({
                type: 'tool_call_start',
                messageId,
                callId: tu.id,
                tool: anthroToolToInternal(tu.name),
                // `input` may be partial here; the SDK's `inputJsonDelta`
                // events fill it in. We re-read the final input from
                // `finalMessage()` below before dispatch.
                input: (tu.input as Record<string, unknown>) ?? {},
              })
            }
          }

          const finalMsg = await turn.finalMessage()
          totalTokens += finalMsg.usage.input_tokens + finalMsg.usage.output_tokens

          // Refresh tool-uses with their final, fully-streamed inputs.
          const finalToolUses: ToolUseBlock[] = finalMsg.content.filter(
            (b): b is ToolUseBlock => b.type === 'tool_use',
          )

          if (finalMsg.stop_reason !== 'tool_use' || finalToolUses.length === 0) {
            send({ type: 'message_stop', messageId, tokensUsed: totalTokens })
            controller.close()
            return
          }

          // Dispatch every tool call against the matching internal endpoint
          // and stream a `tool_call_result` per call. We use `new URL` to
          // resolve relative paths against the incoming request origin —
          // this works in dev (localhost:any-port) and in prod.
          const toolResults: ToolResultBlockParam[] = await Promise.all(
            finalToolUses.map(async (tu) => {
              const slug = toolNameToSlug(tu.name)
              const url = new URL(`/ui-api/ai/tools/${slug}`, requestUrl).toString()
              try {
                const res = await fetch(url, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(tu.input ?? {}),
                })
                const json = res.ok
                  ? await res.json()
                  : { error: `HTTP ${res.status}` }
                send({
                  type: 'tool_call_result',
                  messageId,
                  callId: tu.id,
                  output: json,
                  status: res.ok ? 'success' : 'error',
                  errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
                })
                return {
                  type: 'tool_result' as const,
                  tool_use_id: tu.id,
                  content: JSON.stringify(json),
                }
              } catch (err) {
                const message = err instanceof Error ? err.message : 'tool failed'
                send({
                  type: 'tool_call_result',
                  messageId,
                  callId: tu.id,
                  output: null,
                  status: 'error',
                  errorMessage: message,
                })
                return {
                  type: 'tool_result' as const,
                  tool_use_id: tu.id,
                  content: message,
                  is_error: true,
                }
              }
            }),
          )

          // Replay assistant content (text + tool_use blocks) and the
          // user-side tool_result blocks so the next turn has full context.
          currentTurnMessages = [
            ...currentTurnMessages,
            { role: 'assistant', content: finalMsg.content as ContentBlock[] },
            { role: 'user', content: toolResults },
          ]
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'stream failed'
        send({ type: 'error', message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
