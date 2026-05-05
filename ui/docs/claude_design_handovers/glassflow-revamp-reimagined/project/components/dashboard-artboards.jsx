// Dashboard artboards — System overview, attention queue, pipeline status table
// 4 artboards: Populated · All-healthy · Multi-incident · First-run empty

// =============== shared bits ================
const Spark = ({ data, color = "var(--color-gray-dark-100)", w = 64, h = 24 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} className="spark">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const ThruChart = ({ height = 140 }) => {
  const w = 640, h = height, pad = 8;
  const N = 60;
  // Generate two streams (in / out) with light noise
  const ins = Array.from({length: N}, (_, i) => 720 + Math.sin(i/4)*120 + Math.cos(i/9)*80 + (i*2));
  const outs = ins.map((v, i) => v - 18 - Math.sin(i/3.5)*18);
  const all = [...ins, ...outs];
  const max = Math.max(...all) * 1.1;
  const stepX = (w - pad*2) / (N - 1);
  const yFor = v => h - pad - (v / max) * (h - pad*2);
  const polyIn = ins.map((v, i) => `${pad + i*stepX},${yFor(v)}`).join(" ");
  const polyOut = outs.map((v, i) => `${pad + i*stepX},${yFor(v)}`).join(" ");
  const areaIn = `${pad},${h-pad} ${polyIn} ${pad + (N-1)*stepX},${h-pad}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:'block'}}>
      <defs>
        <linearGradient id="thruGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-orange-300)" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="var(--color-orange-300)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* baseline grid */}
      {[0.25, 0.5, 0.75].map(p => (
        <line key={p} x1={pad} x2={w-pad} y1={pad + p*(h-pad*2)} y2={pad + p*(h-pad*2)} stroke="var(--color-gray-dark-800)" strokeDasharray="2 4"/>
      ))}
      <polygon points={areaIn} fill="url(#thruGrad)"/>
      <polyline points={polyIn} fill="none" stroke="var(--color-orange-300)" strokeWidth="1.5"/>
      <polyline points={polyOut} fill="none" stroke="var(--color-blue-500)" strokeWidth="1.5" strokeDasharray="3 3"/>
    </svg>
  );
};

const StatusChip = ({ kind, label }) => (
  <span className={`status-chip ${kind}`}><span className="dot"/>{label}</span>
);

// ============================================================
// ARTBOARD 1 — Populated dashboard (the default state)
// ============================================================
const ArtDashPopulated = () => (
  <div className="app-shell">
    <DashTopbar/>
    <div className="dash-page">
      <div className="dash-header">
        <div className="dash-header-l">
          <h1>Good afternoon, Vanessa</h1>
          <p className="greet">3 things need your attention · 14 pipelines active</p>
        </div>
        <div className="dash-header-r">
          <div className="dash-pill"><span className="label">env</span><span className="val">production</span><Icon name="chevD" size={12}/></div>
          <div className="dash-pill"><span className="label">range</span><span className="val">last 1h</span><Icon name="chevD" size={12}/></div>
          <div className="dash-pill is-primary"><Icon name="plus" size={13}/>New pipeline</div>
        </div>
      </div>

      <div className="dash-kpis">
        <div className="dash-kpi">
          <div className="label"><Icon name="pipelines" size={11}/>Active pipelines</div>
          <div className="value">14<span className="unit">/ 16 total</span></div>
          <span className="delta flat">— no change · 1h</span>
          <div className="spark"><Spark data={[14,14,15,14,14,14,14,14,14,14,14,14]} color="var(--color-gray-dark-100)"/></div>
        </div>
        <div className="dash-kpi">
          <div className="label"><Icon name="otlp" size={11}/>Events / sec</div>
          <div className="value">42.6k<span className="unit">in</span></div>
          <span className="delta up"><Icon name="chevR" size={10} color="var(--color-green-500)"/>+8.2% · 1h</span>
          <div className="spark"><Spark data={[38,39,38,40,41,40,42,43,42,43,42,43]} color="var(--color-orange-300)"/></div>
        </div>
        <div className="dash-kpi is-warn">
          <div className="label"><Icon name="warn" size={11}/>Error rate</div>
          <div className="value">0.34<span className="unit">%</span></div>
          <span className="delta down"><Icon name="chevR" size={10} color="var(--color-red-500)"/>+0.21% · 1h</span>
          <div className="spark"><Spark data={[0.1,0.1,0.12,0.18,0.2,0.2,0.25,0.28,0.3,0.32,0.34,0.34]} color="var(--color-yellow-400)"/></div>
        </div>
        <div className="dash-kpi is-crit">
          <div className="label"><Icon name="warn" size={11}/>DLQ events</div>
          <div className="value">2,847</div>
          <span className="delta down"><Icon name="chevR" size={10} color="var(--color-red-500)"/>+412 · 1h</span>
          <div className="spark"><Spark data={[1900,2000,2080,2150,2280,2400,2500,2600,2680,2740,2800,2847]} color="var(--color-red-500)"/></div>
        </div>
        <div className="dash-kpi">
          <div className="label"><Icon name="info" size={11}/>Avg lag</div>
          <div className="value">1.2<span className="unit">s · p95</span></div>
          <span className="delta flat">stable</span>
          <div className="spark"><Spark data={[1.1,1.2,1.1,1.3,1.2,1.2,1.1,1.2,1.2,1.3,1.2,1.2]} color="var(--color-gray-dark-100)"/></div>
        </div>
      </div>

      <div className="dash-main">
        {/* attention queue */}
        <div className="dash-card">
          <div className="dash-card-h">
            <div>
              <h3>Needs your attention</h3>
              <span className="count">3 incidents</span>
            </div>
            <div className="actions"><span className="link">View all</span></div>
          </div>
          <div className="attn-list">
            <div className="attn-row crit">
              <div className="stripe"/>
              <div className="icon"><Icon name="warn" size={14}/></div>
              <div className="attn-body">
                <div className="title"><span className="pipe">orders-to-clickhouse</span>DLQ growing — schema mismatch on <code style={{fontFamily:'JetBrains Mono', fontSize:11, color:'var(--color-orange-300)'}}>user_id</code></div>
                <div className="desc">412 events failed in the last hour. Source emits <code style={{fontSize:11}}>String</code>, target expects <code style={{fontSize:11}}>UInt64</code>. Suggested: cast in transform, or update ClickHouse column.</div>
                <div className="meta">
                  <span>started 47m ago</span><span className="sep">·</span>
                  <span>412 events</span><span className="sep">·</span>
                  <span>v12 · revision 2025-05-04</span>
                </div>
              </div>
              <div className="cta"><Icon name="play" size={11}/>Fix it</div>
            </div>

            <div className="attn-row warn">
              <div className="stripe"/>
              <div className="icon"><Icon name="drift" size={14}/></div>
              <div className="attn-body">
                <div className="title"><span className="pipe">events-stream-prod</span>Schema <code style={{fontSize:11}}>orders.v4</code> drift detected</div>
                <div className="desc">Source has added 2 new fields (<code style={{fontSize:11}}>currency</code>, <code style={{fontSize:11}}>region</code>). Pipeline pinned to v3 — silently dropped today: 12,440 events.</div>
                <div className="meta">
                  <span>detected 2h ago</span><span className="sep">·</span>
                  <span>affects 3 pipelines</span><span className="sep">·</span>
                  <span>2 new fields</span>
                </div>
              </div>
              <div className="cta">Review drift</div>
            </div>

            <div className="attn-row info">
              <div className="stripe"/>
              <div className="icon"><Icon name="history" size={14}/></div>
              <div className="attn-body">
                <div className="title"><span className="pipe">analytics-otlp-logs</span>Deploy v8 stuck in validating</div>
                <div className="desc">ClickHouse insert validation hasn't completed in 4 minutes. Pipeline still running on v7. Safe to retry or roll back.</div>
                <div className="meta">
                  <span>started 4m ago</span><span className="sep">·</span>
                  <span>deployed by daniel.k</span><span className="sep">·</span>
                  <span>autorollback in 6m</span>
                </div>
              </div>
              <div className="cta">Inspect</div>
            </div>
          </div>
        </div>

        <div className="side-stack">
          {/* throughput chart */}
          <div className="dash-card thru-card">
            <div className="dash-card-h" style={{padding: 0, marginBottom: 12, borderBottom: 'none'}}>
              <h3>Throughput</h3>
              <span className="link">Open in observability →</span>
            </div>
            <div className="thru-totals">
              <div className="blk"><div className="lbl">In · last hour</div><div className="val">153.4M<span className="u">events</span></div></div>
              <div className="blk"><div className="lbl">Out · last hour</div><div className="val">152.8M<span className="u">events</span></div></div>
              <div className="blk"><div className="lbl">Loss</div><div className="val" style={{color:'var(--color-yellow-400)'}}>0.39<span className="u">%</span></div></div>
            </div>
            <ThruChart height={130}/>
            <div className="thru-legend">
              <div><span className="swatch" style={{background:'var(--color-orange-300)'}}/>events in</div>
              <div><span className="swatch" style={{background:'var(--color-blue-500)'}}/>events written to ClickHouse</div>
            </div>
          </div>

          {/* recent activity */}
          <div className="dash-card">
            <div className="dash-card-h">
              <h3>Recent activity</h3>
              <span className="link">View log →</span>
            </div>
            <div className="activity-list">
              <div className="activity-row"><span className="dot deploy"/><div className="text"><b>maria.a</b> deployed <span className="pipe">orders-to-clickhouse</span> v12</div><div className="when">14m ago</div></div>
              <div className="activity-row"><span className="dot info"/><div className="text">Schema <span className="pipe">orders.v4</span> published — 3 pipelines flagged for drift</div><div className="when">2h ago</div></div>
              <div className="activity-row"><span className="dot fail"/><div className="text"><span className="pipe">analytics-otlp-logs</span> deploy v8 entered <b>validating</b> state</div><div className="when">4m ago</div></div>
              <div className="activity-row"><span className="dot deploy"/><div className="text"><b>daniel.k</b> rolled back <span className="pipe">stripe-payments-cdc</span> to v6</div><div className="when">3h ago</div></div>
              <div className="activity-row"><span className="dot pause"/><div className="text"><b>vanessa.c</b> paused <span className="pipe">test-events-staging</span></div><div className="when">5h ago</div></div>
            </div>
          </div>
        </div>
      </div>

      <PipelineTable rows={populatedRows} active="all"/>
    </div>
  </div>
);

// ============================================================
// ARTBOARD 2 — All healthy state
// ============================================================
const ArtDashHealthy = () => (
  <div className="app-shell">
    <DashTopbar/>
    <div className="dash-page">
      <div className="dash-header">
        <div className="dash-header-l">
          <h1>Good morning, Vanessa</h1>
          <p className="greet">Everything's running smoothly · 14 pipelines active</p>
        </div>
        <div className="dash-header-r">
          <div className="dash-pill"><span className="label">env</span><span className="val">production</span><Icon name="chevD" size={12}/></div>
          <div className="dash-pill"><span className="label">range</span><span className="val">last 1h</span><Icon name="chevD" size={12}/></div>
          <div className="dash-pill is-primary"><Icon name="plus" size={13}/>New pipeline</div>
        </div>
      </div>

      <div className="healthy-banner">
        <div className="ic"><Icon name="check" size={18}/></div>
        <div className="body">
          <div className="t">All pipelines healthy</div>
          <div className="d">No incidents in the last 24 hours · No schema drift · DLQ stable at 0.02% of throughput</div>
        </div>
        <div className="meta">last incident · 4d 12h ago</div>
      </div>

      <div className="dash-kpis">
        <div className="dash-kpi">
          <div className="label"><Icon name="pipelines" size={11}/>Active pipelines</div>
          <div className="value">14<span className="unit">/ 14</span></div>
          <span className="delta flat">all running</span>
          <div className="spark"><Spark data={[14,14,14,14,14,14,14,14,14,14,14,14]}/></div>
        </div>
        <div className="dash-kpi">
          <div className="label"><Icon name="otlp" size={11}/>Events / sec</div>
          <div className="value">38.1k<span className="unit">in</span></div>
          <span className="delta up"><Icon name="chevR" size={10} color="var(--color-green-500)"/>+2.1% · 1h</span>
          <div className="spark"><Spark data={[36,37,37,38,38,38,38,38,38,38,38,38]} color="var(--color-orange-300)"/></div>
        </div>
        <div className="dash-kpi">
          <div className="label"><Icon name="check" size={11}/>Error rate</div>
          <div className="value" style={{color:'var(--color-green-500)'}}>0.02<span className="unit">%</span></div>
          <span className="delta up" style={{color:'var(--color-green-500)'}}>at baseline</span>
          <div className="spark"><Spark data={[0.02,0.02,0.02,0.03,0.02,0.02,0.02,0.02,0.02,0.02,0.02,0.02]} color="var(--color-green-500)"/></div>
        </div>
        <div className="dash-kpi">
          <div className="label"><Icon name="info" size={11}/>DLQ events</div>
          <div className="value">8</div>
          <span className="delta flat">stable</span>
          <div className="spark"><Spark data={[6,7,8,7,8,8,8,8,7,8,8,8]}/></div>
        </div>
        <div className="dash-kpi">
          <div className="label"><Icon name="info" size={11}/>Avg lag</div>
          <div className="value">340<span className="unit">ms · p95</span></div>
          <span className="delta flat">stable</span>
          <div className="spark"><Spark data={[330,340,340,335,340,345,340,340,335,340,340,340]}/></div>
        </div>
      </div>

      <PipelineTable rows={healthyRows} active="all"/>
    </div>
  </div>
);

// ============================================================
// ARTBOARD 3 — Multi-incident state
// ============================================================
const ArtDashIncidents = () => (
  <div className="app-shell">
    <DashTopbar/>
    <div className="dash-page">
      <div className="dash-header">
        <div className="dash-header-l">
          <h1>Several pipelines need attention</h1>
          <p className="greet" style={{color:'var(--color-red-500)'}}>2 critical · 3 warnings · 1 deploy in progress</p>
        </div>
        <div className="dash-header-r">
          <div className="dash-pill"><span className="label">env</span><span className="val">production</span><Icon name="chevD" size={12}/></div>
          <div className="dash-pill"><span className="label">range</span><span className="val">last 1h</span><Icon name="chevD" size={12}/></div>
          <div className="dash-pill is-primary"><Icon name="plus" size={13}/>New pipeline</div>
        </div>
      </div>

      <div className="dash-kpis">
        <div className="dash-kpi is-warn">
          <div className="label"><Icon name="pipelines" size={11}/>Active pipelines</div>
          <div className="value">11<span className="unit">/ 14</span></div>
          <span className="delta down"><Icon name="chevR" size={10} color="var(--color-red-500)"/>3 degraded</span>
        </div>
        <div className="dash-kpi">
          <div className="label"><Icon name="otlp" size={11}/>Events / sec</div>
          <div className="value">28.4k<span className="unit">in</span></div>
          <span className="delta down"><Icon name="chevR" size={10} color="var(--color-red-500)"/>−33% · 1h</span>
          <div className="spark"><Spark data={[42,42,40,38,36,34,32,30,29,28,28,28]} color="var(--color-yellow-400)"/></div>
        </div>
        <div className="dash-kpi is-crit">
          <div className="label"><Icon name="warn" size={11}/>Error rate</div>
          <div className="value">3.81<span className="unit">%</span></div>
          <span className="delta down"><Icon name="chevR" size={10} color="var(--color-red-500)"/>+3.59% · 1h</span>
          <div className="spark"><Spark data={[0.2,0.4,0.8,1.2,1.8,2.2,2.6,3.0,3.4,3.6,3.8,3.81]} color="var(--color-red-500)"/></div>
        </div>
        <div className="dash-kpi is-crit">
          <div className="label"><Icon name="warn" size={11}/>DLQ events</div>
          <div className="value">14,029</div>
          <span className="delta down"><Icon name="chevR" size={10} color="var(--color-red-500)"/>+8.2k · 1h</span>
          <div className="spark"><Spark data={[5800,6500,7200,8100,9000,9900,11000,12000,12800,13400,13800,14029]} color="var(--color-red-500)"/></div>
        </div>
        <div className="dash-kpi is-warn">
          <div className="label"><Icon name="info" size={11}/>Avg lag</div>
          <div className="value">8.4<span className="unit">s · p95</span></div>
          <span className="delta down"><Icon name="chevR" size={10} color="var(--color-red-500)"/>+7.2s · 1h</span>
          <div className="spark"><Spark data={[1.2,1.4,1.8,2.5,3.4,4.6,5.8,6.8,7.4,8.0,8.3,8.4]} color="var(--color-yellow-400)"/></div>
        </div>
      </div>

      <div className="dash-main">
        <div className="dash-card">
          <div className="dash-card-h">
            <div>
              <h3>Needs your attention</h3>
              <span className="count">6 incidents</span>
            </div>
            <div className="actions"><span className="link">Sort by impact ▾</span></div>
          </div>
          <div className="attn-list">
            <div className="attn-row crit">
              <div className="stripe"/>
              <div className="icon"><Icon name="x" size={14}/></div>
              <div className="attn-body">
                <div className="title"><span className="pipe">stripe-payments-cdc</span>ClickHouse insert failures — connection refused</div>
                <div className="desc">Sink connection to <code style={{fontSize:11}}>analytics-prod.eu-central-1</code> dropping every 30s. 8,420 events queued. ClickHouse cluster shows replica lag &gt; 60s.</div>
                <div className="meta"><span>started 18m ago</span><span className="sep">·</span><span>8,420 events</span><span className="sep">·</span><span>5 retries</span></div>
              </div>
              <div className="cta"><Icon name="play" size={11}/>Inspect</div>
            </div>
            <div className="attn-row crit">
              <div className="stripe"/>
              <div className="icon"><Icon name="warn" size={14}/></div>
              <div className="attn-body">
                <div className="title"><span className="pipe">orders-to-clickhouse</span>DLQ growing — type mismatch on <code style={{fontSize:11, color:'var(--color-orange-300)'}}>user_id</code></div>
                <div className="desc">5,609 events failed. Source emits <code style={{fontSize:11}}>String</code>, target expects <code style={{fontSize:11}}>UInt64</code>.</div>
                <div className="meta"><span>started 47m ago</span><span className="sep">·</span><span>5,609 events</span></div>
              </div>
              <div className="cta"><Icon name="play" size={11}/>Fix it</div>
            </div>
            <div className="attn-row warn">
              <div className="stripe"/>
              <div className="icon"><Icon name="drift" size={14}/></div>
              <div className="attn-body">
                <div className="title"><span className="pipe">events-stream-prod</span>Schema drift · 3 affected pipelines</div>
                <div className="desc">Source added <code style={{fontSize:11}}>currency</code>, <code style={{fontSize:11}}>region</code>. Silently dropped today: 12,440 events.</div>
                <div className="meta"><span>detected 2h ago</span></div>
              </div>
              <div className="cta">Review</div>
            </div>
            <div className="attn-row warn">
              <div className="stripe"/>
              <div className="icon"><Icon name="info" size={14}/></div>
              <div className="attn-body">
                <div className="title"><span className="pipe">user-events-otlp</span>Lag exceeded threshold (5s)</div>
                <div className="desc">P95 lag is 8.4s, sustained for 12m. Likely cause: ClickHouse replica lag from <code style={{fontSize:11}}>stripe-payments-cdc</code> cascading.</div>
                <div className="meta"><span>started 12m ago</span></div>
              </div>
              <div className="cta">Open metrics</div>
            </div>
            <div className="attn-row info">
              <div className="stripe"/>
              <div className="icon"><Icon name="history" size={14}/></div>
              <div className="attn-body">
                <div className="title"><span className="pipe">analytics-otlp-logs</span>Deploy v8 still validating</div>
                <div className="desc">Validation pending 4m. Pipeline still on v7. Safe to retry or roll back.</div>
                <div className="meta"><span>started 4m ago</span></div>
              </div>
              <div className="cta">Inspect</div>
            </div>
          </div>
        </div>

        <div className="side-stack">
          <div className="dash-card thru-card">
            <div className="dash-card-h" style={{padding: 0, marginBottom: 12, borderBottom: 'none'}}>
              <h3>Throughput · with incident overlay</h3>
              <span className="link">Open in observability →</span>
            </div>
            <div className="thru-totals">
              <div className="blk"><div className="lbl">In · last hour</div><div className="val">102.2M<span className="u">events</span></div></div>
              <div className="blk"><div className="lbl">Out · last hour</div><div className="val">88.2M<span className="u">events</span></div></div>
              <div className="blk"><div className="lbl">Loss</div><div className="val" style={{color:'var(--color-red-500)'}}>13.7<span className="u">%</span></div></div>
            </div>
            <ThruChart height={130}/>
          </div>
          <div className="dash-card">
            <div className="dash-card-h"><h3>Recent activity</h3></div>
            <div className="activity-list">
              <div className="activity-row"><span className="dot fail"/><div className="text"><span className="pipe">stripe-payments-cdc</span> insert failed</div><div className="when">2m</div></div>
              <div className="activity-row"><span className="dot fail"/><div className="text"><span className="pipe">orders-to-clickhouse</span> DLQ +412</div><div className="when">14m</div></div>
              <div className="activity-row"><span className="dot pause"/><div className="text"><b>auto</b> paused <span className="pipe">test-events-staging</span></div><div className="when">22m</div></div>
              <div className="activity-row"><span className="dot info"/><div className="text">Schema <span className="pipe">orders.v4</span> drift detected</div><div className="when">2h</div></div>
            </div>
          </div>
        </div>
      </div>

      <PipelineTable rows={incidentsRows} active="degraded"/>
    </div>
  </div>
);

// ============================================================
// ARTBOARD 4 — First-run empty state
// ============================================================
const ArtDashEmpty = () => (
  <div className="app-shell">
    <DashTopbar firstRun/>
    <div className="dash-page">
      <div className="dash-header">
        <div className="dash-header-l">
          <h1>Welcome to GlassFlow</h1>
          <p className="greet">Stream Kafka, OTLP, or anything else into ClickHouse — without writing a consumer.</p>
        </div>
        <div className="dash-header-r">
          <div className="dash-pill"><Icon name="link" size={12}/>Documentation</div>
          <div className="dash-pill"><Icon name="info" size={12}/>Watch demo · 3min</div>
        </div>
      </div>

      <div className="empty-state">
        <div className="empty-card">
          <div className="empty-mark">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l3-8 4 16 3-8h4"/>
            </svg>
          </div>
          <h2>Let's set up your first pipeline</h2>
          <p>Pick the path that fits how you work. You can always switch — every path produces the same draft, which you'll review before deploying.</p>

          <div className="empty-paths">
            <div className="empty-path">
              <div className="ic-wrap"><Icon name="play" size={14}/></div>
              <div className="nm">Guided wizard</div>
              <div className="ds">Step-by-step · ~3 min</div>
            </div>
            <div className="empty-path">
              <div className="ic-wrap"><Icon name="clone" size={14}/></div>
              <div className="nm">From template</div>
              <div className="ds">Kafka → ClickHouse, OTLP logs &amp; more</div>
            </div>
            <div className="empty-path">
              <div className="ic-wrap"><Icon name="schema" size={14}/></div>
              <div className="nm">Visual canvas</div>
              <div className="ds">Drag-and-connect · advanced</div>
            </div>
            <div className="empty-path">
              <div className="ic-wrap">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4 15 9l5 1-4 4 1 5-5-2-5 2 1-5-4-4 5-1z"/></svg>
              </div>
              <div className="nm">Ask AI</div>
              <div className="ds">Describe it · we draft for you</div>
            </div>
            <div className="empty-path">
              <div className="ic-wrap"><Icon name="download" size={14}/></div>
              <div className="nm">Import config</div>
              <div className="ds">Paste YAML / JSON</div>
            </div>
            <div className="empty-path" style={{borderStyle:'dashed', borderColor:'var(--color-gray-dark-700)', background:'transparent'}}>
              <div className="ic-wrap" style={{background:'transparent', border:'1px dashed var(--color-gray-dark-700)', color:'var(--color-gray-dark-100)'}}><Icon name="info" size={14}/></div>
              <div className="nm" style={{color:'var(--color-gray-100)'}}>Try with sample data</div>
              <div className="ds">No setup · explore the UI</div>
            </div>
          </div>

          <div className="empty-foot">
            New to GlassFlow? <a>Read the 5-minute intro</a> · <a>Browse examples</a>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ============================================================
// shared: top bar (Dashboard active) + pipeline table
// ============================================================
const DashTopbar = ({ firstRun = false }) => (
  <div className="app-topbar">
    <div className="app-logo"><span className="logo-mark"/>GlassFlow</div>
    <div className="app-nav">
      <div className="app-nav-item is-active"><Icon name="dash" size={14}/>Dashboard</div>
      {!firstRun && <div className="app-nav-item"><Icon name="pipelines" size={14}/>Pipelines</div>}
      {!firstRun && <div className="app-nav-item"><Icon name="library" size={14}/>Library</div>}
      {!firstRun && <div className="app-nav-item"><Icon name="drift" size={14}/>Schema evolution</div>}
      {!firstRun && <div className="app-nav-item"><Icon name="obs" size={14}/>Observability</div>}
    </div>
    <div className="app-nav-right">
      <div className="app-nav-item"><Icon name="help" size={14}/>Help</div>
      <div className="app-avatar">VC</div>
    </div>
  </div>
);

const PipelineTable = ({ rows, active }) => (
  <div className="dash-table">
    <div className="dash-table-h">
      <h3>Pipelines</h3>
      <div className="filters">
        <div className={`filter-chip ${active==='all'?'is-active':''}`}>All<span className="n">14</span></div>
        <div className={`filter-chip ${active==='running'?'is-active':''}`}>Running<span className="n">11</span></div>
        <div className={`filter-chip ${active==='degraded'?'is-active':''}`}>Degraded<span className="n">3</span></div>
        <div className={`filter-chip ${active==='paused'?'is-active':''}`}>Paused<span className="n">1</span></div>
        <div className={`filter-chip ${active==='drafts'?'is-active':''}`}>Drafts<span className="n">2</span></div>
        <div style={{flex:1}}/>
        <div className="filter-chip"><Icon name="search" size={11}/></div>
        <div className="filter-chip">Sort: throughput ▾</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Pipeline</th>
          <th>Source → destination</th>
          <th>Status</th>
          <th className="r">Throughput</th>
          <th className="r">Lag · p95</th>
          <th className="r">DLQ</th>
          <th>Last deploy</th>
          <th className="r"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => <PipelineRow key={i} {...r}/>)}
      </tbody>
    </table>
  </div>
);

const PipelineRow = ({ name, version, source, dest, status, statusLabel, thru, thruUnit, lag, lagUnit, lagWarn, dlq, dlqWarn, deploy, by }) => (
  <tr>
    <td><div className="pipe-name">{name}<span className="ver">{version}</span></div></td>
    <td><div className="route"><Icon name="kafka" size={12}/>{source}<span className="arrow">→</span><Icon name="ch" size={12}/>{dest}</div></td>
    <td><StatusChip kind={status} label={statusLabel}/></td>
    <td className="r"><div className="metric-cell">{thru}<span className="u">{thruUnit}</span></div></td>
    <td className="r"><div className={`metric-cell ${lagWarn||''}`}>{lag}<span className="u">{lagUnit}</span></div></td>
    <td className="r"><div className={`metric-cell ${dlqWarn||''}`}>{dlq||'0'}</div></td>
    <td><div className="metric-cell" style={{fontSize:11.5}}>{deploy}<span className="sub">by {by}</span></div></td>
    <td className="r">
      <div className="row-actions">
        <button title="Open canvas"><Icon name="schema" size={13}/></button>
        <button title="Metrics"><Icon name="obs" size={13}/></button>
        <button title="More"><Icon name="more" size={13}/></button>
      </div>
    </td>
  </tr>
);

// ============================================================
// fixture data
// ============================================================
const populatedRows = [
  { name:'orders-to-clickhouse', version:'v12', source:'orders.events', dest:'analytics.orders', status:'deg', statusLabel:'degraded', thru:'8.4k', thruUnit:'/s', lag:'1.2', lagUnit:'s', dlq:'412', dlqWarn:'crit', deploy:'14m ago', by:'maria.a' },
  { name:'stripe-payments-cdc', version:'v6', source:'stripe.cdc', dest:'fin.payments', status:'run', statusLabel:'running', thru:'2.1k', thruUnit:'/s', lag:'420', lagUnit:'ms', dlq:'0', deploy:'3h ago', by:'daniel.k' },
  { name:'user-events-otlp', version:'v9', source:'otlp.events', dest:'analytics.users', status:'run', statusLabel:'running', thru:'18.4k', thruUnit:'/s', lag:'860', lagUnit:'ms', dlq:'12', deploy:'2d ago', by:'maria.a' },
  { name:'analytics-otlp-logs', version:'v7', source:'otlp.logs', dest:'analytics.logs', status:'run', statusLabel:'running · v8 validating', thru:'9.8k', thruUnit:'/s', lag:'1.4', lagUnit:'s', dlq:'8', deploy:'4m ago', by:'daniel.k' },
  { name:'events-stream-prod', version:'v4', source:'events.prod', dest:'analytics.events', status:'run', statusLabel:'running', thru:'4.0k', thruUnit:'/s', lag:'520', lagUnit:'ms', dlq:'0', deploy:'1w ago', by:'vanessa.c' },
  { name:'test-events-staging', version:'v2', source:'events.test', dest:'staging.events', status:'paused', statusLabel:'paused', thru:'—', thruUnit:'', lag:'—', lagUnit:'', dlq:'—', deploy:'5h ago', by:'vanessa.c' },
];

const healthyRows = [
  { name:'orders-to-clickhouse', version:'v12', source:'orders.events', dest:'analytics.orders', status:'run', statusLabel:'running', thru:'8.2k', thruUnit:'/s', lag:'420', lagUnit:'ms', dlq:'2', deploy:'2d ago', by:'maria.a' },
  { name:'stripe-payments-cdc', version:'v6', source:'stripe.cdc', dest:'fin.payments', status:'run', statusLabel:'running', thru:'2.1k', thruUnit:'/s', lag:'380', lagUnit:'ms', dlq:'0', deploy:'3d ago', by:'daniel.k' },
  { name:'user-events-otlp', version:'v9', source:'otlp.events', dest:'analytics.users', status:'run', statusLabel:'running', thru:'18.4k', thruUnit:'/s', lag:'420', lagUnit:'ms', dlq:'4', deploy:'1w ago', by:'maria.a' },
  { name:'analytics-otlp-logs', version:'v7', source:'otlp.logs', dest:'analytics.logs', status:'run', statusLabel:'running', thru:'9.4k', thruUnit:'/s', lag:'340', lagUnit:'ms', dlq:'2', deploy:'2w ago', by:'daniel.k' },
  { name:'events-stream-prod', version:'v4', source:'events.prod', dest:'analytics.events', status:'run', statusLabel:'running', thru:'4.0k', thruUnit:'/s', lag:'400', lagUnit:'ms', dlq:'0', deploy:'1w ago', by:'vanessa.c' },
];

const incidentsRows = [
  { name:'stripe-payments-cdc', version:'v6', source:'stripe.cdc', dest:'fin.payments', status:'fail', statusLabel:'failing', thru:'320', thruUnit:'/s', lag:'12.4', lagUnit:'s', lagWarn:'crit', dlq:'8,420', dlqWarn:'crit', deploy:'3h ago', by:'daniel.k' },
  { name:'orders-to-clickhouse', version:'v12', source:'orders.events', dest:'analytics.orders', status:'deg', statusLabel:'degraded', thru:'4.1k', thruUnit:'/s', lag:'2.4', lagUnit:'s', lagWarn:'warn', dlq:'5,609', dlqWarn:'crit', deploy:'14m ago', by:'maria.a' },
  { name:'user-events-otlp', version:'v9', source:'otlp.events', dest:'analytics.users', status:'deg', statusLabel:'degraded · lag', thru:'14.2k', thruUnit:'/s', lag:'8.4', lagUnit:'s', lagWarn:'warn', dlq:'12', deploy:'2d ago', by:'maria.a' },
  { name:'analytics-otlp-logs', version:'v7', source:'otlp.logs', dest:'analytics.logs', status:'run', statusLabel:'running · v8 validating', thru:'9.8k', thruUnit:'/s', lag:'1.4', lagUnit:'s', dlq:'8', deploy:'4m ago', by:'daniel.k' },
  { name:'events-stream-prod', version:'v4', source:'events.prod', dest:'analytics.events', status:'run', statusLabel:'running', thru:'4.0k', thruUnit:'/s', lag:'520', lagUnit:'ms', dlq:'0', deploy:'1w ago', by:'vanessa.c' },
];

// expose
Object.assign(window, { ArtDashPopulated, ArtDashHealthy, ArtDashIncidents, ArtDashEmpty });
