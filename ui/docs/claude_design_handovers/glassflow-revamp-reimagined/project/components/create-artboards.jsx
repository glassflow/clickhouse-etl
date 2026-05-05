// Create artboards — pipeline creation landing + sub-flows (T-02, T-12 prereq)
// 4 artboards:
//   1. Main landing — 5 entry paths + recently used templates + recent drafts
//   2. Template detail — preview before committing
//   3. Import-config sub-flow — paste/upload/select source
//   4. Review-generated-config — universal final step before deploy

const { Icon } = window;

// ============================================================
// Top breadcrumb (since user is "deep" in Create flow)
// ============================================================
const CrCrumb = ({ steps }) => (
  <div className="cr-crumb">
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="sep">/</span>}
        {i === steps.length - 1
          ? <span className="cur">{s}</span>
          : <a>{s}</a>}
      </React.Fragment>
    ))}
  </div>
);

// Reusable topbar (matches existing app)
const CreateTopbar = () => (
  <div className="app-topbar">
    <div className="app-logo"><span className="logo-mark"/>GlassFlow</div>
    <div className="app-nav">
      <div className="app-nav-item"><Icon name="dash" size={14}/> Dashboard</div>
      <div className="app-nav-item"><Icon name="pipelines" size={14}/> Pipelines</div>
      <div className="app-nav-item"><Icon name="library" size={14}/> Library</div>
      <div className="app-nav-item"><Icon name="obs" size={14}/> Observability</div>
      <div className="app-nav-item is-plus is-active" style={{marginLeft: 12}}><Icon name="plus" size={14}/> Create</div>
    </div>
    <div className="app-nav-right">
      <div className="app-nav-item"><Icon name="help" size={14}/> Help</div>
      <div className="app-avatar">VC</div>
    </div>
  </div>
);

// ============================================================
// ARTBOARD 1 — Main creation landing
// ============================================================
const ArtCreateLanding = () => (
  <div className="cr-page">
    <CreateTopbar/>
    <CrCrumb steps={["Pipelines", "Create"]}/>

    <div className="cr-title-block">
      <div>
        <h1>Create a pipeline</h1>
        <p className="sub">
          Pick a starting point that matches what you already know.
          Every path lands you at the same place — a reviewed config you can deploy
          to staging or production.
        </p>
      </div>
      <div className="meta">
        <div>WORKSPACE · <b>glassflow / acme</b></div>
        <div>YOUR ROLE · <b>Editor</b></div>
        <div>ACTIVE PIPELINES · <b>14 / 50</b></div>
      </div>
    </div>

    <div className="cr-paths">
      <div className="cr-paths-h">
        <h2>Five ways to start</h2>
        <div className="hint">First time here? Try <b>Guided</b> — answers a few questions and writes the rest.</div>
      </div>

      <div className="cr-grid">
        {/* Featured: Guided */}
        <div className="cr-card featured">
          <span className="badge">Recommended</span>
          <div className="ic-pad">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4 7v6c0 4 3.5 7 8 8 4.5-1 8-4 8-8V7z"/>
              <path d="m9 12 2 2 4-5"/>
            </svg>
          </div>
          <h3>Guided</h3>
          <p className="desc">
            Tell us your source, your sink, and what you want to clean up. We pick
            sensible defaults from your library and your team's patterns. Best when
            you don't yet know what you don't know.
          </p>

          <ol className="steps">
            <li><span className="n">1</span>Pick source · Kafka / Kinesis / Pulsar / OTLP / HTTP</li>
            <li><span className="n">2</span>Pick sink · ClickHouse / S3 / Iceberg / Snowflake</li>
            <li><span className="n">3</span>Choose dedup, schema, filters from your library</li>
            <li><span className="n">4</span>Review &amp; deploy</li>
          </ol>

          <div className="feat-row">
            <div className="blk"><span>Time</span><span className="v">~3 min</span></div>
            <div className="blk"><span>Steps</span><span className="v">4</span></div>
            <div className="blk"><span>Expertise</span><span className="v">Beginner</span></div>
          </div>

          <div className="foot">
            <span>Reuses Library components when possible</span>
            <span className="arrow">Start guided <Icon name="chevR" size={12}/></span>
          </div>
        </div>

        {/* Template */}
        <div className="cr-card muted">
          <div className="ic-pad">
            <Icon name="library" size={20}/>
          </div>
          <h3>From template</h3>
          <p className="desc">
            Pick a proven pattern — Kafka→ClickHouse, OTLP traces, CDC fan-out,
            log dedup. We pre-fill the topology; you fill in the connections.
          </p>
          <div className="foot">
            <span>32 templates · 9 used in your team</span>
            <span className="arrow">Browse <Icon name="chevR" size={12}/></span>
          </div>
        </div>

        {/* AI */}
        <div className="cr-card cool">
          <span className="badge beta">Beta</span>
          <div className="ic-pad">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 13.5 9.5 20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5z"/>
            </svg>
          </div>
          <h3>Describe in English</h3>
          <p className="desc">
            "Stream Kafka order events to ClickHouse, drop refunds, dedup by
            order_id." We turn it into a config you review before deploy.
          </p>
          <div className="foot">
            <span>Powered by Claude · always reviewable</span>
            <span className="arrow">Try it <Icon name="chevR" size={12}/></span>
          </div>
        </div>

        {/* Canvas */}
        <div className="cr-card neutral">
          <span className="badge adv">Advanced</span>
          <div className="ic-pad">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="6" height="6" rx="1"/>
              <rect x="15" y="3" width="6" height="6" rx="1"/>
              <rect x="9" y="15" width="6" height="6" rx="1"/>
              <path d="M9 6h6M6 9v3a2 2 0 0 0 2 2h2M18 9v3a2 2 0 0 1-2 2h-2"/>
            </svg>
          </div>
          <h3>From scratch</h3>
          <p className="desc">
            Drop into the visual canvas with an empty graph. Drag nodes,
            wire them, edit YAML side-by-side. Full control, no rails.
          </p>
          <div className="foot">
            <span>For users who already know the graph</span>
            <span className="arrow">Open canvas <Icon name="chevR" size={12}/></span>
          </div>
        </div>

        {/* Import */}
        <div className="cr-card neutral">
          <div className="ic-pad">
            <Icon name="download" size={20}/>
          </div>
          <h3>Import config</h3>
          <p className="desc">
            Paste YAML, upload a file, or pull from a Git repo. We validate the
            schema, surface diffs, and let you fix issues before saving.
          </p>
          <div className="foot">
            <span>Useful for migrations &amp; CI handoff</span>
            <span className="arrow">Import <Icon name="chevR" size={12}/></span>
          </div>
        </div>
      </div>
    </div>

    {/* Recently used templates + recent drafts */}
    <div className="cr-recent">
      <div>
        <div className="cr-section-h">
          <h3>Recently used templates<span className="ct">across your team · 30d</span></h3>
          <span className="all">See all 32 →</span>
        </div>
        <div className="tpl-row">
          <div className="tpl">
            <div className="tpl-route">
              <Icon name="kafka" size={11}/> Kafka <span className="arr">→</span> <Icon name="ch" size={11}/> ClickHouse
            </div>
            <div className="tpl-name">CDC fan-out · dedup'd</div>
            <div className="tpl-desc">Used 14× this month · last by Marcus, 2d ago</div>
          </div>
          <div className="tpl">
            <div className="tpl-route">
              <Icon name="otlp" size={11}/> OTLP <span className="arr">→</span> <Icon name="ch" size={11}/> ClickHouse
            </div>
            <div className="tpl-name">Traces with sampling</div>
            <div className="tpl-desc">Used 9× this month · official template</div>
          </div>
          <div className="tpl">
            <div className="tpl-route">
              <Icon name="kafka" size={11}/> Kafka <span className="arr">→</span> <Icon name="folder" size={11}/> S3
            </div>
            <div className="tpl-name">Archival log sink</div>
            <div className="tpl-desc">Used 6× this month · gzip + parquet</div>
          </div>
        </div>
      </div>

      <div>
        <div className="cr-section-h">
          <h3>Your drafts<span className="ct">unsaved work · auto-saved</span></h3>
          <span className="all">See all 4 →</span>
        </div>
        <div className="draft-list">
          <div className="draft">
            <div className="ic"><Icon name="library" size={13}/></div>
            <div>
              <div className="nm">order-events-v2 <span className="src">· template · 80% complete</span></div>
            </div>
            <div className="when">10 min ago</div>
            <button className="resume">Resume</button>
          </div>
          <div className="draft">
            <div className="ic"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 13.5 9.5 20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5z"/></svg></div>
            <div>
              <div className="nm">payment-stream-pii-redact <span className="src">· AI · review needed</span></div>
            </div>
            <div className="when">yesterday</div>
            <button className="resume">Resume</button>
          </div>
          <div className="draft">
            <div className="ic"><Icon name="download" size={13}/></div>
            <div>
              <div className="nm">prod-clickstream.yaml <span className="src">· import · 2 errors</span></div>
            </div>
            <div className="when">3d ago</div>
            <button className="resume">Resume</button>
          </div>
        </div>
      </div>
    </div>

    <div className="cr-footer">
      <div className="left">
        Not sure where to start? <a>Read the 5-minute pipeline tutorial →</a>
      </div>
      <div className="right">
        <button className="btn ghost">Back to dashboard</button>
      </div>
    </div>
  </div>
);

// ============================================================
// ARTBOARD 2 — Template detail
// ============================================================
const ArtCreateTemplate = () => (
  <div className="cr-page">
    <CreateTopbar/>
    <CrCrumb steps={["Pipelines", "Create", "Templates", "CDC fan-out · dedup'd"]}/>

    <div className="tpl-detail">
      <div className="tpl-left">
        <div className="tpl-meta">
          <span><Icon name="library" size={11}/></span>
          <span>OFFICIAL · v3.2 · updated 2 weeks ago</span>
          <span className="pop">Used 14× this month</span>
        </div>
        <h2>CDC fan-out, dedup'd</h2>
        <p className="tagline">
          Capture row-level changes from a Kafka CDC topic, dedup by primary key
          (last-write-wins), and write to ClickHouse with idempotent
          inserts. The standard pattern for analytics replicas.
        </p>

        <div className="tpl-needs">
          <div className="ttl">YOU'LL PROVIDE / WE SUPPLY</div>
          <div className="item">
            <div className="ic ok"><Icon name="check" size={12}/></div>
            <div><b>Kafka source</b><br/><span style={{color:'var(--color-gray-dark-100)', fontSize:11}}>Reusing <code style={{color:'var(--color-orange-300)'}}>kafka-prod-orders</code> from Library</span></div>
            <span className="h">auto</span>
          </div>
          <div className="item">
            <div className="ic ok"><Icon name="check" size={12}/></div>
            <div><b>ClickHouse sink</b><br/><span style={{color:'var(--color-gray-dark-100)', fontSize:11}}>Reusing <code style={{color:'var(--color-orange-300)'}}>ch-analytics-replica</code></span></div>
            <span className="h">auto</span>
          </div>
          <div className="item">
            <div className="ic"><Icon name="schema" size={12}/></div>
            <div><b>Source schema</b><br/><span style={{color:'var(--color-gray-dark-100)', fontSize:11}}>We'll infer from the topic; you confirm</span></div>
            <span className="h">~30s</span>
          </div>
          <div className="item">
            <div className="ic"><Icon name="dedup" size={12}/></div>
            <div><b>Dedup key</b><br/><span style={{color:'var(--color-gray-dark-100)', fontSize:11}}>Pick the primary-key field (typically <code>id</code>)</span></div>
            <span className="h">10s</span>
          </div>
          <div className="item">
            <div className="ic miss"><Icon name="filter" size={12}/></div>
            <div><b>Optional filter</b><br/><span style={{color:'var(--color-gray-dark-100)', fontSize:11}}>e.g. drop tombstones · skip if not needed</span></div>
            <span className="h">opt</span>
          </div>
        </div>

        <div className="tpl-actions">
          <button className="btn primary">Use this template <Icon name="chevR" size={13}/></button>
          <button className="btn secondary"><Icon name="clone" size={13}/>Clone &amp; edit YAML</button>
          <button className="btn ghost"><Icon name="link" size={13}/>Share</button>
        </div>
      </div>

      <div className="tpl-right">
        <div className="tpl-preview-h">TOPOLOGY PREVIEW</div>
        <div className="tpl-canvas">
          {/* edges */}
          <svg style={{position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none'}}>
            <defs>
              <marker id="arrh-tpl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" fill="var(--color-gray-dark-700)"/>
              </marker>
            </defs>
            <path d="M 174 92 C 220 92, 240 156, 286 156" stroke="var(--color-gray-dark-700)" strokeWidth="1.5" fill="none" markerEnd="url(#arrh-tpl)"/>
            <path d="M 446 156 C 492 156, 512 156, 558 156" stroke="var(--color-gray-dark-700)" strokeWidth="1.5" fill="none" markerEnd="url(#arrh-tpl)"/>
          </svg>

          <div className="tpl-node src" style={{left:24, top:64}}>
            <div className="nh"><Icon name="kafka" size={11}/>SOURCE</div>
            <div className="nm">Kafka topic</div>
            <div className="sub">orders.cdc · 6 part.</div>
          </div>
          <div className="tpl-node" style={{left:286, top:128}}>
            <div className="nh"><Icon name="dedup" size={11}/>TRANSFORM</div>
            <div className="nm">Dedup</div>
            <div className="sub">key: <span style={{color:'var(--color-orange-300)'}}>{'<your.id>'}</span></div>
          </div>
          <div className="tpl-node snk" style={{left:558, top:128}}>
            <div className="nh"><Icon name="ch" size={11}/>SINK</div>
            <div className="nm">ClickHouse</div>
            <div className="sub">analytics.orders</div>
          </div>

          <div style={{position:'absolute', bottom:14, left:14, right:14}}>
            <div className="tpl-config-card">
              <div><span className="c"># pipeline.yaml — preview</span></div>
              <div><span className="k">name:</span> <span className="v">cdc-fanout-orders</span></div>
              <div><span className="k">source:</span></div>
              <div>&nbsp;&nbsp;<span className="k">type:</span> <span className="v">kafka</span></div>
              <div>&nbsp;&nbsp;<span className="k">connection:</span> <span className="v">$ref: kafka-prod-orders</span></div>
              <div><span className="k">transforms:</span></div>
              <div>&nbsp;&nbsp;- <span className="k">type:</span> <span className="v">dedup</span> &nbsp; <span className="c"># last-write-wins</span></div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="k">key:</span> <span className="v">id</span> &nbsp; <span className="c"># ← you'll pick this</span></div>
              <div><span className="k">sink:</span> <span className="v">$ref: ch-analytics-replica</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="cr-action-bar">
      <div className="left">
        <span><Icon name="info" size={11}/> Estimated setup: <b>~2 minutes</b></span>
        <span>· You can switch paths at any step</span>
      </div>
      <div className="right">
        <button className="btn secondary">Back to all templates</button>
        <button className="btn primary">Use this template <Icon name="chevR" size={13}/></button>
      </div>
    </div>
  </div>
);

// ============================================================
// ARTBOARD 3 — Import config sub-flow
// ============================================================
const ArtCreateImport = () => (
  <div className="cr-page">
    <CreateTopbar/>
    <CrCrumb steps={["Pipelines", "Create", "Import config"]}/>

    <div className="imp-wrap">
      <div className="imp-left">
        <div className="imp-h">
          <h2>Import a pipeline config</h2>
          <p className="sub">Paste YAML, upload a file, or pull from a Git repo. We validate as you type and surface diffs against your existing Library.</p>
        </div>

        <div className="imp-sources">
          <div className="imp-src is-active">
            <Icon name="edit" size={13}/>Paste YAML
          </div>
          <div className="imp-src">
            <Icon name="download" size={13}/>Upload file
          </div>
          <div className="imp-src">
            <Icon name="link" size={13}/>From Git repo
          </div>
        </div>

        <div className="imp-tabs">
          <div className="imp-tab is-active">pipeline.yaml</div>
          <div className="imp-tab">+ add fragment</div>
        </div>

        <div className="imp-editor">
          <div className="imp-gutter">
            {Array.from({length: 22}, (_, i) => <div key={i}>{i+1}</div>)}
          </div>
          <pre className="imp-code">{`<span class="c"># Imported from prod-clickstream.yaml</span>
<span class="k">name:</span> <span class="s">prod-clickstream</span>
<span class="k">version:</span> <span class="n">2</span>

<span class="k">source:</span>
  <span class="k">type:</span> <span class="s">kafka</span>
  <span class="k">brokers:</span>
    - <span class="s">"kafka-prod-01:9092"</span>
    - <span class="s">"kafka-prod-02:9092"</span>
  <span class="k">topic:</span> <span class="s">"clickstream.events"</span>
  <span class="k">consumer_group:</span> <span class="s">"glassflow-cs"</span>
  <span class="k">auth:</span> <span class="e">"<undefined>"</span>          <span class="c"># ← unresolved</span>

<span class="k">transforms:</span>
  - <span class="k">type:</span> <span class="s">dedup</span>
    <span class="k">key:</span> <span class="s">"event_id"</span>
    <span class="k">window_ms:</span> <span class="n">60000</span>
  - <span class="k">type:</span> <span class="e">"field_filtre"</span>     <span class="c"># ← typo</span>
    <span class="k">drop_if:</span> <span class="s">"event_type == 'debug'"</span>

<span class="k">sink:</span>
  <span class="k">type:</span> <span class="s">clickhouse</span>
  <span class="k">table:</span> <span class="s">"events.clickstream"</span>`}
          </pre>
        </div>
      </div>

      <div className="imp-right">
        <div className="imp-val-h">VALIDATION</div>

        <div className="imp-val-status warn">
          <div className="row">
            <Icon name="warn" size={14}/>2 issues need fixing
          </div>
          <div className="desc">
            Schema parses, but two references can't be resolved. Fix these to enable
            "Continue to review."
          </div>
        </div>

        <div className="imp-issue">
          <div className="head">
            <span className="sev err">ERROR</span>
            <b>Unknown transform type</b>
            <span className="ln">line 18</span>
          </div>
          <div className="msg">
            <code style={{color:'var(--color-orange-300)'}}>field_filtre</code> is not a recognized transform
          </div>
          <div className="det">Did you mean <code style={{color:'var(--color-foreground-neutral)'}}>field_filter</code>? That transform takes the same <code>drop_if</code> argument.</div>
          <div className="fix">
            <Icon name="check" size={11}/>Apply suggested fix
          </div>
        </div>

        <div className="imp-issue">
          <div className="head">
            <span className="sev err">ERROR</span>
            <b>Unresolved auth reference</b>
            <span className="ln">line 11</span>
          </div>
          <div className="msg">
            Source auth is empty
          </div>
          <div className="det">Pick a Kafka connection from your Library, or paste credentials inline. <code style={{color:'var(--color-orange-300)'}}>kafka-prod-clickstream</code> in your Library matches these brokers.</div>
          <div className="fix">
            <Icon name="link" size={11}/>Link to <code>kafka-prod-clickstream</code>
          </div>
        </div>

        <div className="imp-issue" style={{borderColor: 'rgba(247, 212, 120, 0.3)'}}>
          <div className="head">
            <span className="sev warn">WARN</span>
            <b>Reusable component detected</b>
            <span className="ln">line 14-16</span>
          </div>
          <div className="msg">
            This dedup config matches <code style={{color:'var(--color-orange-300)'}}>dedup-event-id-1m</code> in your Library
          </div>
          <div className="det">Replace the inline definition with a <code>$ref</code>? Updates to the shared component will propagate to this pipeline.</div>
          <div className="fix">
            <Icon name="link" size={11}/>Replace with $ref
          </div>
        </div>
      </div>
    </div>

    <div className="cr-action-bar">
      <div className="left">
        <span><b>2 errors</b> · 1 warning · auto-save on</span>
      </div>
      <div className="right">
        <button className="btn ghost">Discard</button>
        <button className="btn secondary">Save as draft</button>
        <button className="btn primary" style={{opacity:0.5}}>Continue to review →</button>
      </div>
    </div>
  </div>
);

// ============================================================
// ARTBOARD 4 — Review-generated-config (universal final step)
// ============================================================
const ArtCreateReview = () => (
  <div className="cr-page">
    <CreateTopbar/>
    <CrCrumb steps={["Pipelines", "Create", "Describe in English", "Review"]}/>

    <div className="rev-wrap">
      <div className="rev-left">
        <div className="rev-h">
          <h2>Review &amp; deploy</h2>
          <span className="src-pill">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 13.5 9.5 20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5z"/></svg>
            Generated by AI
          </span>
        </div>

        <div className="rev-name-row">
          <input className="rev-name-input" defaultValue="payment-stream-pii-redact"/>
          <div className="rev-env-pill">
            <span style={{width:6, height:6, borderRadius:'50%', background:'var(--color-yellow-400)'}}/>
            staging <Icon name="chevD" size={11}/>
          </div>
        </div>

        <div className="rev-val pass">
          <div className="head">
            <Icon name="check" size={14}/>Config validated
          </div>
          <div className="body">
            Schema valid · all <code>$ref</code>s resolve · estimated cost within team
            quota. Deploy is safe.
          </div>
          <ul className="checks">
            <li><span className="ok">✓</span> Schema parses</li>
            <li><span className="ok">✓</span> Connections reachable</li>
            <li><span className="ok">✓</span> Topology has no cycles</li>
            <li><span className="ok">✓</span> Schema compatible w/ sink</li>
            <li><span className="ok">✓</span> Dedup key exists in source</li>
            <li><span className="skip">○</span> Dry-run not yet run</li>
          </ul>
        </div>

        <div className="rev-impact">
          <div className="ttl">EXPECTED IMPACT</div>
          <div className="grid">
            <div className="blk">
              <div className="lbl">Throughput</div>
              <div className="v">1.2k<span className="u">events/s</span></div>
            </div>
            <div className="blk">
              <div className="lbl">Est. cost</div>
              <div className="v">$84<span className="u">/mo</span></div>
            </div>
            <div className="blk">
              <div className="lbl">Compute</div>
              <div className="v">2<span className="u">workers</span></div>
            </div>
          </div>
        </div>

        <div style={{
          fontFamily:"'JetBrains Mono', monospace", fontSize:10,
          textTransform:'uppercase', letterSpacing:'0.1em',
          color:'var(--color-gray-dark-500)', marginBottom:10
        }}>WHAT THIS PIPELINE USES · 4 components</div>

        <div className="rev-pieces">
          <div className="rev-piece">
            <div className="ic" style={{background:'var(--color-green-750)', color:'var(--color-green-500)'}}><Icon name="kafka" size={14}/></div>
            <div>
              <div className="nm">kafka-prod-payments</div>
              <div className="meta">Library · used in 4 other pipelines · last verified 2h ago</div>
            </div>
            <span className="reuse exist">Existing</span>
          </div>
          <div className="rev-piece">
            <div className="ic"><Icon name="filter" size={14}/></div>
            <div>
              <div className="nm">pii-redact-payments</div>
              <div className="meta"><span className="new">NEW</span> · will be saved to Library on deploy · 6 fields redacted</div>
            </div>
            <span className="reuse new">New</span>
          </div>
          <div className="rev-piece">
            <div className="ic" style={{background:'var(--color-green-750)', color:'var(--color-green-500)'}}><Icon name="dedup" size={14}/></div>
            <div>
              <div className="nm">dedup-payment-id-5m</div>
              <div className="meta">Library · used in 2 other pipelines</div>
            </div>
            <span className="reuse exist">Existing</span>
          </div>
          <div className="rev-piece">
            <div className="ic" style={{background:'var(--color-green-750)', color:'var(--color-green-500)'}}><Icon name="ch" size={14}/></div>
            <div>
              <div className="nm">ch-analytics-replica</div>
              <div className="meta">Library · used in 7 other pipelines · last verified 18m ago</div>
            </div>
            <span className="reuse exist">Existing</span>
          </div>
        </div>
      </div>

      <div className="rev-right">
        <div className="yaml-h">
          <div className="fmt-toggle">
            <button className="is-active">YAML</button>
            <button>JSON</button>
            <button>Visual</button>
          </div>
          <div className="actions">
            <span style={{marginRight: 8}}>4 new lines · 0 removed</span>
            <button className="icon-btn"><Icon name="clone" size={12}/></button>
            <button className="icon-btn"><Icon name="download" size={12}/></button>
            <button className="icon-btn"><Icon name="edit" size={12}/></button>
          </div>
        </div>
        <div className="yaml-body">
          <div className="gutter">
            {Array.from({length: 28}, (_, i) => <div key={i}>{i+1}</div>)}
          </div>
          <pre className="code"
            dangerouslySetInnerHTML={{__html:
`<span class="c"># Generated from prompt:</span>
<span class="c"># "Stream payment events from Kafka, redact PII,</span>
<span class="c">#  dedup by payment_id, send to ClickHouse"</span>

<span class="k">name:</span> <span class="s">payment-stream-pii-redact</span>
<span class="k">version:</span> <span class="n">1</span>
<span class="k">env:</span> <span class="s">staging</span>

<span class="k">source:</span>
  <span class="k">type:</span> <span class="s">kafka</span>
  <span class="k">connection:</span> <span class="ref">$ref: kafka-prod-payments</span>
  <span class="k">topic:</span> <span class="s">"payments.events.v2"</span>
  <span class="k">consumer_group:</span> <span class="s">"glassflow-pii-pipeline"</span>

<span class="k">transforms:</span>
<span class="add">  - <span class="k">type:</span> <span class="s">field_redact</span>      <span class="c"># NEW</span></span>
<span class="add">    <span class="k">name:</span> <span class="s">pii-redact-payments</span></span>
<span class="add">    <span class="k">fields:</span> [<span class="s">"card_pan"</span>, <span class="s">"cvv"</span>, <span class="s">"holder_name"</span>,</span>
<span class="add">             <span class="s">"email"</span>, <span class="s">"phone"</span>, <span class="s">"address"</span>]</span>

  - <span class="k">type:</span> <span class="s">dedup</span>
    <span class="k">use:</span> <span class="ref">$ref: dedup-payment-id-5m</span>

<span class="k">sink:</span>
  <span class="k">type:</span> <span class="s">clickhouse</span>
  <span class="k">connection:</span> <span class="ref">$ref: ch-analytics-replica</span>
  <span class="k">table:</span> <span class="s">"analytics.payments_clean"</span>`
            }}
          />
        </div>
      </div>
    </div>

    <div className="cr-action-bar">
      <div className="left">
        <span><Icon name="info" size={11}/> Deploying to <b>staging</b> · you can promote to production after verification</span>
      </div>
      <div className="right">
        <button className="btn ghost">Save as draft</button>
        <button className="btn secondary"><Icon name="play" size={12}/>Run dry-run</button>
        <button className="btn primary">Deploy to staging <Icon name="chevR" size={13}/></button>
      </div>
    </div>
  </div>
);

Object.assign(window, {
  ArtCreateLanding,
  ArtCreateTemplate,
  ArtCreateImport,
  ArtCreateReview,
});
