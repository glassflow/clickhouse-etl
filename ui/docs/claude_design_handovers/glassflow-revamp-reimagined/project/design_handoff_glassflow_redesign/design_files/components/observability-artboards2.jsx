// =============================================================
// observability-artboards2.jsx
// O4 — Logs · live tail
// O5 — Logs · search + context expansion + correlation to range
// O6 — Log line inspector (drawer)
// O7 — Disabled / BYO state
// O8 — Internal observability · status & retention card
// =============================================================
const {
  Icon: OBAIcon2,
  OBChart, OBChartSVG, OBSpark, OBRangePicker, OBPill, OBScopeBadge,
  OBLive, OBLogLine, OBPipelineHeader, OBTabs, OBNote, obSeries
} = window;

const TOK2 = {
  ingestor: 'rgb(101, 165, 245)',
  processor: 'rgb(232, 145, 89)',
  sink: 'rgb(102, 198, 132)',
  api: 'rgb(180, 180, 195)',
  ui: 'rgb(120, 120, 132)',
  warn: 'rgb(232, 197, 89)',
  error: 'rgb(238, 95, 95)',
  muted: 'rgb(78, 78, 88)'
};

// ============================================================
// O4 — Logs · live tail
// ============================================================
const ArtObsLogsLiveTail = () => {
  return (
    <div className="ob-scene">
      <div className="ob-scene-inner">
        <OBPipelineHeader
          name="prod-orders-to-analytics"
          env="prod" revision="rev 8 · deployed 11d ago" status="running"
        >
          <button className="btn btn-ghost btn-sm"><OBAIcon2 name="stop" size={12}/> Pause</button>
          <button className="btn btn-secondary btn-sm"><OBAIcon2 name="edit" size={12}/> Open in canvas</button>
        </OBPipelineHeader>

        <OBTabs
          tabs={['Overview','Canvas','Library links','Metrics',{label:'Logs', badge:'live'},'Settings']}
          active="Logs"
        />

        {/* Toolbar */}
        <div className="ob-toolbar">
          <OBRangePicker value="15m"/>
          <span style={{flex:'0 0 8px'}}/>
          <OBLive paused={false} rate="2 084 lines/min"/>
          <button className="btn btn-ghost btn-sm"><OBAIcon2 name="stop" size={11}/> Pause stream</button>
          <button className="btn btn-ghost btn-sm">Jump to bottom</button>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost btn-sm">Wrap lines</button>
          <button className="btn btn-ghost btn-sm">Show JSON</button>
          <OBScopeBadge id="prod-orders-analytics-h8z9a"/>
        </div>

        {/* Logs panel */}
        <div className="ob-logs">
          {/* search */}
          <div className="ob-logs-head">
            <div className="ob-logs-search">
              <OBAIcon2 name="search" size={12} color="var(--color-gray-dark-500)"/>
              <input placeholder='LogsQL · e.g.   _stream:processor severity:error _msg:~"schema_mismatch"'/>
              <span className="qhint">LogsQL</span>
              <span className="kbd">⌘K</span>
            </div>
            <button className="btn btn-ghost btn-sm">Saved queries</button>
            <button className="btn btn-ghost btn-sm">Export</button>
          </div>

          {/* filters */}
          <div className="ob-logs-filters">
            <span className="label">component</span>
            <div className="ob-pillrow">
              <OBPill label="ingestor" color={TOK2.ingestor} count={522}/>
              <OBPill label="processor" color={TOK2.processor} count={1318}/>
              <OBPill label="sink" color={TOK2.sink} count={244}/>
              <OBPill label="api" color={TOK2.api} on={false}/>
              <OBPill label="ui" color={TOK2.ui} on={false}/>
            </div>
            <span style={{width:1, height:18, background:'var(--color-gray-dark-800)'}}/>
            <span className="label">severity</span>
            <div className="ob-pillrow">
              <OBPill label="debug" color={TOK2.muted} on={false}/>
              <OBPill label="info" color={TOK2.ingestor}/>
              <OBPill label="warn" color={TOK2.warn}/>
              <OBPill label="error" color={TOK2.error}/>
            </div>
            <div style={{flex:1}}/>
            <span style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-gray-dark-500)', fontSize:10.5}}>
              showing 312 lines · streaming
            </span>
          </div>

          {/* lines */}
          <div className="ob-logs-body" style={{maxHeight: 720}}>
            <OBLogLine ts="13:04:22.418" comp="processor" sev="info">
              <span className="k">trace_id=</span><span className="v">7f1c92</span>{' '}
              <span className="k">batch=</span>240 records<span className="k"> · t=</span>34ms{' '}
              <span style={{color:'var(--color-gray-dark-500)'}}>orders.placed.v2 → analytics.orders</span>
            </OBLogLine>
            <OBLogLine ts="13:04:22.401" comp="ingestor" sev="info">
              fetched <span className="v">240</span> records from <span className="k">topic=</span>orders.placed.v2 <span className="k">partition=</span>3 <span className="k">offset=</span>1842709
            </OBLogLine>
            <OBLogLine ts="13:04:22.099" comp="sink" sev="info">
              clickhouse insert ok · <span className="v">240</span> rows · <span className="k">target=</span>analytics.orders <span className="k">latency=</span>18ms
            </OBLogLine>
            <OBLogLine ts="13:04:21.812" comp="processor" sev="warn">
              dedup window aging out · <span className="k">window=</span>5m <span className="k">evicted=</span>1842 keys · safe
            </OBLogLine>
            <OBLogLine ts="13:04:21.501" comp="processor" sev="info">
              dedup hit · <span className="k">key=</span>order:8821-9912 <span className="k">first_seen=</span>13:01:09
            </OBLogLine>
            <OBLogLine ts="13:04:21.309" comp="processor" sev="info">
              transform applied · <span className="v">filter=high_value</span> dropped <span className="k">12</span> of <span className="k">240</span> rows
            </OBLogLine>
            <OBLogLine ts="13:04:21.099" comp="sink" sev="error">
              clickhouse insert FAILED · <span className="k">target=</span>analytics.orders <span className="k">err=</span><span style={{color:'var(--color-red-500)'}}>Code: 252 · Too many parts (300). Merges are processing significantly slower than inserts</span>
            </OBLogLine>
            <OBLogLine ts="13:04:21.097" comp="sink" sev="warn">
              backoff · sleep <span className="v">2 000</span>ms · <span className="k">attempt=</span>1/5
            </OBLogLine>
            <OBLogLine ts="13:04:20.911" comp="processor" sev="info">
              <span className="k">trace_id=</span><span className="v">7f1c91</span> batch=240 records · t=29ms
            </OBLogLine>
            <OBLogLine ts="13:04:20.812" comp="ingestor" sev="info">
              fetched <span className="v">240</span> records · partition=2 offset=1842469
            </OBLogLine>
            <OBLogLine ts="13:04:20.498" comp="processor" sev="info">
              dedup hit · key=order:8821-9911
            </OBLogLine>
            <OBLogLine ts="13:04:20.301" comp="processor" sev="error">
              schema_mismatch · expected <span style={{color:'var(--color-red-500)'}}>order_total: float64</span>, got <span style={{color:'var(--color-red-500)'}}>"4500"</span> (string) · <span className="k">key=</span>order:8819-2204 · sent to DLQ
            </OBLogLine>
            <OBLogLine ts="13:04:20.099" comp="sink" sev="info">
              insert ok · 228 rows
            </OBLogLine>
            <OBLogLine ts="13:04:19.812" comp="processor" sev="info">
              transform applied · filter=high_value dropped 8 of 228 rows
            </OBLogLine>
            <OBLogLine ts="13:04:19.501" comp="processor" sev="info">
              <span className="k">trace_id=</span><span className="v">7f1c90</span> batch=228 records · t=27ms
            </OBLogLine>
            <OBLogLine ts="13:04:19.099" comp="ingestor" sev="info">
              fetched 228 records · partition=1 offset=1842241
            </OBLogLine>
            <OBLogLine ts="13:04:18.911" comp="api" sev="debug">
              GET /api/v1/pipeline/h8z9a/health · 200 · 4ms
            </OBLogLine>
            <OBLogLine ts="13:04:18.501" comp="processor" sev="info">
              <span className="k">trace_id=</span><span className="v">7f1c8f</span> batch=216 records · t=24ms
            </OBLogLine>
            <OBLogLine ts="13:04:18.099" comp="sink" sev="info">
              insert ok · 216 rows
            </OBLogLine>
          </div>

          {/* footer with rate */}
          <div style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'9px 14px',
            borderTop:'1px solid var(--color-gray-dark-800)',
            background:'#0c0c10',
            fontSize:11, fontFamily:'JetBrains Mono, monospace',
            color:'var(--color-gray-dark-500)'
          }}>
            <OBLive paused={false} rate="streaming"/>
            <span>2 084 lines · last 15m</span>
            <span style={{color:'var(--color-yellow-400)'}}>12 warns</span>
            <span style={{color:'var(--color-red-500)'}}>38 errors</span>
            <div style={{flex:1}}/>
            <span>VL retention · 3d · 1.4 GB used</span>
          </div>
        </div>

        <OBNote>
          The live-tail body uses SSE — the engineering note in the M4 spec maps to this. Severity stripes (left edge) and component column let
          a user spot the failing component before reading any line. Line click → inspector drawer (next artboard).
        </OBNote>
      </div>
    </div>
  );
};

// ============================================================
// O5 — Logs · search + context expansion + range correlation
// ============================================================
const ArtObsLogsSearch = () => {
  return (
    <div className="ob-scene">
      <div className="ob-scene-inner">
        <OBPipelineHeader name="prod-orders-to-analytics" env="prod" revision="rev 8 · 11d ago" status="running">
          <button className="btn btn-ghost btn-sm"><OBAIcon2 name="stop" size={12}/> Pause</button>
          <button className="btn btn-secondary btn-sm">Open in canvas</button>
        </OBPipelineHeader>

        <OBTabs tabs={['Overview','Canvas','Library links','Metrics',{label:'Logs',badge:'38 err'},'Settings']} active="Logs"/>

        <div className="ob-toolbar">
          <OBRangePicker value="1h"/>
          <OBLive paused={true}/>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'4px 10px',
            border:'1px solid color-mix(in srgb, var(--color-orange-300) 35%, var(--color-gray-dark-800))',
            borderRadius:999, fontSize:11,
            color:'var(--color-orange-300)',
            fontFamily:'JetBrains Mono, monospace',
            background:'color-mix(in srgb, var(--color-orange-300) 6%, transparent)'
          }}>
            <OBAIcon2 name="link" size={11}/> pinned: 13:00 – 13:08
            <span style={{marginLeft:4, color:'var(--color-gray-dark-500)'}}>· from Metrics drill-down</span>
            <span style={{marginLeft:4, cursor:'pointer'}}>×</span>
          </span>
          <div style={{flex:1}}/>
          <OBScopeBadge id="prod-orders-analytics-h8z9a"/>
        </div>

        {/* Mini metrics strip — context for the log range */}
        <div className="ob-chart" style={{padding:'10px 14px', marginBottom:14}}>
          <div style={{display:'flex', alignItems:'center', gap:14, fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-gray-dark-500)'}}>
            <span style={{color:'var(--color-foreground-neutral)', fontWeight:600}}>throughput</span>
            <span>13:00 → 13:08</span>
            <span>·</span>
            <span style={{color:TOK2.warn}}>processor backed up · 600/s spike</span>
            <div style={{flex:1}}/>
            <span>p99 lat <span style={{color:'var(--color-foreground-neutral)'}}>312ms</span></span>
            <span>err <span style={{color:'var(--color-red-500)'}}>38</span></span>
            <span>warn <span style={{color:'var(--color-yellow-400)'}}>12</span></span>
          </div>
          <OBChartSVG
            width={1580} height={70}
            series={[
              { values: obSeries({seed: 50, n: 96, base: 1450, amp: 220, drift: 1}), color: TOK2.ingestor, weight: 1.4, fill: TOK2.ingestor },
              { values: obSeries({seed: 51, n: 96, base: 1420, amp: 210, drift: 1, spike:{at:64,amount:600}}), color: TOK2.processor, weight: 1.4 }
            ]}
            showBrush brushFrom={0.62} brushTo={0.74}
            pad={{l:32, r:8, t:6, b:18}}
          />
        </div>

        <div className="ob-logs">
          <div className="ob-logs-head">
            <div className="ob-logs-search">
              <OBAIcon2 name="search" size={12} color="var(--color-gray-dark-500)"/>
              <input style={{color:'var(--color-foreground-neutral)'}} defaultValue='_stream:processor severity:error _msg:~"schema_mismatch"'/>
              <span className="qhint">LogsQL · 38 matches</span>
              <span className="kbd">⌘↵</span>
            </div>
            <button className="btn btn-ghost btn-sm">Saved · "schema_mismatch"</button>
            <button className="btn btn-ghost btn-sm">Find similar</button>
          </div>

          <div className="ob-logs-filters">
            <span className="label">component</span>
            <div className="ob-pillrow">
              <OBPill label="ingestor" color={TOK2.ingestor} on={false}/>
              <OBPill label="processor" color={TOK2.processor}/>
              <OBPill label="sink" color={TOK2.sink} on={false}/>
              <OBPill label="api" color={TOK2.api} on={false}/>
            </div>
            <span style={{width:1, height:18, background:'var(--color-gray-dark-800)'}}/>
            <span className="label">severity</span>
            <div className="ob-pillrow">
              <OBPill label="debug" color={TOK2.muted} on={false}/>
              <OBPill label="info" color={TOK2.ingestor} on={false}/>
              <OBPill label="warn" color={TOK2.warn} on={false}/>
              <OBPill label="error" color={TOK2.error}/>
            </div>
            <div style={{flex:1}}/>
            <span style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-gray-dark-500)', fontSize:10.5}}>
              38 matches · in 13:00 – 13:08
            </span>
          </div>

          <div className="ob-logs-body">
            {/* Context above */}
            <OBLogLine ts="13:02:39.301" comp="processor" sev="info" state="context">
              transform applied · filter=high_value dropped 12 of 240 rows
            </OBLogLine>
            <OBLogLine ts="13:02:39.218" comp="processor" sev="info" state="context">
              dedup hit · key=order:8821-9911
            </OBLogLine>

            {/* Match 1 — selected */}
            <OBLogLine ts="13:02:39.099" comp="processor" sev="error" selected>
              <span className="qmatch">schema_mismatch</span> · expected <span style={{color:'var(--color-red-500)'}}>order_total: float64</span>,
              got <span style={{color:'var(--color-red-500)'}}>"4500"</span> (string) · <span className="k">key=</span>order:8819-2204 · sent to DLQ
            </OBLogLine>

            <div className="ob-logline-expand">
              <OBAIcon2 name="chevD" size={10}/>
              <a>show 5 lines before</a>
              <span style={{color:'var(--color-gray-dark-700)'}}>·</span>
              <a>5 lines after</a>
              <span style={{color:'var(--color-gray-dark-700)'}}>·</span>
              <a>jump to trace_id 7f1c91</a>
              <div style={{flex:1}}/>
              <span style={{color:'var(--color-gray-dark-500)'}}>match 1 of 38</span>
            </div>

            <OBLogLine ts="13:02:39.001" comp="processor" sev="info" state="context">
              <span className="k">trace_id=</span><span className="v">7f1c91</span> batch=240 records · t=24ms
            </OBLogLine>
            <OBLogLine ts="13:02:38.901" comp="ingestor" sev="info" state="context">
              fetched 240 records · partition=3 offset=1842241
            </OBLogLine>
            <OBLogLine ts="13:02:38.599" comp="sink" sev="info" state="context">
              insert ok · 228 rows
            </OBLogLine>

            {/* Gap */}
            <div style={{padding:'6px 14px', fontSize:10, color:'var(--color-gray-dark-500)', textAlign:'center', fontFamily:'JetBrains Mono, monospace', background:'#0a0a0d'}}>
              · 8 lines collapsed · click to expand ·
            </div>

            {/* Match 2 */}
            <OBLogLine ts="13:02:21.214" comp="processor" sev="error">
              <span className="qmatch">schema_mismatch</span> · expected <span style={{color:'var(--color-red-500)'}}>order_total: float64</span>,
              got <span style={{color:'var(--color-red-500)'}}>"3200"</span> (string) · key=order:8810-7733 · sent to DLQ
            </OBLogLine>
            <OBLogLine ts="13:02:18.099" comp="processor" sev="warn">
              dedup window aging out · evicted 1820 keys
            </OBLogLine>

            {/* Match 3 */}
            <OBLogLine ts="13:01:54.812" comp="processor" sev="error">
              <span className="qmatch">schema_mismatch</span> · expected <span style={{color:'var(--color-red-500)'}}>order_total: float64</span>,
              got <span style={{color:'var(--color-red-500)'}}>"7800"</span> (string) · key=order:8801-1119 · sent to DLQ
            </OBLogLine>

            {/* Match 4 */}
            <OBLogLine ts="13:01:42.501" comp="processor" sev="error">
              <span className="qmatch">schema_mismatch</span> · expected <span style={{color:'var(--color-red-500)'}}>order_total: float64</span>,
              got <span style={{color:'var(--color-red-500)'}}>"5500"</span> (string) · key=order:8794-3340 · sent to DLQ
            </OBLogLine>
          </div>

          <div style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'9px 14px',
            borderTop:'1px solid var(--color-gray-dark-800)',
            background:'#0c0c10',
            fontSize:11, fontFamily:'JetBrains Mono, monospace',
            color:'var(--color-gray-dark-500)'
          }}>
            <span style={{color:'var(--color-foreground-neutral)'}}>38 matches</span>
            <span>· all in 13:00 – 13:08</span>
            <span>· same shape: <span style={{color:'var(--color-orange-300)'}}>order_total · float64 → string</span></span>
            <div style={{flex:1}}/>
            <button className="btn btn-secondary btn-sm">Open root cause in Library →</button>
          </div>
        </div>

        <OBNote>
          A successful debug session in 30 seconds: brushed range from Metrics → all 38 errors are the same schema mismatch on{' '}
          <span style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-foreground-neutral)'}}>order_total</span> →
          producer started sending strings instead of floats. The "Open root cause in Library" CTA jumps to the schema's "used by" view to fix it once for all pipelines.
        </OBNote>
      </div>
    </div>
  );
};

// ============================================================
// O6 — Log line inspector (drawer)
// ============================================================
const ArtObsLogInspector = () => {
  return (
    <div className="ob-scene">
      <div className="ob-scene-inner">
        <OBPipelineHeader name="prod-orders-to-analytics" env="prod" revision="rev 8 · 11d ago" status="running">
          <button className="btn btn-ghost btn-sm"><OBAIcon2 name="stop" size={12}/> Pause</button>
          <button className="btn btn-secondary btn-sm">Open in canvas</button>
        </OBPipelineHeader>

        <OBTabs tabs={['Overview','Canvas','Library links','Metrics',{label:'Logs', badge:'38 err'},'Settings']} active="Logs"/>

        {/* logs container with relative positioning to host the drawer */}
        <div className="ob-logs" style={{position:'relative', minHeight: 720}}>
          <div className="ob-logs-head">
            <div className="ob-logs-search" style={{flex:'unset', minWidth:600}}>
              <OBAIcon2 name="search" size={12} color="var(--color-gray-dark-500)"/>
              <input defaultValue='_stream:processor severity:error _msg:~"schema_mismatch"'/>
              <span className="qhint">LogsQL · 38 matches</span>
            </div>
            <div style={{flex:1}}/>
            <button className="btn btn-ghost btn-sm">Find similar</button>
          </div>

          <div className="ob-logs-filters">
            <span className="label">component</span>
            <div className="ob-pillrow">
              <OBPill label="processor" color={TOK2.processor}/>
            </div>
            <span style={{width:1, height:18, background:'var(--color-gray-dark-800)'}}/>
            <span className="label">severity</span>
            <div className="ob-pillrow">
              <OBPill label="error" color={TOK2.error}/>
            </div>
          </div>

          <div className="ob-logs-body" style={{paddingRight: 460, minHeight:600}}>
            <OBLogLine ts="13:02:39.301" comp="processor" sev="info" state="context">
              transform applied · filter=high_value dropped 12 of 240 rows
            </OBLogLine>
            <OBLogLine ts="13:02:39.218" comp="processor" sev="info" state="context">
              dedup hit · key=order:8821-9911
            </OBLogLine>
            <OBLogLine ts="13:02:39.099" comp="processor" sev="error" selected>
              <span className="qmatch">schema_mismatch</span> · expected <span style={{color:'var(--color-red-500)'}}>order_total: float64</span>,
              got <span style={{color:'var(--color-red-500)'}}>"4500"</span> (string) · <span className="k">key=</span>order:8819-2204 · sent to DLQ
            </OBLogLine>
            <div className="ob-logline-expand">
              <OBAIcon2 name="chevD" size={10}/> <a>show 5 before · 5 after</a>
              <div style={{flex:1}}/>
              <span style={{color:'var(--color-gray-dark-500)'}}>match 1 of 38 · same shape across all matches</span>
            </div>
            <OBLogLine ts="13:02:39.001" comp="processor" sev="info" state="context">
              <span className="k">trace_id=</span><span className="v">7f1c91</span> batch=240 records · t=24ms
            </OBLogLine>
            <OBLogLine ts="13:02:38.901" comp="ingestor" sev="info" state="context">
              fetched 240 records · partition=3 offset=1842241
            </OBLogLine>
          </div>

          {/* Drawer */}
          <div className="ob-inspector">
            <div className="ob-inspector-head">
              <span className="sev error" style={{fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--color-red-500)'}}>error</span>
              <div style={{flex:1, fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-gray-dark-100)'}}>
                processor · 13:02:39.099 UTC
              </div>
              <button className="btn btn-ghost btn-sm" style={{padding:'4px 8px'}}><OBAIcon2 name="x" size={11}/></button>
            </div>

            <div className="ob-inspector-body">
              <div style={{
                fontFamily:'JetBrains Mono, monospace', fontSize:12.5, lineHeight:1.55,
                padding:12,
                background:'#050507',
                border:'1px solid var(--color-gray-dark-800)',
                borderRadius:8,
                marginBottom:14,
                color:'var(--color-foreground-neutral)'
              }}>
                <div style={{color:'var(--color-red-500)', fontWeight:600, marginBottom:6}}>schema_mismatch</div>
                <div>expected <span style={{color:TOK2.processor}}>order_total: float64</span></div>
                <div>got <span style={{color:'var(--color-red-500)'}}>"4500"</span> <span style={{color:'var(--color-gray-dark-500)'}}>(string)</span></div>
                <div style={{color:'var(--color-gray-dark-500)', marginTop:6}}>key=order:8819-2204 · sent to DLQ</div>
              </div>

              <div style={{
                fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em',
                color:'var(--color-gray-dark-500)', fontWeight:600, marginBottom:8
              }}>structured fields</div>

              <div className="ob-fields">
                <span className="k">timestamp</span><span className="v">2026-04-29T13:02:39.099Z</span>
                <span className="k">component</span><span className="v">processor</span>
                <span className="k">severity</span><span className="v error">error</span>
                <span className="k">pipeline_id</span><span className="v">prod-orders-analytics-h8z9a</span>
                <span className="k">trace_id</span><span className="v" style={{color:'var(--color-orange-300)'}}>7f1c91</span>
                <span className="k">span_id</span><span className="v">b1d24a</span>
                <span className="k">err.type</span><span className="v warn">schema_mismatch</span>
                <span className="k">err.field</span><span className="v">order_total</span>
                <span className="k">expected_type</span><span className="v">float64</span>
                <span className="k">received_type</span><span className="v error">string</span>
                <span className="k">received_value</span><span className="v error">"4500"</span>
                <span className="k">record.key</span><span className="v">order:8819-2204</span>
                <span className="k">topic</span><span className="v">orders.placed.v2</span>
                <span className="k">partition</span><span className="v">3</span>
                <span className="k">offset</span><span className="v">1842241</span>
                <span className="k">dlq_routed</span><span className="v" style={{color:'var(--color-yellow-400)'}}>true</span>
                <span className="k">dlq_topic</span><span className="v">orders.placed.dlq</span>
                <span className="k">schema_version</span><span className="v">OrderEvents · v4</span>
                <span className="k">schema_status</span><span className="v warn">v5 available · this pipeline pinned to v4</span>
              </div>

              <div style={{marginTop:18}}>
                <div style={{
                  fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em',
                  color:'var(--color-gray-dark-500)', fontWeight:600, marginBottom:8
                }}>cross-cutting links</div>
                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                  <CrossLink icon="schema" label="OrderEvents · v4" sub="this pipeline · pinned 11d ago"/>
                  <CrossLink icon="link"   label="trace_id 7f1c91 · processor → sink" sub="3 spans · 28ms total"/>
                  <CrossLink icon="warn"   label="DLQ · orders.placed.dlq" sub="32 messages with the same shape"/>
                </div>
              </div>
            </div>

            <div className="ob-inspector-actions">
              <button className="btn btn-secondary btn-sm">Find similar (38)</button>
              <button className="btn btn-ghost btn-sm">Pin to range</button>
              <button className="btn btn-ghost btn-sm">Copy LogsQL</button>
              <div style={{flex:1}}/>
              <button className="btn btn-ghost btn-sm">Open in DLQ</button>
            </div>
          </div>
        </div>

        <OBNote>
          The drawer shows the raw structured record verbatim — every field the OTEL collector enriched, in the order they map to the OTLP attribute set.
          The bottom "cross-cutting links" turn structured fields into navigable handles: schema, trace, DLQ.
        </OBNote>
      </div>
    </div>
  );
};

const CrossLink = ({icon, label, sub}) => (
  <div style={{
    display:'flex', alignItems:'center', gap:10,
    padding:'8px 10px',
    background:'#08080a',
    border:'1px solid var(--color-gray-dark-800)',
    borderRadius:8,
    cursor:'pointer'
  }}>
    <div style={{
      width:24, height:24, borderRadius:6,
      background:'var(--color-orange-alpha-10)',
      border:'1px solid var(--color-orange-alpha-20)',
      display:'grid', placeItems:'center',
      color:'var(--color-orange-300)'
    }}>
      <OBAIcon2 name={icon} size={12}/>
    </div>
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:12, color:'var(--color-foreground-neutral)', fontWeight:500}}>{label}</div>
      <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>{sub}</div>
    </div>
    <OBAIcon2 name="chevR" size={11} color="var(--color-gray-dark-500)"/>
  </div>
);

// ============================================================
// O7 — Disabled / BYO state
// ============================================================
const ArtObsDisabledState = () => {
  return (
    <div className="ob-scene">
      <div className="ob-scene-inner">
        <OBPipelineHeader name="prod-orders-to-analytics" env="prod" revision="rev 8 · 11d ago" status="running">
          <button className="btn btn-ghost btn-sm">Pause</button>
          <button className="btn btn-secondary btn-sm">Open in canvas</button>
        </OBPipelineHeader>

        <OBTabs tabs={['Overview','Canvas','Library links','Metrics','Logs','Settings']} active="Metrics"/>

        <div className="ob-empty">
          <div>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:6,
              fontFamily:'JetBrains Mono, monospace', fontSize:10.5,
              padding:'4px 10px',
              background:'#08080a',
              border:'1px solid var(--color-gray-dark-800)',
              borderRadius:999, color:'var(--color-gray-dark-500)',
              marginBottom:14
            }}>
              <span style={{width:7, height:7, borderRadius:999, background:'var(--color-gray-dark-500)'}}/>
              internal observability is OFF
            </span>
            <h3>Metrics and logs are streaming to your external backend</h3>
            <p>
              This deployment runs with <span style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-foreground-neutral)'}}>internalObservability.enabled: false</span>.
              GlassFlow's OTEL collector is forwarding to your configured destination — we just don't have the bundled VictoriaMetrics / VictoriaLogs to query from in here.
            </p>
            <p style={{marginTop:10}}>
              You have two paths: keep the BYO setup and view metrics in your own Grafana, or enable the internal stack and unlock the dashboards and log viewer in this UI.
            </p>
            <div className="actions">
              <button className="btn btn-secondary btn-sm">Enable internal observability…</button>
              <button className="btn btn-ghost btn-sm">Open in your Grafana →</button>
              <button className="btn btn-ghost btn-sm">Read the docs</button>
            </div>
          </div>

          <div>
            <div style={{
              fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em',
              color:'var(--color-gray-dark-500)', fontWeight:600,
              marginBottom:8
            }}>helm values · to enable</div>
            <div className="ob-snippet">
<span className="c"># values.yaml</span>{'\n'}
<span className="k">internalObservability</span>:{'\n'}
{'  '}<span className="k">enabled</span>: <span className="b">true</span>{'\n'}
{'  '}<span className="k">metrics</span>:{'\n'}
{'    '}<span className="k">retention</span>: <span className="v">7d</span>{'\n'}
{'    '}<span className="k">resources</span>:{'\n'}
{'      '}<span className="k">requests</span>: {'{'} <span className="k">cpu</span>: <span className="v">200m</span>, <span className="k">memory</span>: <span className="v">512Mi</span> {'}'}{'\n'}
{'  '}<span className="k">logs</span>:{'\n'}
{'    '}<span className="k">retention</span>: <span className="v">3d</span>{'\n'}
{'\n'}
<span className="c"># keep the existing OTEL exporter pointed at your backend —</span>{'\n'}
<span className="c"># GlassFlow fans out to BOTH internal and external. Nothing breaks.</span>
            </div>
            <div style={{marginTop:10, fontSize:10.5, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>
              ~700 MiB additional pod memory · ~1 GiB disk per day at typical load
            </div>
          </div>
        </div>

        <div style={{marginTop:18}} className="ob-grid cols-3">
          <div className="ob-sumcard" style={{opacity:0.55}}>
            <div className="label">records ingested</div>
            <div className="value" style={{color:'var(--color-gray-dark-500)'}}>—<span className="unit">/sec</span></div>
            <div className="delta">disabled</div>
            <div style={{marginTop:8, height:36, background:'repeating-linear-gradient(45deg, transparent 0 8px, #0a0a0d 8px 9px)', borderRadius:4}}/>
          </div>
          <div className="ob-sumcard" style={{opacity:0.55}}>
            <div className="label">latency · p99</div>
            <div className="value" style={{color:'var(--color-gray-dark-500)'}}>—<span className="unit">ms</span></div>
            <div className="delta">disabled</div>
            <div style={{marginTop:8, height:36, background:'repeating-linear-gradient(45deg, transparent 0 8px, #0a0a0d 8px 9px)', borderRadius:4}}/>
          </div>
          <div className="ob-sumcard" style={{opacity:0.55}}>
            <div className="label">dlq rate</div>
            <div className="value" style={{color:'var(--color-gray-dark-500)'}}>—<span className="unit">msg/min</span></div>
            <div className="delta">disabled</div>
            <div style={{marginTop:8, height:36, background:'repeating-linear-gradient(45deg, transparent 0 8px, #0a0a0d 8px 9px)', borderRadius:4}}/>
          </div>
        </div>

        <OBNote>
          The "disabled" state is intentionally not a punishment — it's a respectful pointer to BYO. Enabling internal obs is a single helm flag, not a migration.
          The fan-out architecture means the user keeps their existing dashboards working through the transition.
        </OBNote>
      </div>
    </div>
  );
};

// ============================================================
// O8 — Status & retention card (Settings → Observability)
// ============================================================
const ArtObsStatusCard = () => {
  return (
    <div className="ob-scene">
      <div className="ob-scene-inner">
        <div className="br-crumbs"><OBAIcon2 name="pipelines" size={12}/><a>Workspace</a><OBAIcon2 name="chevR" size={10}/><a>Settings</a><OBAIcon2 name="chevR" size={10}/><span style={{color:'var(--color-foreground-neutral)'}}>Observability</span></div>
        <h1 className="br-title" style={{margin:'8px 0 4px'}}>Observability stack</h1>
        <p className="br-subtitle">The bundled internal stack — single-node VictoriaMetrics + VictoriaLogs — and how they're being used. This page is an admin surface; per-pipeline charts live on Pipeline Details.</p>

        <div className="ob-status-card" style={{marginBottom:14}}>
          <div className="ob-status-cell">
            <div className="label">internal stack</div>
            <div className="value">
              <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
                <span style={{width:8, height:8, borderRadius:999, background:'var(--color-green-500)', boxShadow:'0 0 0 3px color-mix(in srgb, var(--color-green-500) 20%, transparent)'}}/>
                enabled
              </span>
            </div>
            <div className="meta">internalObservability.enabled = true · since helm install · 22 Apr 2026</div>
          </div>
          <div className="ob-status-cell">
            <div className="label">vmsingle</div>
            <div className="value">v1.99.0 · healthy</div>
            <div className="meta">scraping every 15s · OTLP push from collector</div>
          </div>
          <div className="ob-status-cell">
            <div className="label">VictoriaLogs</div>
            <div className="value">v0.41.0 · healthy</div>
            <div className="meta">native OTLP ingest · LogsQL</div>
          </div>
        </div>

        <div className="ob-grid">
          {/* Retention + disk */}
          <div className="ob-chart" style={{padding:'18px 20px'}}>
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title">Retention &amp; disk</div>
                <div className="ob-chart-sub">defaults from values.yaml · adjustable on helm upgrade</div>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
              <RetentionRow
                title="Metrics · vmsingle"
                retention="7 days"
                used={1.4} total={20}
                meta="2.1M active series · capped at OTEL collector"
                tone="ok"
              />
              <RetentionRow
                title="Logs · VictoriaLogs"
                retention="3 days"
                used={4.7} total={20}
                meta="14 GB ingested 7d · ~6 GB indexed"
                tone="warn"
              />
            </div>
            <div style={{display:'flex', gap:8, marginTop:6}}>
              <button className="btn btn-ghost btn-sm">Edit defaults…</button>
              <button className="btn btn-ghost btn-sm">View persistent volumes</button>
            </div>
          </div>

          {/* Fan-out */}
          <div className="ob-chart" style={{padding:'18px 20px'}}>
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title">OTEL collector fan-out</div>
                <div className="ob-chart-sub">internal stack does not replace your backend — it is a second destination</div>
              </div>
            </div>
            <FanOut/>
          </div>

          {/* Cardinality / health checks */}
          <div className="ob-chart" style={{padding:'18px 20px'}}>
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title">Cardinality guards</div>
                <div className="ob-chart-sub">label cap at the collector · prevents per-message attrs from blowing up VM</div>
              </div>
            </div>
            <table style={{width:'100%', fontSize:11.5, fontFamily:'JetBrains Mono, monospace', borderCollapse:'collapse'}}>
              <tbody>
                <tr style={{borderBottom:'1px dashed var(--color-gray-dark-800)'}}>
                  <td style={{padding:'8px 0', color:'var(--color-gray-dark-500)'}}>active series</td>
                  <td style={{textAlign:'right', color:'var(--color-foreground-neutral)'}}>2 110 482</td>
                  <td style={{textAlign:'right', color:'var(--color-green-500)'}}>well below cap</td>
                </tr>
                <tr style={{borderBottom:'1px dashed var(--color-gray-dark-800)'}}>
                  <td style={{padding:'8px 0', color:'var(--color-gray-dark-500)'}}>distinct pipeline_id</td>
                  <td style={{textAlign:'right', color:'var(--color-foreground-neutral)'}}>52</td>
                  <td style={{textAlign:'right', color:'var(--color-gray-dark-500)'}}>—</td>
                </tr>
                <tr style={{borderBottom:'1px dashed var(--color-gray-dark-800)'}}>
                  <td style={{padding:'8px 0', color:'var(--color-gray-dark-500)'}}>label cap exceeded · 24h</td>
                  <td style={{textAlign:'right', color:'var(--color-foreground-neutral)'}}>0</td>
                  <td style={{textAlign:'right', color:'var(--color-green-500)'}}>healthy</td>
                </tr>
                <tr>
                  <td style={{padding:'8px 0', color:'var(--color-gray-dark-500)'}}>tenant_id (future)</td>
                  <td style={{textAlign:'right', color:'var(--color-gray-dark-500)'}}>not in use</td>
                  <td style={{textAlign:'right', color:'var(--color-gray-dark-500)'}}>label-room reserved</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Roadmap */}
          <div className="ob-chart" style={{padding:'18px 20px'}}>
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title">What's coming next</div>
                <div className="ob-chart-sub">tied to the M-series in the project plan</div>
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              <RoadRow stage="M3" status="ready" title="Per-pipeline metrics dashboard" sub="time-series · component split · brushed range"/>
              <RoadRow stage="M4" status="ready" title="Per-pipeline log viewer" sub="live tail · LogsQL search · context expansion"/>
              <RoadRow stage="M5" status="next" title="vmalert + GlassFlow alert rules" sub="thresholds defined per pipeline · fed from this stack"/>
              <RoadRow stage="—"  status="later" title="Cluster-wide overview · traces" sub="scoped out for v1 — single-pipeline focus first"/>
            </div>
          </div>
        </div>

        <OBNote>
          This page is the only place the bundled VM/VL versions are visible. Everywhere else, observability looks like a first-class GlassFlow product, not a wrapped third party.
        </OBNote>
      </div>
    </div>
  );
};

const RetentionRow = ({title, retention, used, total, meta, tone}) => {
  const pct = (used / total) * 100;
  const barColor = tone === 'warn' ? 'var(--color-yellow-400)' : (tone === 'error' ? 'var(--color-red-500)' : 'var(--color-green-500)');
  return (
    <div style={{padding:12, background:'#08080a', border:'1px solid var(--color-gray-dark-800)', borderRadius:8}}>
      <div style={{display:'flex', alignItems:'baseline', gap:8}}>
        <div style={{fontSize:12, color:'var(--color-foreground-neutral)', fontWeight:600}}>{title}</div>
        <div style={{flex:1}}/>
        <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-orange-300)'}}>{retention}</div>
      </div>
      <div style={{marginTop:8, height:8, background:'#050507', borderRadius:2, overflow:'hidden'}}>
        <div style={{width: pct + '%', height:'100%', background: barColor, opacity: 0.85}}/>
      </div>
      <div style={{marginTop:6, fontSize:10.5, fontFamily:'JetBrains Mono, monospace', color:'var(--color-gray-dark-500)', display:'flex'}}>
        <span>{used} GB used / {total} GB</span>
        <span style={{flex:1}}/>
        <span>{meta}</span>
      </div>
    </div>
  );
};

const FanOut = () => (
  <svg width="640" height="180" viewBox="0 0 640 180">
    {/* Source: components */}
    <g>
      <rect x="14" y="60" width="140" height="60" rx="8" fill="#0a0a0c" stroke="#15151b"/>
      <text x="84" y="84" textAnchor="middle" fill="#e1e1e6" fontFamily="var(--font-family-title)" fontSize="11" fontWeight="600">GlassFlow</text>
      <text x="84" y="98" textAnchor="middle" fill="#5a5a64" fontFamily="JetBrains Mono, monospace" fontSize="9">ingestor · processor · sink</text>
    </g>

    {/* Center: collector */}
    <g>
      <rect x="220" y="60" width="160" height="60" rx="8" fill="#0a0a0c" stroke="rgb(232,145,89)" strokeOpacity="0.6"/>
      <text x="300" y="84" textAnchor="middle" fill="#e1e1e6" fontFamily="var(--font-family-title)" fontSize="11" fontWeight="600">OTEL collector</text>
      <text x="300" y="98" textAnchor="middle" fill="#5a5a64" fontFamily="JetBrains Mono, monospace" fontSize="9">pipeline_id label cap · fan-out</text>
    </g>

    {/* Right top: VM/VL */}
    <g>
      <rect x="450" y="14" width="170" height="60" rx="8" fill="#0a0a0c" stroke="rgb(101, 165, 245)" strokeOpacity="0.6"/>
      <text x="535" y="36" textAnchor="middle" fill="#e1e1e6" fontFamily="var(--font-family-title)" fontSize="11" fontWeight="600">VictoriaMetrics</text>
      <text x="535" y="50" textAnchor="middle" fill="#5a5a64" fontFamily="JetBrains Mono, monospace" fontSize="9">in-chart · 7d · queried by API</text>
      <text x="535" y="63" textAnchor="middle" fill="rgb(102,198,132)" fontFamily="JetBrains Mono, monospace" fontSize="9">+ VictoriaLogs · 3d</text>
    </g>

    {/* Right bottom: external backend */}
    <g>
      <rect x="450" y="106" width="170" height="60" rx="8" fill="#0a0a0c" stroke="#3b3b44" strokeDasharray="4 3"/>
      <text x="535" y="128" textAnchor="middle" fill="#e1e1e6" fontFamily="var(--font-family-title)" fontSize="11" fontWeight="600">your backend</text>
      <text x="535" y="142" textAnchor="middle" fill="#5a5a64" fontFamily="JetBrains Mono, monospace" fontSize="9">Grafana · HyperDX · Datadog…</text>
      <text x="535" y="155" textAnchor="middle" fill="#5a5a64" fontFamily="JetBrains Mono, monospace" fontSize="9">unchanged</text>
    </g>

    {/* Edges */}
    <path d="M 154 90 L 220 90" stroke="rgb(232,145,89)" strokeWidth="1.5" fill="none" markerEnd="url(#arr)"/>
    <path d="M 380 80 C 410 80 420 44 450 44" stroke="rgb(101,165,245)" strokeWidth="1.5" fill="none" markerEnd="url(#arr)"/>
    <path d="M 380 100 C 410 100 420 136 450 136" stroke="#3b3b44" strokeWidth="1.5" strokeDasharray="4 3" fill="none" markerEnd="url(#arrm)"/>

    {/* labels on edges */}
    <text x="187" y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="rgb(232,145,89)">OTLP</text>

    <defs>
      <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(101,165,245)"/>
      </marker>
      <marker id="arrm" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b3b44"/>
      </marker>
    </defs>
  </svg>
);

const RoadRow = ({stage, status, title, sub}) => {
  const tones = {
    ready: { bg: 'color-mix(in srgb, var(--color-green-500) 12%, transparent)', col: 'var(--color-green-500)' },
    next:  { bg: 'color-mix(in srgb, var(--color-orange-300) 14%, transparent)', col: 'var(--color-orange-300)' },
    later: { bg: '#0a0a0c', col: 'var(--color-gray-dark-500)' }
  };
  const t = tones[status];
  return (
    <div style={{display:'grid', gridTemplateColumns:'46px 64px 1fr', gap:12, alignItems:'center', padding:'8px 10px', background:'#08080a', border:'1px solid var(--color-gray-dark-800)', borderRadius:8}}>
      <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-gray-dark-100)'}}>{stage}</div>
      <div style={{
        padding:'2px 8px',
        background: t.bg,
        color: t.col,
        fontFamily:'JetBrains Mono, monospace', fontSize:10,
        textTransform:'uppercase', letterSpacing:'0.06em',
        borderRadius:999,
        textAlign:'center',
        fontWeight:600
      }}>{status}</div>
      <div>
        <div style={{fontSize:12, color:'var(--color-foreground-neutral)', fontWeight:500}}>{title}</div>
        <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>{sub}</div>
      </div>
    </div>
  );
};

Object.assign(window, {
  ArtObsLogsLiveTail,
  ArtObsLogsSearch,
  ArtObsLogInspector,
  ArtObsDisabledState,
  ArtObsStatusCard
});
