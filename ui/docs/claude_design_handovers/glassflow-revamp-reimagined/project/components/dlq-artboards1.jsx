// DLQ Replay artboards (Phase B · T-DLQ)
// 6 artboards in one canvas, plus a small primitives header.

const { useState } = React;

// =====================================================================
// PRIMITIVES — local to this surface
// =====================================================================

// Top-nav crumbs (cross-pipeline) or pipeline-scoped crumbs
const DLQCrumbs = ({ pipeline }) => (
  <div className="dlq-crumbs">
    <Icon name="pipelines" size={12}/>
    <a>Pipelines</a>
    {pipeline ? (
      <>
        <Icon name="chevR" size={10}/><a>{pipeline}</a>
        <Icon name="chevR" size={10}/><strong>Dead-letter queue</strong>
      </>
    ) : (
      <>
        <Icon name="chevR" size={10}/><strong>Dead-letter queue</strong>
        <span className="sep" style={{opacity:0.4}}>·</span>
        <span style={{color:'var(--color-gray-dark-500)'}}>across all pipelines</span>
      </>
    )}
  </div>
);

const DLQTitleRow = ({ title, meta, env="prod", right }) => (
  <div className="dlq-titlerow">
    <h1>{title}</h1>
    {meta && <span className="meta">{meta}</span>}
    <span className="chip chip-warning" style={{textTransform:'lowercase', letterSpacing:0.04}}>{env}</span>
    <div className="spacer"/>
    {right}
  </div>
);

const DLQKpi = ({ label, value, unit, delta, deltaTone, tone, icon }) => (
  <div className={"dlq-kpi" + (tone?` tone-${tone}`:'')}>
    <div className="lbl">{icon && <Icon name={icon} size={11}/>}{label}</div>
    <div className="val">{value}{unit && <span className="unit">{unit}</span>}</div>
    {delta && <div className={"delta" + (deltaTone?` ${deltaTone}`:'')}>{delta}</div>}
  </div>
);

// Generic search/filter toolbar
const DLQToolbar = ({ children, search, leftPills, rightActions }) => (
  <div className="dlq-toolbar">
    {search !== false && (
      <div className="dlq-search">
        <Icon name="search" size={13} color="var(--color-gray-dark-500)"/>
        {search ? <span>{search}</span> : <span className="ph">error contains "schema" OR key:user_id…</span>}
        <span className="cursor"/>
      </div>
    )}
    {leftPills}
    <div className="grow"/>
    {rightActions}
    {children}
  </div>
);

// Filter pill (e.g. "error: SchemaValidation")
const DLQFilterPill = ({ label, value, active, removable }) => (
  <span className={"dlq-pill" + (active?' is-active':'')}>
    <span className="label">{label}:</span><span className="val">{value}</span>
    {removable && <Icon name="x" size={10} color="var(--color-gray-dark-500)"/>}
    {!removable && <Icon name="chevD" size={10} color="var(--color-gray-dark-500)"/>}
  </span>
);

// Pipeline status pill (running/error/etc) — local thin wrapper
const DLQStatusDot = ({ status="running" }) => (
  <span className={"br-pip-dot br-pip-" + status}/>
);

// =====================================================================
// ARTBOARD 1 — Cross-pipeline DLQ inbox
// =====================================================================
const ArtDLQInbox = () => {
  return (
    <div className="dlq-page" data-screen-label="DLQ Inbox · cross-pipeline">
      <div className="dlq-inner">
        <DLQCrumbs/>
        <DLQTitleRow
          title="Dead-letter queue"
          meta="last 24h · all envs · 14 pipelines"
          right={<>
            <button className="dlq-btn">Audit log</button>
            <button className="dlq-btn">Settings</button>
          </>}
        />
        <p className="dlq-sub">Messages that failed to process and were diverted to DLQ. Pick a pipeline to triage individual events, or replay/discard from here in bulk.</p>

        {/* KPIs across all pipelines */}
        <div className="dlq-kpis">
          <DLQKpi tone="bad"  label="Total backlog"  icon="warn" value="2,847"  delta="+412 in last 1h" deltaTone="up"/>
          <DLQKpi tone="warn" label="Pipelines affected" icon="pipelines" value="3" unit="/ 14" delta="checkout-orders just joined"/>
          <DLQKpi               label="Replayed today" icon="reload" value="1,204" delta="98.4% succeeded" deltaTone="down"/>
          <DLQKpi tone="good" label="Mean age"       icon="info" value="4m 12s" delta="oldest: 38m" />
        </div>

        {/* AI cluster summary banner */}
        <div className="dlq-listframe" style={{marginBottom: 14}}>
          <div className="dlq-ai-banner">
            <div className="ic"><Icon name="sparkles" size={15}/></div>
            <div className="body">
              <h4>3 error clusters explain 96% of today's DLQ <span className="tag"><Icon name="sparkles" size={9}/>AI summary</span></h4>
              <p>
                <strong>2,194 messages (77%)</strong> on <code>user-events-enrich</code> are failing because <code>postgres-users</code> connection-pool is saturated (40/40). <strong>521 (18%)</strong> on the same pipeline are <code>SchemaValidation</code> errors after the v18 deploy — field <code>user_id</code> is now required. <strong>104 (4%)</strong> on <code>orders-cdc</code> are transient ClickHouse 429s. Recommended: pause new ingest on <code>user-events-enrich</code>, fix pool, then bulk-replay.
              </p>
              <div className="actions">
                <button className="dlq-btn"><Icon name="sparkles" size={12}/>Investigate with AI</button>
                <button className="dlq-btn">Show clusters</button>
                <button className="dlq-btn btn-quiet">Dismiss</button>
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline list */}
        <div className="dlq-inbox">

          <div className="dlq-pipe is-bad">
            <div className="ident">
              <div className="name"><DLQStatusDot status="error"/>user-events-enrich</div>
              <div className="meta">
                <span>v18 · 8c4ad21</span><span className="sep">·</span>
                <span>kafka → postgres → ch</span>
              </div>
              <div className="since">first failure 38m ago · still flowing in</div>
            </div>
            <div className="clusters">
              <div className="head">Top error clusters <span className="ai"><Icon name="sparkles" size={9}/>grouped by AI</span></div>
              <div className="cluster-row">
                <span className="count">2,194</span>
                <span className="desc"><strong>EnrichmentTimeout</strong> — postgres-users pool exhausted (40/40)</span>
                <span className="age">38m</span>
              </div>
              <div className="cluster-row">
                <span className="count">521</span>
                <span className="desc"><strong>SchemaValidation</strong> — required field <code style={{fontFamily:'inherit', color:'var(--color-orange-300)'}}>user_id</code> missing</span>
                <span className="age">2h 14m</span>
              </div>
              <div className="cluster-row">
                <span className="count">28</span>
                <span className="desc"><strong>JSONParse</strong> — unexpected token at byte 1242</span>
                <span className="age">1h</span>
              </div>
            </div>
            <div className="actions">
              <div className="total">2,743<span className="small">msgs</span></div>
              <div className="row">
                <button className="dlq-btn btn-primary">Open</button>
                <button className="dlq-btn">Replay all</button>
              </div>
            </div>
          </div>

          <div className="dlq-pipe is-warn">
            <div className="ident">
              <div className="name"><DLQStatusDot status="running"/>orders-cdc</div>
              <div className="meta">
                <span>v9 · 47ab103</span><span className="sep">·</span>
                <span>postgres → kafka → ch</span>
              </div>
              <div className="since">first failure 12m ago · running</div>
            </div>
            <div className="clusters">
              <div className="head">Top error clusters</div>
              <div className="cluster-row">
                <span className="count">104</span>
                <span className="desc"><strong>ClickHouseTooMany</strong> — 429 from ch-prod (rate-limited insert)</span>
                <span className="age">12m</span>
              </div>
              <div className="cluster-row">
                <span className="count">12</span>
                <span className="desc"><strong>NetworkTimeout</strong> — connection reset on insert</span>
                <span className="age">8m</span>
              </div>
            </div>
            <div className="actions">
              <div className="total">116<span className="small">msgs</span></div>
              <div className="row">
                <button className="dlq-btn btn-primary">Open</button>
                <button className="dlq-btn">Replay all</button>
              </div>
            </div>
          </div>

          <div className="dlq-pipe is-bad">
            <div className="ident">
              <div className="name"><DLQStatusDot status="error"/>checkout-orders</div>
              <div className="meta">
                <span>v12 · a91dee0</span><span className="sep">·</span>
                <span>kafka → ch</span>
              </div>
              <div className="since">first failure 4m ago · just started</div>
            </div>
            <div className="clusters">
              <div className="head">Top error clusters</div>
              <div className="cluster-row">
                <span className="count">8</span>
                <span className="desc"><strong>ClickHouseTooMany</strong> — same root cause as orders-cdc</span>
                <span className="age">4m</span>
              </div>
            </div>
            <div className="actions">
              <div className="total">8<span className="small">msgs</span></div>
              <div className="row">
                <button className="dlq-btn btn-primary">Open</button>
                <button className="dlq-btn">Replay all</button>
              </div>
            </div>
          </div>

          <div className="dlq-pipe is-clean">
            <div className="ident">
              <div className="name"><DLQStatusDot status="running"/>shopify-webhooks</div>
              <div className="meta">
                <span>v3 · 2fbb89a</span><span className="sep">·</span>
                <span>http → kafka → ch</span>
              </div>
              <div className="since">no DLQ activity in 24h</div>
            </div>
            <div className="clusters">
              <div className="head">No errors</div>
              <div className="cluster-row" style={{opacity:0.6}}>
                <span className="count" style={{color:'var(--color-green-500)'}}>0</span>
                <span className="desc">Last replay 6d ago · all succeeded</span>
                <span className="age">—</span>
              </div>
            </div>
            <div className="actions">
              <div className="total">0<span className="small">msgs</span></div>
              <div className="row">
                <button className="dlq-btn btn-quiet" disabled>Open</button>
              </div>
            </div>
          </div>

          {/* secondary, collapsed pipelines summary */}
          <div className="dlq-pipe is-clean" style={{gridTemplateColumns:'1fr', padding:'10px 18px'}}>
            <div className="ident" style={{flexDirection:'row', alignItems:'center', gap: 12}}>
              <Icon name="check" size={14} color="var(--color-green-500)"/>
              <span style={{fontSize:12.5, color:'var(--color-gray-dark-100)'}}>10 other pipelines · all clean in last 24h</span>
              <span style={{flex:1}}/>
              <span style={{fontSize:11, color:'var(--color-gray-dark-500)', cursor:'pointer'}}>Show all <Icon name="chevD" size={10}/></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// ARTBOARD 2 — Per-pipeline DLQ list (with cluster-mode + filters)
// =====================================================================
const ArtDLQList = () => {
  return (
    <div className="dlq-page" data-screen-label="DLQ List · per-pipeline">
      <div className="dlq-inner">
        <DLQCrumbs pipeline="user-events-enrich"/>
        <DLQTitleRow
          title="Dead-letter queue"
          meta="2,743 messages · oldest 38m · v18 (current)"
          right={<>
            <button className="dlq-btn"><Icon name="reload" size={12}/>Resume ingest</button>
            <button className="dlq-btn">Open metrics</button>
            <button className="dlq-btn">Logs</button>
          </>}
        />

        {/* Toolbar */}
        <div className="dlq-toolbar">
          <div className="dlq-search">
            <Icon name="search" size={13} color="var(--color-gray-dark-500)"/>
            <span>error:</span>
            <span style={{color:'var(--color-foreground-neutral)'}}>EnrichmentTimeout</span>
            <span className="cursor"/>
          </div>
          <DLQFilterPill label="error" value="EnrichmentTimeout" active removable/>
          <DLQFilterPill label="when"  value="last 1h" active removable/>
          <DLQFilterPill label="stage" value="all"/>
          <div className="grow"/>
          <div className="seg">
            <button className="is-active"><Icon name="dedup" size={11}/>Clusters</button>
            <button><Icon name="schema" size={11}/>Flat</button>
          </div>
          <button className="dlq-btn">More <Icon name="chevD" size={10}/></button>
        </div>

        <div className="dlq-listframe">

          {/* AI cluster banner — narrow form */}
          <div className="dlq-ai-banner">
            <div className="ic"><Icon name="sparkles" size={15}/></div>
            <div className="body">
              <h4>Why is this happening? <span className="tag"><Icon name="sparkles" size={9}/>AI</span></h4>
              <p>
                <code>postgres-users</code> connection pool has been at <strong>40/40</strong> since 11:14. The enrich step times out after 5s waiting for a connection, and the message moves to DLQ. <strong>Fix:</strong> raise pool to 80, or pause ingest for ~3 min while existing connections drain. Once pool is healthy, replay-as-is should succeed for ≥95% of these messages.
              </p>
              <div className="actions">
                <button className="dlq-btn btn-primary"><Icon name="sparkles" size={12}/>Apply suggestion</button>
                <button className="dlq-btn">Show pool metrics</button>
                <button className="dlq-btn btn-quiet">Tell me more</button>
              </div>
            </div>
          </div>

          {/* Bulk action bar */}
          <div className="dlq-bulkbar">
            <span className="num">2,194 selected</span>
            <span style={{color:'var(--color-gray-dark-500)'}}>· cluster: EnrichmentTimeout · est. replay time 3m 40s</span>
            <span className="grow"/>
            <button className="dlq-btn btn-primary"><Icon name="reload" size={12}/>Replay as-is</button>
            <button className="dlq-btn btn-danger"><Icon name="trash" size={12}/>Discard</button>
            <button className="dlq-btn btn-quiet">Export…</button>
            <button className="dlq-btn btn-quiet"><Icon name="x" size={12}/></button>
          </div>

          {/* Cluster: opened */}
          <div className="dlq-cluster">
            <div className="dlq-cluster-h is-open">
              <span className="chev"><Icon name="chevR" size={14}/></span>
              <span className="pat">
                <span className="err">EnrichmentTimeout</span>
                <span className="arrow">→</span>
                <span>postgres-users · pool exhausted (40/40)</span>
              </span>
              <span className="count">2,194</span>
              <span className="age">first 38m ago · still arriving</span>
              <span className="quick">
                <button className="dlq-btn btn-quiet" style={{padding:'4px 8px'}}><Icon name="reload" size={11}/>Replay</button>
                <button className="dlq-btn btn-quiet" style={{padding:'4px 8px'}}><Icon name="trash" size={11}/></button>
              </span>
            </div>
            <div className="dlq-list-head">
              <span className="check"/>
              <span>received</span>
              <span>attempts</span>
              <span>summary</span>
              <span>stage</span>
              <span>last error</span>
            </div>
            <div className="dlq-rows">
              <DLQRowSelected ts="11:52:18.041" attempts="3/3" key1="user_id" key1v="u_8a14e2"  stage="enrich · pg-users" lastErr="38m ago"/>
              <DLQRowActive   ts="11:52:18.027" attempts="3/3" key1="user_id" key1v="u_4f203a"  stage="enrich · pg-users" lastErr="38m ago"/>
              <DLQRowSelected ts="11:52:17.998" attempts="3/3" key1="user_id" key1v="u_c91008"  stage="enrich · pg-users" lastErr="38m ago"/>
              <DLQRowSelected ts="11:52:17.961" attempts="3/3" key1="user_id" key1v="u_27aa1b"  stage="enrich · pg-users" lastErr="38m ago"/>
              <DLQRowSelected ts="11:52:17.933" attempts="3/3" key1="user_id" key1v="u_91ee05"  stage="enrich · pg-users" lastErr="38m ago"/>
              <DLQRowSelected ts="11:52:17.910" attempts="3/3" key1="user_id" key1v="u_6f4c12"  stage="enrich · pg-users" lastErr="38m ago"/>
              <DLQRowSelected ts="11:52:17.887" attempts="2/3" key1="user_id" key1v="u_2a8eef"  stage="enrich · pg-users" lastErr="38m ago"/>
              <div style={{padding:'8px 18px', fontSize:11, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', background:'#0a0a0d', borderTop:'1px solid var(--color-gray-dark-900)'}}>
                ⋯ 2,187 more in this cluster
              </div>
            </div>
          </div>

          {/* Cluster: closed */}
          <div className="dlq-cluster">
            <div className="dlq-cluster-h">
              <span className="chev"><Icon name="chevR" size={14}/></span>
              <span className="pat">
                <span className="err">SchemaValidation</span>
                <span className="arrow">→</span>
                <span>required field <span style={{color:'var(--color-orange-300)'}}>user_id</span> missing</span>
              </span>
              <span className="count">521</span>
              <span className="age">2h 14m ago</span>
              <span className="quick">
                <button className="dlq-btn btn-quiet" style={{padding:'4px 8px'}}><Icon name="reload" size={11}/>Replay</button>
                <button className="dlq-btn btn-quiet" style={{padding:'4px 8px'}}><Icon name="trash" size={11}/></button>
              </span>
            </div>
          </div>

          <div className="dlq-cluster">
            <div className="dlq-cluster-h">
              <span className="chev"><Icon name="chevR" size={14}/></span>
              <span className="pat">
                <span className="err">JSONParse</span>
                <span className="arrow">→</span>
                <span>unexpected token at byte 1242 (likely truncated event)</span>
              </span>
              <span className="count">28</span>
              <span className="age">1h ago</span>
              <span className="quick">
                <button className="dlq-btn btn-quiet" style={{padding:'4px 8px'}}><Icon name="reload" size={11}/>Replay</button>
                <button className="dlq-btn btn-quiet" style={{padding:'4px 8px'}}><Icon name="trash" size={11}/></button>
              </span>
            </div>
          </div>

          <div className="dlq-listfoot">
            <span>3 clusters · 2,743 messages</span>
            <span className="grow"/>
            <span>page 1 of 1</span>
            <button className="dlq-btn btn-quiet" style={{padding:'4px 8px'}}><Icon name="download" size={11}/>Export selection</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// row component variants
const DLQRow = ({ ts, attempts, key1, key1v, stage, lastErr, className="" }) => (
  <div className={"dlq-row " + className}>
    <span className="check"/>
    <span className="ts">{ts}</span>
    <span className="attempts">{attempts}</span>
    <span className="summary">
      <span style={{color:'var(--color-gray-dark-500)'}}>{key1}: </span>
      <span className="key">{key1v}</span>
    </span>
    <span className="attempts">{stage.split('·')[0].trim()}</span>
    <span className="ts">{lastErr}</span>
  </div>
);
const DLQRowSelected = (props) => (
  <div className="dlq-row is-selected">
    <span className="check"><Icon name="check" size={10} color="var(--color-black)"/></span>
    <span className="ts">{props.ts}</span>
    <span className="attempts">{props.attempts}</span>
    <span className="summary">
      <span style={{color:'var(--color-gray-dark-500)'}}>{props.key1}: </span>
      <span className="key">{props.key1v}</span>
    </span>
    <span className="attempts">{props.stage}</span>
    <span className="ts">{props.lastErr}</span>
  </div>
);
const DLQRowActive = (props) => (
  <div className="dlq-row is-active is-selected">
    <span className="check"><Icon name="check" size={10} color="var(--color-black)"/></span>
    <span className="ts">{props.ts}</span>
    <span className="attempts">{props.attempts}</span>
    <span className="summary">
      <span style={{color:'var(--color-gray-dark-500)'}}>{props.key1}: </span>
      <span className="key">{props.key1v}</span>
    </span>
    <span className="attempts">{props.stage}</span>
    <span className="ts">{props.lastErr}</span>
  </div>
);

Object.assign(window, {
  DLQCrumbs, DLQTitleRow, DLQKpi, DLQToolbar, DLQFilterPill, DLQStatusDot,
  DLQRow, DLQRowSelected, DLQRowActive,
  ArtDLQInbox, ArtDLQList,
});
