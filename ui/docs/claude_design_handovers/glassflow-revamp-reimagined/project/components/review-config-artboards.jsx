// T-12 Review-generated-config — 4 artboards
// 1: Default (4 checks, ready to commit)
// 2: With warnings (sink lacks idempotency, AI offers fix)
// 3: Inline edit mode (chat-to-edit applied to a field)
// 4: Source = Schema evolution handoff (different prompt, same surface)

// Shared YAML lines for an "orders → ClickHouse with dedup" config
const RC_YAML_LINES = [
  { ln: 1, t: 'pipeline:' },
  { ln: 2, t: '  name: orders-dedup-clickhouse', cls: 'add' },
  { ln: 3, t: '  owner: alex@glassflow.dev', cls: 'add' },
  { ln: 4, t: '  env: prod', cls: 'add', annot: 'INFERRED' },
  { ln: 5, t: '' },
  { ln: 6, t: 'source:' },
  { ln: 7, t: '  type: kafka', cls: 'add' },
  { ln: 8, t: '  bootstrap: kafka.prod.glassflow.dev:9092', cls: 'add' },
  { ln: 9, t: '  topic: orders.events', cls: 'add' },
  { ln:10, t: '  group_id: gf-orders-dedup', cls: 'add', annot: 'NAMED' },
  { ln:11, t: '  start_offset: latest', cls: 'add' },
  { ln:12, t: '' },
  { ln:13, t: 'transforms:' },
  { ln:14, t: '  - dedup:', cls: 'add' },
  { ln:15, t: '      key: [order_id]', cls: 'add' },
  { ln:16, t: '      window: 10m', cls: 'add', annot: 'FROM PROMPT' },
  { ln:17, t: '      strategy: first_wins', cls: 'add' },
  { ln:18, t: '' },
  { ln:19, t: 'sink:' },
  { ln:20, t: '  type: clickhouse', cls: 'add' },
  { ln:21, t: '  host: ch-prod.glassflow.dev', cls: 'add' },
  { ln:22, t: '  database: events', cls: 'add' },
  { ln:23, t: '  table: orders_dedup', cls: 'add' },
  { ln:24, t: '  on_dup: replace', cls: 'add' },
  { ln:25, t: '  batch_size: 1000', cls: 'add' },
  { ln:26, t: '' },
  { ln:27, t: 'observability:' },
  { ln:28, t: '  dlq: orders.dlq', cls: 'add' },
  { ln:29, t: '  alert: dlq_rate > 1%', cls: 'add' },
];

const renderYaml = (lines, highlights = {}) => lines.map((l, i) => {
  // syntax-color the line crudely
  let html = l.t;
  // key:value
  html = html.replace(/^(\s*-?\s*)([a-z_][\w-]*)(:)/i, '$1<span class="rc-key">$2</span>$3');
  // strings
  html = html.replace(/(:\s*)([a-z][\w.\-:/@]+)$/i, '$1<span class="rc-str">$2</span>');
  // numbers + windows
  html = html.replace(/\b(\d+(?:[hms]|min)?)\b/g, '<span class="rc-num">$1</span>');
  // bracketed array values
  html = html.replace(/(\[[^\]]+\])/g, '<span class="rc-anchor">$1</span>');

  const overrideCls = highlights[l.ln] || l.cls || '';
  return (
    <span key={i} className={`rc-line ${overrideCls}`}>
      <span className="rc-ln">{l.ln}</span>
      <span dangerouslySetInnerHTML={{__html: html || '\u00A0'}}/>
      {l.annot && <span className="rc-annot"><Icon name="sparkles" size={8}/>{l.annot}</span>}
    </span>
  );
});

const RCSourcePanel = ({ prompt, clarify, steps }) => (
  <div className="rc-panel">
    <div className="rc-panel-head">
      <Icon name="sparkles" size={12} color="var(--color-orange-300)"/>
      AI source · what was asked
    </div>
    <div className="rc-panel-body">
      {prompt && (
        <div className="rc-prompt">
          <div className="role"><span className="av">YO</span>You · 14:21</div>
          {prompt}
          {clarify && <div className="clarify">→ {clarify}</div>}
        </div>
      )}
      <div style={{fontSize:10.5, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', margin:'4px 0 8px'}}>
        Reasoning · 4 inferences
      </div>
      {steps.map((s, i) => (
        <div key={i} className="rc-step">
          <div className="num">{i+1}</div>
          <div className="body" dangerouslySetInnerHTML={{__html: s}}/>
        </div>
      ))}
    </div>
  </div>
);

const RCYamlPanel = ({ activeTab = 'config', highlights, sample }) => (
  <div className="rc-panel">
    <div className="rc-panel-head" style={{padding:0, borderBottom:0, background:'transparent'}}>
      <div className="rc-yaml-tabs" style={{flex:1}}>
        <span className={`rc-yaml-tab ${activeTab==='config'?'is-active':''}`}>pipeline.yaml <span className="ct">29 lines</span></span>
        <span className={`rc-yaml-tab ${activeTab==='dryrun'?'is-active':''}`}>dry-run output</span>
        <span className={`rc-yaml-tab ${activeTab==='diff'?'is-active':''}`}>vs template</span>
        <span style={{flex:1}}/>
        <span className="rc-yaml-tab" style={{cursor:'pointer'}}>
          <Icon name="copy" size={10}/>copy
        </span>
        <span className="rc-yaml-tab" style={{cursor:'pointer'}}>
          <Icon name="edit" size={10}/>edit raw
        </span>
      </div>
    </div>
    <div className="rc-yaml" style={{flex:1}}>
      {renderYaml(RC_YAML_LINES, highlights || {})}
    </div>
    {sample && (
      <div className="rc-sample">
        <div className="head">
          <Icon name="play" size={9} color="var(--color-orange-300)"/>
          Sample · 3 events from <b style={{color:'var(--color-foreground-neutral)'}}>orders.events</b> · what they'll look like in <b style={{color:'var(--color-foreground-neutral)'}}>orders_dedup</b>
        </div>
        <table>
          <thead>
            <tr><th>order_id</th><th>customer_id</th><th>amount</th><th>currency</th><th>created_at</th></tr>
          </thead>
          <tbody>
            <tr><td>ord_8a91b…</td><td>cust_4012</td><td>49.50</td><td>USD</td><td>2026-05-05T12:21:18Z</td></tr>
            <tr><td>ord_8a91c…</td><td>cust_4012</td><td>129.00</td><td>USD</td><td>2026-05-05T12:21:24Z</td></tr>
            <tr><td>ord_8a91d…</td><td>cust_8841</td><td>14.20</td><td>EUR</td><td>2026-05-05T12:21:31Z</td></tr>
          </tbody>
        </table>
      </div>
    )}
    <div className="rc-chat">
      <Icon name="sparkles" size={12} color="var(--color-orange-300)"/>
      <div className="field">Refine: <span style={{color:'var(--color-gray-dark-500)'}}>"make the dedup window 5 minutes" or "add a filter for amount &gt; 0"</span><span className="cur"/></div>
      <button className="btn btn-secondary" style={{fontSize:11, padding:'5px 10px'}}>Apply</button>
    </div>
  </div>
);

const RCChecklistPanel = ({ items, dryrun, footer }) => (
  <div className="rc-panel">
    <div className="rc-panel-head">
      <Icon name="check" size={12} color="var(--color-green-500)"/>
      Pre-flight checks
      <span className="sub">{items.filter(i=>i.tone==='ok').length}/{items.length} passing</span>
    </div>
    <div className="rc-panel-body">
      {dryrun && (
        <div className="rc-dryrun">
          <h5><Icon name="play" size={10} color="var(--color-orange-300)"/>Dry-run · 1,000 events from sample</h5>
          {dryrun.map((r, i) => (
            <div key={i} className="row">
              <span>{r.k}</span>
              <span className={`v ${r.cls||''}`}>{r.v}</span>
            </div>
          ))}
        </div>
      )}
      {items.map((it, i) => (
        <div key={i} className={`rc-check-item is-${it.tone}`}>
          <div className="box"/>
          <div className="body">
            <b>{it.title}</b>
            {it.detail}
            {it.det && <span className="det">{it.det}</span>}
            {it.fix && <span className="fix"><Icon name="sparkles" size={9}/>{it.fix}</span>}
          </div>
        </div>
      ))}
      {footer}
    </div>
  </div>
);

// =====================================================================
// ARTBOARD 1 · Default (clean, ready to commit)
// =====================================================================

const ArtRCDefault = () => (
  <div className="rc-page">
    <AppShell activeNav="ai">
      <div className="rc-inner">
        <div className="rc-titlerow">
          <span className="crumb">AI / Sessions / <b>orders-dedup-clickhouse</b></span>
          <h1 style={{marginLeft:8}}>Review generated config</h1>
          <span className="src-pill"><Icon name="sparkles" size={10}/>From AI chat · session #4128</span>
          <div className="spacer"/>
          <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>generated 14:21:08 · 1.4s</span>
        </div>

        <div className="rc-trust">
          <div className="ic"><Icon name="info" size={14}/></div>
          <div className="body">
            AI drafted this config from your prompt + the <b>kafka-clickhouse-dedup</b> template. <b>Nothing has been deployed.</b> Review the YAML, run the pre-flight checks, and commit when you're ready.
          </div>
          <span className="meta">model · gf-config-haiku · v3</span>
        </div>

        <div className="rc-grid">
          <RCSourcePanel
            prompt={<>"dedup orders by <em>order_id</em> for <em>10 min</em> and write to ClickHouse <em>events.orders_dedup</em>"</>}
            steps={[
              "Picked the <b>kafka-clickhouse-dedup</b> Library template — closest match for source + sink + dedup.",
              "Reused the existing <b>orders.events</b> source binding (you have 6 pipelines on it).",
              "Set <code>group_id</code> to <code>gf-orders-dedup</code> so this consumer is independent.",
              "Wrote to <b>events.orders_dedup</b>. Table doesn't exist yet — checked below.",
            ]}
          />

          <RCYamlPanel
            sample
            highlights={{ 16: 'edit', 10: 'edit' }}
          />

          <RCChecklistPanel
            dryrun={[
              { k: 'parse rate',     v: '100.0%', cls: 'ok' },
              { k: 'dedup ratio',    v: '34.2% removed', cls: 'ok' },
              { k: 'sample throughput', v: '~9.8k msg/s' },
              { k: 'projected DLQ',  v: '0 events', cls: 'ok' },
            ]}
            items={[
              { tone: 'ok', title: 'Source connection', detail: 'kafka.prod.glassflow.dev:9092 reachable, topic exists, ACL grants read.', det: 'verified · 0.4s' },
              { tone: 'ok', title: 'Schema compatible', detail: 'Sample events parse cleanly against expected fields (order_id, customer_id, amount, currency, created_at).', det: 'orders.events · v3 · 1,000 events tested' },
              { tone: 'ok', title: 'Sink writable', detail: 'ClickHouse user has CREATE TABLE on events.', det: 'will create orders_dedup with inferred schema' },
              { tone: 'ok', title: 'No naming collision', detail: 'No pipeline named orders-dedup-clickhouse in this workspace.', det: 'safe to commit' },
            ]}
            footer={
              <div style={{marginTop:14, padding:'10px 12px', background:'#0c0c10', border:'1px dashed var(--color-gray-dark-800)', borderRadius:8, fontSize:11, color:'var(--color-gray-dark-500)', lineHeight:1.5}}>
                <Icon name="info" size={10}/> After commit, this config goes through your team's standard review — <b style={{color:'var(--color-foreground-neutral)'}}>2 approvers required</b> before it deploys to prod.
              </div>
            }
          />
        </div>

        <div className="rc-actionbar">
          <div className="stat ok">
            <b>4/4</b>
            <span>checks passing</span>
          </div>
          <div className="sep"/>
          <div className="stat">
            <b>+29 / −0</b>
            <span>lines</span>
          </div>
          <div className="sep"/>
          <div className="stat">
            <b>~38s</b>
            <span>est. deploy time</span>
          </div>
          <div className="actions">
            <button className="btn btn-secondary" style={{fontSize:12}}>Save as draft</button>
            <button className="btn btn-secondary" style={{fontSize:12}}><Icon name="play" size={11}/>Dry-run again</button>
            <button className="btn btn-secondary" style={{fontSize:12}}><Icon name="canvas" size={11}/>Open in Canvas editor</button>
            <button className="btn btn-primary" style={{fontSize:12, padding:'8px 16px'}}>
              <Icon name="check" size={11}/>Commit pipeline → request review
            </button>
          </div>
        </div>

        <Annot>
          T-12 default. Three columns map to the three things a reviewer asks: <b>why did the AI write this?</b>
          (left), <b>what does it say?</b> (middle), <b>is it safe?</b> (right). The trust banner is the
          critical anchor — never let an AI surface land without a clear "nothing has been deployed yet" line.
        </Annot>
      </div>
    </AppShell>
  </div>
);

// =====================================================================
// ARTBOARD 2 · Warnings · sink lacks idempotency, AI offers fix
// =====================================================================

const ArtRCWarn = () => (
  <div className="rc-page">
    <AppShell activeNav="ai">
      <div className="rc-inner">
        <div className="rc-titlerow">
          <span className="crumb">AI / Sessions / <b>orders-dedup-clickhouse</b></span>
          <h1 style={{marginLeft:8}}>Review generated config</h1>
          <span className="src-pill"><Icon name="sparkles" size={10}/>From AI chat · session #4128</span>
          <div className="spacer"/>
          <span style={{fontSize:11, color:'var(--color-yellow-400)', fontFamily:'JetBrains Mono, monospace'}}>2 warnings</span>
        </div>

        <div className="rc-trust" style={{borderColor:'color-mix(in srgb, var(--color-yellow-400) 30%, transparent)', background:'linear-gradient(90deg, color-mix(in srgb, var(--color-yellow-400) 8%, transparent), transparent)'}}>
          <div className="ic" style={{background:'color-mix(in srgb, var(--color-yellow-400) 10%, transparent)', color:'var(--color-yellow-400)'}}><Icon name="warning" size={14}/></div>
          <div className="body">
            Pre-flight found <b>2 issues you should fix before commit</b>. AI suggested patches for both — review and accept individually, or apply all.
          </div>
          <button className="btn btn-secondary" style={{fontSize:11.5}}>
            <Icon name="sparkles" size={11}/>Apply all suggestions
          </button>
        </div>

        <div className="rc-grid">
          <RCSourcePanel
            prompt={<>"dedup orders by <em>order_id</em> for <em>10 min</em> and write to ClickHouse <em>events.orders_dedup</em>"</>}
            steps={[
              "Picked the <b>kafka-clickhouse-dedup</b> Library template — closest match for source + sink + dedup.",
              "Reused the existing <b>orders.events</b> source binding (you have 6 pipelines on it).",
              "Set <code>group_id</code> to <code>gf-orders-dedup</code> so this consumer is independent.",
              "<b>Heads up:</b> sink table lacks a unique key — flagged below.",
            ]}
          />

          <RCYamlPanel
            sample
            highlights={{ 24: 'edit', 25: 'edit' }}
          />

          <RCChecklistPanel
            dryrun={[
              { k: 'parse rate',     v: '100.0%', cls: 'ok' },
              { k: 'dedup ratio',    v: '34.2% removed', cls: 'ok' },
              { k: 'sample throughput', v: '~9.8k msg/s' },
              { k: 'projected DLQ',  v: '0 events', cls: 'ok' },
            ]}
            items={[
              { tone: 'ok', title: 'Source connection', detail: 'kafka.prod.glassflow.dev:9092 reachable, ACL grants read.', det: 'verified · 0.4s' },
              { tone: 'ok', title: 'Schema compatible', detail: 'Sample events parse cleanly against expected fields.', det: 'orders.events · v3 · 1,000 tested' },
              {
                tone: 'warn',
                title: 'Sink lacks idempotency guard',
                detail: <>ClickHouse table <code>orders_dedup</code> has no unique key — re-replays will create duplicates downstream.</>,
                det: 'on_dup: replace requires ORDER BY (order_id) on the table',
                fix: 'AI fix · add ORDER BY (order_id) + ReplacingMergeTree',
              },
              {
                tone: 'warn',
                title: 'Batch size larger than recommended',
                detail: <>1000 events/batch is fine for steady load, but spikes can blow your CH ingest budget for this user.</>,
                det: 'p99 = 14k msg/s; 250 is safer',
                fix: 'AI fix · drop to batch_size: 250',
              },
            ]}
          />
        </div>

        <div className="rc-actionbar">
          <div className="stat warn">
            <b>2/4</b>
            <span>warnings unresolved</span>
          </div>
          <div className="sep"/>
          <div className="stat">
            <b>+29 / −0</b>
            <span>lines</span>
          </div>
          <div className="actions">
            <button className="btn btn-secondary" style={{fontSize:12}}>Save as draft</button>
            <button className="btn btn-secondary" style={{fontSize:12, opacity:0.5}} disabled>
              <Icon name="check" size={11}/>Commit (resolve warnings first)
            </button>
            <button className="btn btn-secondary" style={{fontSize:12, borderColor:'color-mix(in srgb, var(--color-yellow-400) 30%, transparent)', color:'var(--color-yellow-400)'}}>
              Commit anyway →
            </button>
            <button className="btn btn-primary" style={{fontSize:12, padding:'8px 14px'}}>
              <Icon name="sparkles" size={11}/>Apply all 2 fixes
            </button>
          </div>
        </div>

        <Annot>
          T-12 warnings state. Two-button commit pattern: the safe path is greyed but reachable, the
          override is explicitly named "Commit anyway" (not "Force"). AI fixes are atomic — accepting a
          fix re-runs pre-flight and updates the YAML diff highlights.
        </Annot>
      </div>
    </AppShell>
  </div>
);

// =====================================================================
// ARTBOARD 3 · Inline edit-in-place via chat refinement
// =====================================================================

const ArtRCEdit = () => (
  <div className="rc-page">
    <AppShell activeNav="ai">
      <div className="rc-inner">
        <div className="rc-titlerow">
          <span className="crumb">AI / Sessions / <b>orders-dedup-clickhouse</b></span>
          <h1 style={{marginLeft:8}}>Review generated config</h1>
          <span className="src-pill"><Icon name="sparkles" size={10}/>2 refinements applied</span>
          <div className="spacer"/>
          <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>last edit · 14:24:12</span>
        </div>

        <div className="rc-trust">
          <div className="ic"><Icon name="info" size={14}/></div>
          <div className="body">
            <b>2 chat refinements</b> applied since the initial draft. Hover any orange-highlighted line to see what changed and why; click <b>edit raw</b> to drop into the YAML editor.
          </div>
          <span className="meta">v3 of draft · 4 messages</span>
        </div>

        <div className="rc-grid">
          <div className="rc-panel">
            <div className="rc-panel-head">
              <Icon name="sparkles" size={12} color="var(--color-orange-300)"/>
              Refinement history
            </div>
            <div className="rc-panel-body">
              <div className="rc-prompt">
                <div className="role"><span className="av">YO</span>You · 14:21</div>
                "dedup orders by <em>order_id</em> for <em>10 min</em> and write to ClickHouse"
              </div>
              <div className="rc-prompt" style={{borderColor:'var(--color-orange-alpha-20)'}}>
                <div className="role" style={{color:'var(--color-orange-300)'}}><span className="av" style={{background:'var(--color-orange-alpha-20)', color:'var(--color-orange-300)'}}>AI</span>AI · 14:21</div>
                Drafted config using <b>kafka-clickhouse-dedup</b> template. 4 inferences made.
              </div>
              <div className="rc-prompt">
                <div className="role"><span className="av">YO</span>You · 14:23</div>
                "make the dedup window <em>5 min</em> not 10"
                <div className="clarify">→ AI updated <b>line 16</b> · window: 5m</div>
              </div>
              <div className="rc-prompt">
                <div className="role"><span className="av">YO</span>You · 14:24</div>
                "rename the consumer group to <em>checkout-dedup-v2</em>"
                <div className="clarify">→ AI updated <b>line 10</b> · group_id: checkout-dedup-v2</div>
              </div>
              <div style={{padding:'10px', background:'#0c0c10', border:'1px dashed var(--color-gray-dark-800)', borderRadius:8, fontSize:11, color:'var(--color-gray-dark-500)', lineHeight:1.5, marginTop:6}}>
                <Icon name="info" size={10}/> Every refinement keeps the diff narrow — only the lines you asked about change. Use <b style={{color:'var(--color-foreground-neutral)'}}>edit raw</b> if you need to touch fields the AI hasn't.
              </div>
            </div>
          </div>

          <RCYamlPanel
            sample
            highlights={{ 10: 'edit', 16: 'edit' }}
          />

          <RCChecklistPanel
            dryrun={[
              { k: 'parse rate',     v: '100.0%', cls: 'ok' },
              { k: 'dedup ratio',    v: '21.8% removed (was 34.2%)', cls: 'warn' },
              { k: 'sample throughput', v: '~9.8k msg/s' },
              { k: 'projected DLQ',  v: '0 events', cls: 'ok' },
            ]}
            items={[
              { tone: 'ok', title: 'Source connection', detail: 'kafka.prod.glassflow.dev:9092 reachable, ACL grants read.', det: 'verified' },
              { tone: 'ok', title: 'Schema compatible', detail: 'Sample events parse cleanly.', det: 'orders.events · v3' },
              { tone: 'ok', title: 'Sink writable', detail: 'ClickHouse user has CREATE TABLE.', det: 'will create orders_dedup' },
              { tone: 'ok', title: 'No naming collision', detail: 'consumer group checkout-dedup-v2 is free.', det: 're-checked after rename' },
              {
                tone: 'warn',
                title: '5-min window catches less duplication',
                detail: 'Sample shows 12.4% fewer dups removed at 5m vs 10m. Confirm this is what you want.',
                det: 'historical replays in the last 7d had ~80% of dup-pairs within 4m',
                fix: 'AI · run 7-day backfill comparison',
              },
            ]}
          />
        </div>

        <div className="rc-actionbar">
          <div className="stat ok">
            <b>4/5</b>
            <span>checks · 1 advisory</span>
          </div>
          <div className="sep"/>
          <div className="stat">
            <b>+29 / −2</b>
            <span>lines (after edits)</span>
          </div>
          <div className="actions">
            <button className="btn btn-secondary" style={{fontSize:12}}><Icon name="undo" size={11}/>Revert last edit</button>
            <button className="btn btn-secondary" style={{fontSize:12}}>Save as draft</button>
            <button className="btn btn-primary" style={{fontSize:12, padding:'8px 16px'}}>
              <Icon name="check" size={11}/>Commit pipeline → request review
            </button>
          </div>
        </div>

        <Annot>
          T-12 edit mode. Chat-to-edit keeps the diff narrow — refinements only touch the line(s)
          asked about, with the prior YAML preserved untouched. The dry-run column re-runs after every
          edit so users see consequences (here: a smaller dedup window catches less duplication, surfaced
          as advisory not a block).
        </Annot>
      </div>
    </AppShell>
  </div>
);

// =====================================================================
// ARTBOARD 4 · Schema evolution handoff (different prompt source)
// =====================================================================

const RC_YAML_LINES_SE = [
  { ln: 1, t: 'pipeline:' },
  { ln: 2, t: '  name: orders-enrich-checkout', cls: 'edit' },
  { ln: 3, t: '  version: 4' , cls: 'add', annot: 'WAS v3' },
  { ln: 4, t: '  owner: alex@glassflow.dev' },
  { ln: 5, t: '' },
  { ln: 6, t: 'source:' },
  { ln: 7, t: '  topic: orders.events' },
  { ln: 8, t: '  schema: orders.events.v4', cls: 'edit' },
  { ln: 9, t: '' },
  { ln:10, t: 'transforms:' },
  { ln:11, t: '  - alias:', cls: 'add' },
  { ln:12, t: '      total_amount: legacy_total', cls: 'add', annot: 'BACKWARDS COMPAT' },
  { ln:13, t: '  - cast:', cls: 'add' },
  { ln:14, t: '      total_amount: decimal(12,2)', cls: 'add' },
  { ln:15, t: '      on_fail: parse_or_dlq', cls: 'add', annot: 'DEFENSIVE' },
  { ln:16, t: '  - fill_default:', cls: 'add' },
  { ln:17, t: '      currency: USD', cls: 'add' },
  { ln:18, t: '' },
  { ln:19, t: 'sink:' },
  { ln:20, t: '  type: clickhouse' },
  { ln:21, t: '  table: orders_enriched' },
  { ln:22, t: '' },
  { ln:23, t: 'rollback:', cls: 'add' },
  { ln:24, t: '  trigger: dlq_rate > 0.5%', cls: 'add', annot: 'AUTO' },
  { ln:25, t: '  to_version: 3', cls: 'add' },
];

const renderYamlSE = (lines) => lines.map((l, i) => {
  let html = l.t;
  html = html.replace(/^(\s*-?\s*)([a-z_][\w-]*)(:)/i, '$1<span class="rc-key">$2</span>$3');
  html = html.replace(/(:\s*)([a-z][\w.\-:/@(),]+)$/i, '$1<span class="rc-str">$2</span>');
  html = html.replace(/\b(\d+(?:\.\d+)?[%hms]?)\b/g, '<span class="rc-num">$1</span>');
  return (
    <span key={i} className={`rc-line ${l.cls||''}`}>
      <span className="rc-ln">{l.ln}</span>
      <span dangerouslySetInnerHTML={{__html: html || '\u00A0'}}/>
      {l.annot && <span className="rc-annot"><Icon name="sparkles" size={8}/>{l.annot}</span>}
    </span>
  );
});

const ArtRCFromSchema = () => (
  <div className="rc-page">
    <AppShell activeNav="ai">
      <div className="rc-inner">
        <div className="rc-titlerow">
          <span className="crumb">Schema evolution / orders.events <b>v3 → v4</b> / Migration plan / <b>Step 3</b></span>
          <h1 style={{marginLeft:8}}>Review generated config</h1>
          <span className="src-pill" style={{background:'rgba(0,140,255,0.10)', borderColor:'rgba(0,140,255,0.25)', color:'var(--color-blue-500)'}}>
            <Icon name="warning" size={10}/>From Schema evolution · v3→v4
          </span>
          <div className="spacer"/>
          <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>1 of 7 affected pipelines</span>
        </div>

        <div className="rc-trust">
          <div className="ic"><Icon name="info" size={14}/></div>
          <div className="body">
            This config is <b>step 3 of the v3→v4 migration plan</b> for <b>orders-enrich-checkout</b>. AI added an alias for the renamed field, a defensive cast, and an auto-rollback guard. Once committed, it dual-writes alongside v3 until the canary completes.
          </div>
          <span className="meta">migration · 41 min total · this step ~6 min</span>
        </div>

        <div className="rc-grid">
          <div className="rc-panel">
            <div className="rc-panel-head">
              <Icon name="warning" size={12} color="var(--color-yellow-400)"/>
              Migration context
            </div>
            <div className="rc-panel-body">
              <div style={{padding:'10px 12px', background:'color-mix(in srgb, var(--color-yellow-400) 8%, #0c0c10)', border:'1px solid color-mix(in srgb, var(--color-yellow-400) 25%, transparent)', borderRadius:8, fontSize:11.5, marginBottom:12}}>
                <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--color-yellow-400)', marginBottom:4}}>What's changing</div>
                <div style={{lineHeight:1.5, color:'var(--color-gray-dark-100)'}}>
                  <code style={{color:'var(--color-orange-300)', background:'var(--color-orange-alpha-10)', padding:'1px 4px', borderRadius:3, fontFamily:'JetBrains Mono, monospace', fontSize:10}}>legacy_total</code> renamed to <code style={{color:'var(--color-orange-300)', background:'var(--color-orange-alpha-10)', padding:'1px 4px', borderRadius:3, fontFamily:'JetBrains Mono, monospace', fontSize:10}}>total_amount</code>. Type narrowed from <code style={{fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--color-gray-dark-100)'}}>float</code> to <code style={{fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--color-gray-dark-100)'}}>decimal(12,2)</code>. <code style={{color:'var(--color-orange-300)', background:'var(--color-orange-alpha-10)', padding:'1px 4px', borderRadius:3, fontFamily:'JetBrains Mono, monospace', fontSize:10}}>currency</code> field added.
                </div>
              </div>

              <div style={{fontSize:10.5, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', margin:'4px 0 8px'}}>
                Why these transforms · 4 reasons
              </div>

              <div className="rc-step">
                <div className="num">1</div>
                <div className="body">
                  <b>Alias</b> keeps the old field name readable downstream — your fraud + warehouse pipelines still query <code>legacy_total</code>.
                </div>
              </div>
              <div className="rc-step">
                <div className="num">2</div>
                <div className="body">
                  <b>Defensive cast</b> with <code>parse_or_dlq</code> means malformed numerics route to DLQ instead of crashing the pipeline mid-batch.
                </div>
              </div>
              <div className="rc-step">
                <div className="num">3</div>
                <div className="body">
                  <b>fill_default: USD</b> — sample data shows 99.6% of orders are USD; explicit default removes ambiguity for the 0.4% that legacy events left blank.
                </div>
              </div>
              <div className="rc-step">
                <div className="num">4</div>
                <div className="body">
                  <b>Auto-rollback</b> trigger fires if DLQ rate exceeds 0.5% in the first 5 min — one-click safety net that the migration plan demanded.
                </div>
              </div>
            </div>
          </div>

          <div className="rc-panel">
            <div className="rc-panel-head" style={{padding:0, borderBottom:0, background:'transparent'}}>
              <div className="rc-yaml-tabs" style={{flex:1}}>
                <span className="rc-yaml-tab is-active">pipeline.yaml <span className="ct">+11 / −2</span></span>
                <span className="rc-yaml-tab">old (v3)</span>
                <span className="rc-yaml-tab">dual-write plan</span>
                <span style={{flex:1}}/>
                <span className="rc-yaml-tab"><Icon name="copy" size={10}/>copy</span>
              </div>
            </div>
            <div className="rc-yaml" style={{flex:1}}>
              {renderYamlSE(RC_YAML_LINES_SE)}
            </div>
            <div className="rc-sample">
              <div className="head">
                <Icon name="play" size={9} color="var(--color-orange-300)"/>
                Sample · v3 vs v4 · how the 3 transforms reshape one event
              </div>
              <table>
                <thead>
                  <tr><th>field</th><th>v3 value</th><th>v4 after transform</th><th>note</th></tr>
                </thead>
                <tbody>
                  <tr><td>order_id</td><td>ord_8a91b…</td><td>ord_8a91b…</td><td style={{color:'var(--color-gray-dark-500)'}}>unchanged</td></tr>
                  <tr><td>legacy_total / total_amount</td><td style={{color:'var(--color-red-500)'}}>49.50 (float)</td><td className="added">49.50 (decimal)</td><td style={{color:'var(--color-orange-300)'}}>aliased + cast</td></tr>
                  <tr><td>currency</td><td style={{color:'var(--color-gray-dark-500)'}}>(missing)</td><td className="added">USD</td><td style={{color:'var(--color-orange-300)'}}>filled default</td></tr>
                  <tr><td>created_at</td><td>2026-05-05T12:21:18Z</td><td>2026-05-05T12:21:18Z</td><td style={{color:'var(--color-gray-dark-500)'}}>unchanged</td></tr>
                </tbody>
              </table>
            </div>
            <div className="rc-chat">
              <Icon name="sparkles" size={12} color="var(--color-orange-300)"/>
              <div className="field">Refine: <span style={{color:'var(--color-gray-dark-500)'}}>"tighten rollback to 0.2%" or "skip the alias and let downstream break"</span><span className="cur"/></div>
              <button className="btn btn-secondary" style={{fontSize:11, padding:'5px 10px'}}>Apply</button>
            </div>
          </div>

          <RCChecklistPanel
            dryrun={[
              { k: 'parse rate (v4)', v: '99.96%', cls: 'ok' },
              { k: 'cast failures',   v: '0.04% → DLQ', cls: 'ok' },
              { k: 'currency filled', v: '0.4%' },
              { k: 'ready to dual-write', v: 'yes', cls: 'ok' },
            ]}
            items={[
              { tone: 'ok', title: 'Source v4 schema registered', detail: 'orders.events.v4 found in registry, compatible with v3 readers behind alias.', det: 'pinned via Bridge' },
              { tone: 'ok', title: 'Defensive cast covers edge cases', detail: 'Replayed 7d of v3 data through transforms — 0.04% DLQ rate, all explainable.', det: '4.2M events · 1,720 to DLQ' },
              { tone: 'ok', title: 'Downstream pipelines compatible', detail: 'Alias means fraud + warehouse readers don\'t need to change.', det: '6 dependent pipelines verified' },
              { tone: 'ok', title: 'Rollback path tested', detail: 'Triggering rollback restores v3 in &lt;30s · last drill: yesterday.', det: 'auto + manual both green' },
            ]}
            footer={
              <div style={{marginTop:14, padding:'10px 12px', background:'var(--color-orange-alpha-10)', border:'1px solid var(--color-orange-alpha-20)', borderRadius:8, fontSize:11, color:'var(--color-foreground-neutral)', lineHeight:1.5}}>
                <Icon name="warning" size={10} color="var(--color-orange-300)"/> Committing this config <b>does not deploy v4</b>. It enters dual-write canary at 10%, controlled from the migration plan's cutover stage.
              </div>
            }
          />
        </div>

        <div className="rc-actionbar">
          <div className="stat ok">
            <b>4/4</b>
            <span>checks passing</span>
          </div>
          <div className="sep"/>
          <div className="stat">
            <b>+11 / −2</b>
            <span>lines vs v3</span>
          </div>
          <div className="sep"/>
          <div className="stat">
            <b>Step 3 / 4</b>
            <span>of migration plan</span>
          </div>
          <div className="actions">
            <button className="btn btn-secondary" style={{fontSize:12}}><Icon name="arrow-left" size={11}/>Back to migration plan</button>
            <button className="btn btn-secondary" style={{fontSize:12}}>Save as draft</button>
            <button className="btn btn-primary" style={{fontSize:12, padding:'8px 16px'}}>
              <Icon name="check" size={11}/>Commit + start dual-write canary
            </button>
          </div>
        </div>

        <Annot>
          T-12 from Schema evolution. Same surface, different framing — the source pill turns blue (it came
          from a migration, not a chat), context column explains the upstream change in the migration's own
          words, and the commit button reads "start dual-write canary" because committing here means stepping
          into cutover, not deploying. Footer banner reinforces that distinction.
        </Annot>
      </div>
    </AppShell>
  </div>
);

Object.assign(window, { ArtRCDefault, ArtRCWarn, ArtRCEdit, ArtRCFromSchema });
