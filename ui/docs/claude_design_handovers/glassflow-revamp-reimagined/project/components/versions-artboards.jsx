// Versions tab on Pipeline Detail (T-03)
// Timeline list · side-by-side diff · rollback modal · v1-only state

const { Icon } = window;

// ---- shared topbar ----
const VerTopbar = () => (
  <div className="app-topbar">
    <div className="app-logo"><span className="logo-mark"/>GlassFlow</div>
    <div className="app-nav">
      <div className="app-nav-item"><Icon name="dash" size={14}/> Dashboard</div>
      <div className="app-nav-item is-active"><Icon name="pipelines" size={14}/> Pipelines</div>
      <div className="app-nav-item"><Icon name="library" size={14}/> Library</div>
      <div className="app-nav-item"><Icon name="obs" size={14}/> Observability</div>
      <div className="app-nav-item is-plus" style={{marginLeft: 12}}><Icon name="plus" size={14}/> Create</div>
    </div>
    <div className="app-nav-right">
      <div className="app-nav-item"><Icon name="help" size={14}/> Help</div>
      <div className="app-avatar">VC</div>
    </div>
  </div>
);

const VerPDH = ({ status = "running", tabs = "Versions" }) => (
  <div className="ver-pdh">
    <div className="ver-crumbs">
      <a>Pipelines</a>
      <span>/</span>
      <span className="cur">prod-orders-to-analytics</span>
    </div>
    <div className="ver-pdh-row">
      <span className={`ver-pip-dot ${status==='paused'?'paused':''} ${status==='degraded'?'degraded':''}`}/>
      <h1>prod-orders-to-analytics</h1>
      <span className="chip-warn">prod</span>
      <span style={{fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:'var(--color-gray-dark-500)'}}>
        prod-orders-analytics-h8z9a
      </span>
      <div style={{flex:1}}/>
      <button className="btn ghost"><Icon name="stop" size={12}/>Pause</button>
      <button className="btn secondary"><Icon name="edit" size={12}/>Open in canvas</button>
    </div>
    <div className="ver-tabs">
      {[
        ["Overview", null],
        ["Canvas", null],
        ["Library links", null],
        ["Metrics", null],
        ["Logs", null],
        ["Versions", "12"],
        ["Settings", null],
      ].map(([t, ct]) => (
        <div key={t} className={`ver-tab ${t===tabs?'is-active':''}`}>
          {t}{ct && <span className="ct">{ct}</span>}
        </div>
      ))}
    </div>
  </div>
);

// =================================================================
// ARTBOARD 1 — Versions timeline (default, with draft banner)
// =================================================================
const ArtVersionsTimeline = () => (
  <div className="ver-page">
    <VerTopbar/>
    <VerPDH/>

    <div className="ver-draft-banner">
      <div className="ic"><Icon name="edit" size={13}/></div>
      <div className="body">
        <b>You have an unsaved draft from this pipeline</b>
        <div className="det">
          Started 18 minutes ago by you · 3 changes since v12 · auto-saved · not yet deployed
        </div>
      </div>
      <div className="actions">
        <button className="btn ghost">Discard</button>
        <button className="btn secondary">Resume editing</button>
        <button className="btn primary">Review &amp; deploy</button>
      </div>
    </div>

    <div className="ver-main">
      {/* LEFT: timeline */}
      <div className="ver-list">
        <div className="ver-list-h">
          <div className="ttl">Version history<span className="ct">12 versions · since Mar 2024</span></div>
          <div className="filters">
            <button className="ver-filter is-active">All</button>
            <button className="ver-filter">Deployed</button>
            <button className="ver-filter">Drafts</button>
          </div>
        </div>

        <div className="ver-timeline">
          <div className="ver-row draft">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">draft</span>
                <span className="badge draft">DRAFT</span>
                <span className="when">18 min ago</span>
              </div>
              <div className="msg">Add filter · drop refunds &amp; chargebacks</div>
              <div className="meta">
                <span className="a">Vanessa C.</span>
                <span className="src">canvas</span>
                <span><span className="ch add">+12</span> · <span className="ch rem">−3</span></span>
              </div>
            </div>
          </div>

          <div className="ver-row deployed is-selected-b">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v12</span>
                <span className="badge live">LIVE · PROD</span>
                <span className="when">2d ago</span>
              </div>
              <div className="msg">Bump dedup window 5m → 10m for late-arriving orders</div>
              <div className="meta">
                <span className="a">Marcus L.</span>
                <span className="src">guided</span>
                <span><span className="ch add">+1</span> · <span className="ch rem">−1</span></span>
              </div>
              <span className="compare">B · COMPARE</span>
            </div>
          </div>

          <div className="ver-row deployed">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v11</span>
                <span className="badge staging">PREV. PROD</span>
                <span className="when">8d ago</span>
              </div>
              <div className="msg">Switch sink to ch-analytics-replica (was ch-primary)</div>
              <div className="meta">
                <span className="a">Marcus L.</span>
                <span className="src">canvas</span>
                <span><span className="ch add">+2</span> · <span className="ch rem">−2</span></span>
              </div>
            </div>
          </div>

          <div className="ver-row deployed is-selected-a">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v10</span>
                <span className="badge staging">STAGING</span>
                <span className="when">14d ago</span>
              </div>
              <div className="msg">Add PII redact transform · 6 fields</div>
              <div className="meta">
                <span className="a">Vanessa C.</span>
                <span className="src">AI · prompt</span>
                <span><span className="ch add">+18</span> · <span className="ch rem">−2</span></span>
              </div>
              <span className="compare">A · BASE</span>
            </div>
          </div>

          <div className="ver-row deployed">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v9</span>
                <span className="badge staging">STAGING</span>
                <span className="when">3w ago</span>
              </div>
              <div className="msg">Increase parallelism 2 → 4 workers</div>
              <div className="meta">
                <span className="a">Priya S.</span>
                <span className="src">YAML edit</span>
                <span><span className="ch add">+1</span> · <span className="ch rem">−1</span></span>
              </div>
            </div>
          </div>

          <div className="ver-row rolledback">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v8</span>
                <span className="badge roll">ROLLED BACK</span>
                <span className="when">3w ago</span>
              </div>
              <div className="msg">Try aggressive batching (rolled back · DLQ spiked)</div>
              <div className="meta">
                <span className="a">Priya S.</span>
                <span className="src">canvas</span>
                <span><span className="ch add">+4</span> · <span className="ch rem">−2</span></span>
              </div>
            </div>
          </div>

          <div className="ver-row deployed">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v7</span>
                <span className="badge staging">PREV. PROD</span>
                <span className="when">1mo ago</span>
              </div>
              <div className="msg">Pin OrderEvents schema v4 (was floating)</div>
              <div className="meta">
                <span className="a">Marcus L.</span>
                <span className="src">guided</span>
                <span><span className="ch add">+2</span> · <span className="ch rem">−1</span></span>
              </div>
            </div>
          </div>

          <div className="ver-row deployed">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v6</span>
                <span className="badge staging">PREV. PROD</span>
                <span className="when">2mo ago</span>
              </div>
              <div className="msg">Move from inline to library $ref dedup</div>
              <div className="meta">
                <span className="a">Vanessa C.</span>
                <span className="src">refactor</span>
                <span><span className="ch add">+1</span> · <span className="ch rem">−9</span></span>
              </div>
            </div>
          </div>

          <div style={{
            paddingTop:14, marginTop:6,
            fontFamily:"'JetBrains Mono', monospace", fontSize:10.5,
            color:'var(--color-gray-dark-500)', textAlign:'center', cursor:'pointer'
          }}>↓ Show 4 older versions (v5 — v1)</div>
        </div>
      </div>

      {/* RIGHT: diff detail */}
      <div className="ver-detail">
        <div className="ver-detail-h">
          <div className="ver-cmp">
            <span className="pill a"><span className="ic">●</span>v10<span className="lbl">base</span></span>
            <span className="arr">→</span>
            <span className="pill b"><span className="ic">●</span>v12<span className="lbl">current</span></span>
          </div>
          <div className="actions">
            <div className="ver-mode-toggle">
              <button className="is-active">Side-by-side</button>
              <button>Inline</button>
              <button>Visual</button>
            </div>
            <button className="btn ghost"><Icon name="download" size={12}/></button>
            <button className="btn secondary"><Icon name="history" size={12}/>Rollback to v10</button>
          </div>
        </div>

        <div className="ver-impact-strip">
          <div className="ver-impact-blk">
            <div className="lbl">CHANGES</div>
            <div className="v">+19 / −5 <span className="delta up">2 files</span></div>
          </div>
          <div className="ver-impact-blk">
            <div className="lbl">THROUGHPUT IMPACT</div>
            <div className="v">+8% <span className="delta up">vs v10</span></div>
          </div>
          <div className="ver-impact-blk">
            <div className="lbl">ERROR RATE</div>
            <div className="v">−0.04% <span className="delta up">improved</span></div>
          </div>
          <div className="ver-impact-blk">
            <div className="lbl">DEPLOYED</div>
            <div className="v">2d ago<span className="delta" style={{color:'var(--color-gray-dark-500)'}}>· by Marcus</span></div>
          </div>
        </div>

        <div className="ver-topo">
          <div className="ver-topo-h">TOPOLOGY · structural diff</div>
          <div className="ver-topo-grid">
            <div className="ver-topo-side left">
              <div className="lbl">v10 · 4 stages</div>
              <div className="ver-topo-chain">
                <span className="ver-topo-node"><Icon name="kafka" size={11}/>kafka</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node"><Icon name="filter" size={11}/>pii-redact</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node chg"><Icon name="dedup" size={11}/>dedup · 5m</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node"><Icon name="ch" size={11}/>ch-primary</span>
              </div>
            </div>
            <div className="ver-topo-cmp">vs</div>
            <div className="ver-topo-side right">
              <div className="lbl">v12 · 4 stages</div>
              <div className="ver-topo-chain">
                <span className="ver-topo-node"><Icon name="kafka" size={11}/>kafka</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node"><Icon name="filter" size={11}/>pii-redact</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node chg"><Icon name="dedup" size={11}/>dedup · 10m</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node chg"><Icon name="ch" size={11}/>ch-analytics-replica</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ver-diff">
          <div className="ver-diff-pane left">
            <div className="ver-diff-pane-h">
              <span>v10</span><span>·</span><span>14d ago</span><span>·</span><span>Vanessa C.</span>
              <span style={{marginLeft:'auto'}} className="v">staging</span>
            </div>
            <div className="ver-diff-body">
              <div className="gutter">
                {Array.from({length: 22}, (_, i) => <div key={i}>{i+1}</div>)}
              </div>
              <pre className="code" dangerouslySetInnerHTML={{__html:
`<span class="k">name:</span> <span class="s">prod-orders-to-analytics</span>
<span class="k">version:</span> <span class="n">10</span>

<span class="k">source:</span>
  <span class="k">type:</span> <span class="s">kafka</span>
  <span class="k">connection:</span> <span class="ref">$ref: kafka-prod-eu</span>
  <span class="k">topic:</span> <span class="s">"orders.placed"</span>

<span class="k">transforms:</span>
  - <span class="k">type:</span> <span class="s">field_redact</span>
    <span class="k">name:</span> <span class="s">pii-redact</span>
    <span class="k">fields:</span> [<span class="s">"card_pan"</span>, <span class="s">"cvv"</span>,
             <span class="s">"holder"</span>, <span class="s">"email"</span>]
<span class="chg">  - <span class="k">type:</span> <span class="s">dedup</span></span>
<span class="chg">    <span class="k">key:</span> <span class="s">"order_id"</span></span>
<span class="chg">    <span class="k">window_ms:</span> <span class="n">300000</span>     <span class="c"># 5m</span></span>

<span class="k">sink:</span>
  <span class="k">type:</span> <span class="s">clickhouse</span>
<span class="chg">  <span class="k">connection:</span> <span class="ref">$ref: ch-primary</span></span>
  <span class="k">table:</span> <span class="s">"analytics.orders"</span>
`
              }}/>
            </div>
          </div>
          <div className="ver-diff-pane right">
            <div className="ver-diff-pane-h">
              <span>v12</span><span>·</span><span>2d ago</span><span>·</span><span>Marcus L.</span>
              <span style={{marginLeft:'auto'}} className="v">live · prod</span>
            </div>
            <div className="ver-diff-body">
              <div className="gutter">
                {Array.from({length: 22}, (_, i) => <div key={i}>{i+1}</div>)}
              </div>
              <pre className="code" dangerouslySetInnerHTML={{__html:
`<span class="k">name:</span> <span class="s">prod-orders-to-analytics</span>
<span class="k">version:</span> <span class="n">12</span>

<span class="k">source:</span>
  <span class="k">type:</span> <span class="s">kafka</span>
  <span class="k">connection:</span> <span class="ref">$ref: kafka-prod-eu</span>
  <span class="k">topic:</span> <span class="s">"orders.placed"</span>

<span class="k">transforms:</span>
  - <span class="k">type:</span> <span class="s">field_redact</span>
    <span class="k">name:</span> <span class="s">pii-redact</span>
    <span class="k">fields:</span> [<span class="s">"card_pan"</span>, <span class="s">"cvv"</span>,
             <span class="s">"holder"</span>, <span class="s">"email"</span>]
<span class="chg">  - <span class="k">type:</span> <span class="s">dedup</span></span>
<span class="chg">    <span class="k">key:</span> <span class="s">"order_id"</span></span>
<span class="chg">    <span class="k">window_ms:</span> <span class="n">600000</span>     <span class="c"># 10m</span></span>

<span class="k">sink:</span>
  <span class="k">type:</span> <span class="s">clickhouse</span>
<span class="chg">  <span class="k">connection:</span> <span class="ref">$ref: ch-analytics-replica</span></span>
  <span class="k">table:</span> <span class="s">"analytics.orders"</span>
`
              }}/>
            </div>
          </div>
        </div>

        <div className="ver-foot">
          <div className="left">
            <b>2 hunks</b> · 3 lines changed across 1 file · select different versions to compare
          </div>
          <div className="right">
            <button className="btn ghost"><Icon name="link" size={12}/>Copy compare link</button>
            <button className="btn secondary">Restore v10 to draft</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// =================================================================
// ARTBOARD 2 — Larger structural diff (added a transform)
// =================================================================
const ArtVersionsBigDiff = () => (
  <div className="ver-page">
    <VerTopbar/>
    <VerPDH/>

    <div className="ver-main">
      {/* simplified left list */}
      <div className="ver-list">
        <div className="ver-list-h">
          <div className="ttl">Version history<span className="ct">12 versions</span></div>
          <div className="filters">
            <button className="ver-filter is-active">All</button>
            <button className="ver-filter">Deployed</button>
          </div>
        </div>
        <div className="ver-timeline">
          <div className="ver-row deployed is-selected-b">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v10</span>
                <span className="badge live">LIVE THEN</span>
                <span className="when">14d ago</span>
              </div>
              <div className="msg">Add PII redact transform · 6 fields</div>
              <div className="meta">
                <span className="a">Vanessa C.</span>
                <span className="src">AI · prompt</span>
                <span><span className="ch add">+18</span> · <span className="ch rem">−2</span></span>
              </div>
              <span className="compare">B · TARGET</span>
            </div>
          </div>
          <div className="ver-row deployed is-selected-a">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v9</span>
                <span className="badge staging">PREV.</span>
                <span className="when">3w ago</span>
              </div>
              <div className="msg">Increase parallelism 2 → 4 workers</div>
              <div className="meta">
                <span className="a">Priya S.</span>
                <span className="src">YAML edit</span>
                <span><span className="ch add">+1</span> · <span className="ch rem">−1</span></span>
              </div>
              <span className="compare">A · BASE</span>
            </div>
          </div>
          <div className="ver-row deployed">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v8</span>
                <span className="badge roll">ROLLED BACK</span>
                <span className="when">3w ago</span>
              </div>
              <div className="msg">Try aggressive batching (DLQ spiked)</div>
              <div className="meta">
                <span className="a">Priya S.</span>
                <span className="src">canvas</span>
              </div>
            </div>
          </div>
          <div className="ver-row deployed">
            <div className="marker"/>
            <div>
              <div className="head">
                <span className="v">v7</span>
                <span className="badge staging">PREV.</span>
                <span className="when">1mo ago</span>
              </div>
              <div className="msg">Pin OrderEvents schema v4</div>
              <div className="meta">
                <span className="a">Marcus L.</span>
                <span className="src">guided</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ver-detail">
        <div className="ver-detail-h">
          <div className="ver-cmp">
            <span className="pill a"><span className="ic">●</span>v9<span className="lbl">base</span></span>
            <span className="arr">→</span>
            <span className="pill b"><span className="ic">●</span>v10<span className="lbl">target</span></span>
          </div>
          <div className="actions">
            <div className="ver-mode-toggle">
              <button>Side-by-side</button>
              <button className="is-active">Inline</button>
              <button>Visual</button>
            </div>
            <button className="btn ghost"><Icon name="download" size={12}/></button>
            <button className="btn secondary"><Icon name="history" size={12}/>Rollback to v9</button>
          </div>
        </div>

        <div className="ver-impact-strip">
          <div className="ver-impact-blk">
            <div className="lbl">CHANGES</div>
            <div className="v">+18 / −2 <span className="delta up">structural</span></div>
          </div>
          <div className="ver-impact-blk">
            <div className="lbl">NEW STAGE</div>
            <div className="v">pii-redact <span className="delta up">+1 transform</span></div>
          </div>
          <div className="ver-impact-blk">
            <div className="lbl">LATENCY P95</div>
            <div className="v">+4ms <span className="delta dn">acceptable</span></div>
          </div>
          <div className="ver-impact-blk">
            <div className="lbl">REGRESSION</div>
            <div className="v">none <span className="delta up">in 14d</span></div>
          </div>
        </div>

        <div className="ver-topo">
          <div className="ver-topo-h">TOPOLOGY · structural diff (1 transform added)</div>
          <div className="ver-topo-grid">
            <div className="ver-topo-side left">
              <div className="lbl">v9 · 3 stages</div>
              <div className="ver-topo-chain">
                <span className="ver-topo-node"><Icon name="kafka" size={11}/>kafka</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node"><Icon name="dedup" size={11}/>dedup · 5m</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node"><Icon name="ch" size={11}/>ch-primary</span>
              </div>
            </div>
            <div className="ver-topo-cmp">vs</div>
            <div className="ver-topo-side right">
              <div className="lbl">v10 · 4 stages</div>
              <div className="ver-topo-chain">
                <span className="ver-topo-node"><Icon name="kafka" size={11}/>kafka</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node add"><Icon name="filter" size={11}/>pii-redact ⊕</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node"><Icon name="dedup" size={11}/>dedup · 5m</span>
                <span className="ver-topo-arr">→</span>
                <span className="ver-topo-node"><Icon name="ch" size={11}/>ch-primary</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ver-diff" style={{gridTemplateColumns: '1fr'}}>
          <div className="ver-diff-pane">
            <div className="ver-diff-pane-h">
              <span>INLINE DIFF</span><span>·</span><span>v9 → v10</span>
              <span style={{marginLeft:'auto'}}>1 file · pipeline.yaml</span>
            </div>
            <div className="ver-diff-body">
              <div className="gutter">
                {Array.from({length: 24}, (_, i) => <div key={i}>{i+1}</div>)}
              </div>
              <pre className="code" dangerouslySetInnerHTML={{__html:
`<span class="k">name:</span> <span class="s">prod-orders-to-analytics</span>
<span class="rem"><span class="k">version:</span> <span class="n">9</span></span>
<span class="add"><span class="k">version:</span> <span class="n">10</span></span>

<span class="k">source:</span>
  <span class="k">type:</span> <span class="s">kafka</span>
  <span class="k">connection:</span> <span class="ref">$ref: kafka-prod-eu</span>
  <span class="k">topic:</span> <span class="s">"orders.placed"</span>

<span class="k">transforms:</span>
<span class="add">  - <span class="k">type:</span> <span class="s">field_redact</span>             <span class="c"># NEW</span></span>
<span class="add">    <span class="k">name:</span> <span class="s">pii-redact</span></span>
<span class="add">    <span class="k">fields:</span></span>
<span class="add">      - <span class="s">"card_pan"</span></span>
<span class="add">      - <span class="s">"cvv"</span></span>
<span class="add">      - <span class="s">"card_holder"</span></span>
<span class="add">      - <span class="s">"email"</span></span>
<span class="add">      - <span class="s">"phone"</span></span>
<span class="add">      - <span class="s">"billing_addr"</span></span>
  - <span class="k">type:</span> <span class="s">dedup</span>
    <span class="k">key:</span> <span class="s">"order_id"</span>
    <span class="k">window_ms:</span> <span class="n">300000</span>

<span class="k">sink:</span>
  <span class="k">type:</span> <span class="s">clickhouse</span>
  <span class="k">connection:</span> <span class="ref">$ref: ch-primary</span>
  <span class="k">table:</span> <span class="s">"analytics.orders"</span>
`
              }}/>
            </div>
          </div>
        </div>

        <div className="ver-foot">
          <div className="left">
            <b>1 hunk</b> · adds <code style={{color:'var(--color-orange-300)', fontFamily:"'JetBrains Mono', monospace"}}>field_redact</code> transform · saved to Library on deploy
          </div>
          <div className="right">
            <button className="btn ghost"><Icon name="link" size={12}/>Copy compare link</button>
            <button className="btn secondary">Restore v9 to draft</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// =================================================================
// ARTBOARD 3 — Rollback confirm modal
// =================================================================
const ArtVersionsRollback = () => (
  <div className="ver-page" style={{position:'relative'}}>
    <VerTopbar/>
    <VerPDH/>

    {/* dimmed background contents */}
    <div className="ver-main" style={{filter:'blur(0.5px) opacity(0.5)'}}>
      <div className="ver-list">
        <div className="ver-list-h">
          <div className="ttl">Version history<span className="ct">12 versions</span></div>
        </div>
        <div className="ver-timeline">
          <div className="ver-row deployed">
            <div className="marker"/>
            <div>
              <div className="head"><span className="v">v12</span><span className="badge live">LIVE · PROD</span><span className="when">2d ago</span></div>
              <div className="msg">Bump dedup window 5m → 10m</div>
            </div>
          </div>
          <div className="ver-row deployed">
            <div className="marker"/>
            <div>
              <div className="head"><span className="v">v11</span><span className="badge staging">PREV.</span><span className="when">8d ago</span></div>
              <div className="msg">Switch sink to ch-analytics-replica</div>
            </div>
          </div>
          <div className="ver-row deployed">
            <div className="marker"/>
            <div>
              <div className="head"><span className="v">v10</span><span className="badge staging">STAGING</span><span className="when">14d ago</span></div>
              <div className="msg">Add PII redact transform · 6 fields</div>
            </div>
          </div>
        </div>
      </div>
      <div className="ver-detail"/>
    </div>

    <div className="ver-modal-back">
      <div className="ver-modal">
        <div className="ver-modal-h">
          <div className="ic-row">
            <div className="ic"><Icon name="history" size={18}/></div>
            <h2>Roll back to v10?</h2>
          </div>
          <p className="sub">
            This will deploy <b>v10</b> as the new live version on prod, replacing v12.
            The current v12 will remain in history but no longer serve traffic.
          </p>
        </div>

        <div className="ver-modal-body">
          <div className="ver-modal-flow">
            <div className="pill from">
              <div className="lbl">CURRENT</div>
              <div className="v">v12 · live</div>
              <div className="when">deployed 2d ago by Marcus</div>
            </div>
            <div className="arr">↻</div>
            <div className="pill to">
              <div className="lbl">ROLLING BACK TO</div>
              <div className="v">v10</div>
              <div className="when">deployed 14d ago · ran 6d in prod</div>
            </div>
          </div>

          <div className="ver-impact-list">
            <div className="ttl">WHAT THIS REVERTS</div>
            <div className="item">
              <div className="ic rev">−</div>
              <div><b>Dedup window</b> reverts 10m → 5m. Late-arriving orders may appear as duplicates again.</div>
            </div>
            <div className="item">
              <div className="ic rev">−</div>
              <div><b>Sink</b> reverts <code style={{fontFamily:"'JetBrains Mono', monospace"}}>ch-analytics-replica</code> → <code style={{fontFamily:"'JetBrains Mono', monospace"}}>ch-primary</code>. Both are healthy; queries against the analytics replica will start to lag.</div>
            </div>
            <div className="item">
              <div className="ic"><Icon name="info" size={12}/></div>
              <div>Schema pin <b>OrderEvents v4</b> stays the same · no data migration needed.</div>
            </div>
            <div className="item">
              <div className="ic"><Icon name="info" size={12}/></div>
              <div>Estimated downtime: <b>&lt;2 seconds</b> · in-flight events drained, then cut over.</div>
            </div>
          </div>

          <div className="ver-confirm">
            <div className="lbl">Type <code>prod-orders-to-analytics</code> to confirm rollback on a production pipeline.</div>
            <input placeholder="pipeline name…"/>
          </div>
        </div>

        <div className="ver-modal-foot">
          <div className="hint">⌘ ↵ to confirm · ESC to cancel</div>
          <div className="actions">
            <button className="btn ghost">Cancel</button>
            <button className="btn danger" disabled>Roll back to v10</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// =================================================================
// ARTBOARD 4 — v1-only / first-deploy state
// =================================================================
const ArtVersionsEmpty = () => (
  <div className="ver-page">
    <VerTopbar/>
    <div className="ver-pdh">
      <div className="ver-crumbs">
        <a>Pipelines</a><span>/</span><span className="cur">staging-clickstream-rollup</span>
      </div>
      <div className="ver-pdh-row">
        <span className="ver-pip-dot"/>
        <h1>staging-clickstream-rollup</h1>
        <span className="chip-muted">staging</span>
        <span style={{fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:'var(--color-gray-dark-500)'}}>
          staging-clickstream-r-h2k9c
        </span>
        <div style={{flex:1}}/>
        <button className="btn ghost"><Icon name="stop" size={12}/>Pause</button>
        <button className="btn secondary"><Icon name="edit" size={12}/>Open in canvas</button>
      </div>
      <div className="ver-tabs">
        {[
          ["Overview", null], ["Canvas", null], ["Library links", null],
          ["Metrics", null], ["Logs", null], ["Versions", "1"], ["Settings", null],
        ].map(([t, ct]) => (
          <div key={t} className={`ver-tab ${t==='Versions'?'is-active':''}`}>
            {t}{ct && <span className="ct">{ct}</span>}
          </div>
        ))}
      </div>
    </div>

    <div className="ver-empty">
      <div className="ill"><Icon name="history" size={28}/></div>
      <h2>One version, no history yet</h2>
      <p>
        This pipeline was deployed once and hasn't been edited since.
        When you make changes — either by editing the canvas, asking the AI, or deploying a new YAML —
        a new version will appear here. You can compare any two versions side-by-side
        and roll back at any time.
      </p>

      <div className="v1-card">
        <div className="marker">v1</div>
        <div className="info">
          <div className="h">Initial deploy<span className="badge">LIVE · STAGING</span></div>
          <div className="meta">deployed 6 hours ago · by Vanessa C. · from template <code style={{color:'var(--color-orange-300)'}}>kafka-rollup</code></div>
        </div>
        <button className="btn ghost"><Icon name="download" size={12}/></button>
      </div>

      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button className="btn secondary"><Icon name="edit" size={12}/>Edit pipeline</button>
        <button className="btn ghost">View v1 YAML</button>
      </div>
    </div>
  </div>
);

Object.assign(window, {
  ArtVersionsTimeline,
  ArtVersionsBigDiff,
  ArtVersionsRollback,
  ArtVersionsEmpty,
});
