# Multi-Key Deduplication (OTLP source)

Multi-key deduplication is supported for **OTLP source pipelines only**. Kafka source pipelines validate `id_field` against the registered schema fields, so composite key expressions are not supported there.

For OTLP pipelines, `routing.field.name` is passed directly to gjson, which supports [multipath expressions](https://github.com/tidwall/gjson#multipaths). This lets you deduplicate on a combination of fields.

## Single-field dedup

```json
{
  "routing": {
    "type": "field",
    "field": { "name": "trace_id" }
  }
}
```

## Multi-field dedup — array multipath syntax

Use gjson array multipath syntax to build a composite dedup key from multiple fields:

```json
{
  "routing": {
    "type": "field",
    "field": { "name": "[trace_id,span_id]" }
  }
}
```

For a message containing `trace_id: "abc"` and `span_id: "xyz"` this produces `Nats-Msg-Id: ["abc","xyz"]`. Mixed types work — strings are quoted, numbers are not:

```json
{
  "routing": {
    "type": "field",
    "field": { "name": "[user_id,sequence_number]" }
  }
}
```

Produces `Nats-Msg-Id: ["u1",42]` for `user_id: "u1"` and `sequence_number: 42`.

## Warning: do not use object multipath syntax

gjson also supports `{"a":field1,"b":field2}` but this is **not safe for deduplication**. The output key order follows the order of fields in the query string, so two differently-configured instances produce different `Nats-Msg-Id` values for identical messages, causing duplicates to slip through silently.

Always use `[field1,field2,...]` — never `{...}`.
