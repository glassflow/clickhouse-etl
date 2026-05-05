// =============================================================
// observability-artboards1.jsx
// O1 — Metrics dashboard (populated, full grid)
// O2 — Metric focus / drill-down (component breakdown)
// O3 — Loading & sparse-data states
// =============================================================
const {
  Icon: OBAIcon,
  OBChart, OBChartSVG, OBSpark, OBRangePicker, OBPill, OBScopeBadge,
  OBLive, OBPipelineHeader, OBTabs, OBNote, obSeries
} = window;

// Tokens (string refs to CSS variables — chart consumers want literals)
const TOK = {
  ingestor: 'rgb(101, 165, 245)',     // blue-500-ish
  processor: 'rgb(232, 145, 89)',     // orange-300
  sink: 'rgb(102, 198, 132)',         // green-500-ish
  api: 'rgb(180, 180, 195)',
  ui: 'rgb(120, 120, 132)',
  warn: 'rgb(232, 197, 89)',
  error: 'rgb(238, 95, 95)',
  muted: 'rgb(78, 78, 88)'
};

// ============================================================
// O1 — Metrics dashboard (populated, primary surface)
// ============================================================
const ArtObsMetricsDashboard = () => {
  // Build series — drift up over the hour, occasional spike
  const ingest = obSeries({seed: 11, n: 72, base: 4200, amp: 800, drift: 6, spike: {at: 48, amount: 1800}});
  const written = ingest.map((v, i) => v - 60 + Math.sin(i / 5) * 120); // tracks ingest, slight lag
  const p50 = obSeries({seed: 21, n: 72, base: 32, amp: 6, drift: 0.05});
  const p95 = obSeries({seed: 22, n: 72, base: 78, amp: 14, drift: 0.12});
  const p99 = obSeries({seed: 23, n: 72, base: 142, amp: 22, drift: 0.25, spike: {at: 48, amount: 240}});
  const dlq = obSeries({seed: 31, n: 72, base: 0.4, amp: 0.6, drift: 0.005, spike: {at: 48, amount: 8}, floor: 0});
  const bytesIn = obSeries({seed: 41, n: 72, base: 1.4, amp: 0.45, drift: 0.003}); // MB/s

  return (
    <div className="ob-scene">
      <div className="ob-scene-inner">
        <OBPipelineHeader
          name="prod-orders-to-analytics"
          env="prod"
          revision="rev 8 · deployed 11d ago"
          status="running"
        >
          <button className="btn btn-ghost btn-sm"><OBAIcon name="stop" size={12}/> Pause</button>
          <button className="btn btn-secondary btn-sm"><OBAIcon name="edit" size={12}/> Open in canvas</button>
        </OBPipelineHeader>

        <OBTabs
          tabs={[
            'Overview',
            'Canvas',
            'Library links',
            { label: 'Metrics' },
            { label: 'Logs', badge: 'live' },
            'Settings'
          ]}
          active="Metrics"
        />

        {/* Toolbar */}
        <div className="ob-toolbar">
          <OBRangePicker value="1h"/>
          <span style={{flex: '0 0 8px'}}/>
          <span style={{fontSize:10.5, color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600}}>by component</span>
          <div className="ob-pillrow">
            <OBPill label="ingestor" color={TOK.ingestor}/>
            <OBPill label="processor" color={TOK.processor}/>
            <OBPill label="sink" color={TOK.sink}/>
          </div>
          <div style={{flex:1}}/>
          <OBScopeBadge id="prod-orders-analytics-h8z9a"/>
          <button className="btn btn-ghost btn-sm" title="Auto-refresh"><OBAIcon name="history" size={11}/> 30s</button>
        </div>

        {/* Hero summary cards */}
        <div className="ob-grid cols-3" style={{marginBottom:14}}>
          <SumCard label="records ingested" value="4.2k" unit="/sec" delta="+2.1% vs 1h" tone="up"
                   data={obSeries({seed: 1, n: 28, base: 4200, amp: 600})} color={TOK.ingestor}/>
          <SumCard label="processing latency · p99" value="184" unit="ms" delta="↑ +18ms · spike at 12:42" tone="warn"
                   data={obSeries({seed: 2, n: 28, base: 142, amp: 22, spike: {at: 19, amount: 90}})} color={TOK.warn}/>
          <SumCard label="dlq rate" value="0.4" unit="msg/min" delta="1 spike to 8/min · 18m ago" tone="warn"
                   data={obSeries({seed: 3, n: 28, base: 0.4, amp: 0.6, spike: {at: 19, amount: 4}, floor: 0})} color={TOK.error}/>
        </div>

        {/* Chart grid */}
        <div className="ob-grid">
          <OBChart
            title="Records ingested · by component"
            sub="gfm_records_ingested_total · rate(1m) · /sec"
            value="4 218" unit="/s"
            delta="+2.1%" deltaTone="up"
            series={[
              { values: ingest, color: TOK.ingestor, fill: TOK.ingestor }
            ]}
            legend={[
              { label: 'ingestor', color: TOK.ingestor, value: '4 218/s' }
            ]}
          />

          <OBChart
            title="Records written · sink"
            sub="gfm_records_written_total · rate(1m) · /sec"
            value="4 154" unit="/s"
            delta="−1.5% lag vs ingest" deltaTone="warn"
            series={[
              { values: ingest, color: TOK.ingestor, dashed: true },
              { values: written, color: TOK.sink, fill: TOK.sink }
            ]}
            legend={[
              { label: 'sink (written)', color: TOK.sink, value: '4 154/s' },
              { label: 'ingestor (ref)', color: TOK.ingestor, dashed: true }
            ]}
          />

          <OBChart
            title="Processing latency · p50 / p95 / p99"
            sub="gfm_record_processing_seconds · histogram_quantile · ms"
            value="184" unit="ms (p99)"
            delta="↑ +18ms" deltaTone="warn"
            series={[
              { values: p99, color: TOK.warn },
              { values: p95, color: TOK.processor },
              { values: p50, color: TOK.muted }
            ]}
            legend={[
              { label: 'p50', color: TOK.muted, value: '34ms' },
              { label: 'p95', color: TOK.processor, value: '92ms' },
              { label: 'p99', color: TOK.warn, value: '184ms' }
            ]}
          />

          <OBChart
            title="Dead-letter rate"
            sub="gfm_dlq_messages_total · rate(1m) · /min"
            value="0.4" unit="/min"
            delta="spike: 8/min at 12:42" deltaTone="warn"
            series={[
              { values: dlq, color: TOK.error, fill: TOK.error }
            ]}
            yMax={10}
            legend={[
              { label: 'dlq · all components', color: TOK.error, value: '47 msgs · 1h' }
            ]}
          />

          <OBChart
            title="Bytes/sec · ingest"
            sub="gfm_bytes_ingested_total · rate(1m) · MB/s"
            value="1.46" unit="MB/s"
            delta="+1.4% vs 1h" deltaTone="up"
            series={[
              { values: bytesIn, color: TOK.ingestor, fill: TOK.ingestor }
            ]}
            legend={[
              { label: 'ingestor', color: TOK.ingestor, value: '1.46 MB/s · 5.3 GB · 1h' }
            ]}
          />

          {/* DLQ peek card — bridges to existing DLQ artboard */}
          <div className="ob-chart" style={{justifyContent:'space-between'}}>
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title"><OBAIcon name="warn" size={12} color="var(--color-yellow-400)"/> Dead-letter queue</div>
                <div className="ob-chart-sub">click any spike on the chart at left to scope below</div>
              </div>
              <div className="ob-chart-current">
                <div className="value">47<span className="unit"> msgs · 1h</span></div>
                <div className="delta warn">12 unconsumed</div>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:11.5, fontFamily:'JetBrains Mono, monospace', color:'var(--color-gray-dark-100)'}}>
              <DLQRow time="12:42:03" comp="processor" reason="schema_mismatch" count={32}/>
              <DLQRow time="12:38:51" comp="sink"      reason="ch_insert_failed" count={9}/>
              <DLQRow time="12:21:14" comp="processor" reason="json_parse_error" count={4}/>
              <DLQRow time="11:58:02" comp="processor" reason="schema_mismatch" count={2}/>
            </div>
            <div style={{display:'flex', gap:6, marginTop:6}}>
              <button className="btn btn-ghost btn-sm">Open DLQ viewer</button>
              <button className="btn btn-ghost btn-sm">Replay…</button>
              <div style={{flex:1}}/>
              <button className="btn btn-ghost btn-sm">Purge…</button>
            </div>
          </div>
        </div>

        <OBNote>
          Every chart is read from VictoriaMetrics with an enforced <span style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-foreground-neutral)'}}>pipeline_id="…h8z9a"</span> label
          — the conflated-metrics bug the old ClickHouse-system-tables path produced cannot recur. The "scoped" badge in the toolbar reinforces this on every page load.
        </OBNote>
      </div>
    </div>
  );
};

// Hero summary card with sparkline
const SumCard = ({label, value, unit, delta, tone = 'up', data, color}) => (
  <div className="ob-sumcard">
    <div className="label">{label}</div>
    <div className="value">{value}{unit && <span className="unit">{unit}</span>}</div>
    <div className={"delta " + tone}>{delta}</div>
    <OBSpark values={data} color={color} width={300} height={36}/>
  </div>
);

const DLQRow = ({time, comp, reason, count}) => (
  <div style={{display:'flex', alignItems:'baseline', gap:8, padding:'4px 0', borderBottom:'1px dashed var(--color-gray-dark-800)'}}>
    <span style={{color:'var(--color-gray-dark-500)', fontSize:10.5}}>{time}</span>
    <span style={{color:'var(--color-gray-dark-100)', textTransform:'uppercase', fontSize:9.5, letterSpacing:'0.06em'}}>{comp}</span>
    <span style={{color:'var(--color-yellow-400)', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis'}}>{reason}</span>
    <span style={{color:'var(--color-foreground-neutral)', fontWeight:600}}>×{count}</span>
  </div>
);

// ============================================================
// O2 — Metric drill-down · component breakdown
// ============================================================
const ArtObsMetricFocus = () => {
  const ingestor  = obSeries({seed: 50, n: 96, base: 1450, amp: 220, drift: 1});
  const processor = obSeries({seed: 51, n: 96, base: 1420, amp: 210, drift: 1, spike:{at: 64, amount: 600}});
  const sink      = obSeries({seed: 52, n: 96, base: 1380, amp: 240, drift: 0.9, spike:{at: 66, amount: -400}, floor: 200});

  return (
    <div className="ob-scene">
      <div className="ob-scene-inner">
        {/* Light header — drilled in from Metrics */}
        <div className="br-crumbs">
          <OBAIcon name="pipelines" size={12}/>
          <a>Pipelines</a> <OBAIcon name="chevR" size={10}/>
          <a>prod-orders-to-analytics</a> <OBAIcon name="chevR" size={10}/>
          <a>Metrics</a> <OBAIcon name="chevR" size={10}/>
          <span style={{color:'var(--color-foreground-neutral)'}}>Records throughput · component breakdown</span>
        </div>

        <div className="flex items-center gap-3" style={{marginTop:8, marginBottom:14}}>
          <h1 className="br-title" style={{margin:0}}>Records throughput</h1>
          <span className="mono" style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>gfm_records_processed_total · rate(1m)</span>
          <div style={{flex:1}}/>
          <OBLive paused={false} rate="updated 4s ago"/>
          <button className="btn btn-ghost btn-sm">← Back to grid</button>
        </div>

        <div className="ob-toolbar">
          <OBRangePicker value="6h"/>
          <span style={{flex:'0 0 8px'}}/>
          <span style={{fontSize:10.5, color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600}}>components</span>
          <div className="ob-pillrow">
            <OBPill label="ingestor" color={TOK.ingestor}/>
            <OBPill label="processor" color={TOK.processor}/>
            <OBPill label="sink" color={TOK.sink}/>
            <OBPill label="api" color={TOK.api} on={false}/>
            <OBPill label="ui" color={TOK.ui} on={false}/>
          </div>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost btn-sm">Stack</button>
          <button className="btn btn-ghost btn-sm">Δ from baseline</button>
          <OBScopeBadge id="prod-orders-analytics-h8z9a"/>
        </div>

        {/* Big chart with component split + brushed range */}
        <div className="ob-chart" style={{padding: '18px 22px 12px'}}>
          <div className="ob-chart-head">
            <div>
              <div className="ob-chart-title">Throughput · ingestor / processor / sink</div>
              <div className="ob-chart-sub">last 6h · 30s buckets · {`{pipeline_id="…h8z9a", component=~"ingestor|processor|sink"}`}</div>
            </div>
            <div className="ob-chart-current">
              <div className="value">4 218<span className="unit">/sec · ingest</span></div>
              <div className="delta warn">processor backed up at 13:02 · 600 rec/s spike</div>
            </div>
          </div>
          <div className="ob-chart-body">
            <OBChartSVG
              width={1580}
              height={320}
              series={[
                { values: ingestor,  color: TOK.ingestor,  weight: 1.6, fill: TOK.ingestor },
                { values: processor, color: TOK.processor, weight: 1.6 },
                { values: sink,      color: TOK.sink,      weight: 1.6 }
              ]}
              showCrosshair={true}
              crosshairAt={0.66}
              showBrush={true}
              brushFrom={0.62} brushTo={0.74}
            />
            {/* tooltip floating near crosshair */}
            <div className="ob-tooltip" style={{left:'calc(66% - 90px)', top: 30}}>
              <div className="ts">2026-04-29 · 13:02:30 (UTC)</div>
              <div className="row"><span className="sw" style={{background: TOK.ingestor}}/><span className="name">ingestor</span><span className="val">4 412/s</span></div>
              <div className="row"><span className="sw" style={{background: TOK.processor}}/><span className="name">processor</span><span className="val">2 088/s</span></div>
              <div className="row"><span className="sw" style={{background: TOK.sink}}/><span className="name">sink</span><span className="val">1 940/s</span></div>
              <div className="row" style={{paddingTop:6, marginTop:4, borderTop:'1px solid var(--color-gray-dark-800)'}}>
                <span className="name" style={{color:'var(--color-yellow-400)'}}>processor lag</span>
                <span className="val" style={{color:'var(--color-yellow-400)'}}>2 324/s</span>
              </div>
            </div>
            {/* brush label */}
            <div className="ob-brush-label" style={{left:'calc(68% - 60px)', top: -8}}>
              13:00–13:08 · selected
            </div>
          </div>
          <div className="ob-legend">
            <div className="ob-legend-item"><span className="sw" style={{background:TOK.ingestor}}/><span>ingestor</span><span className="v">4 218/s</span></div>
            <div className="ob-legend-item"><span className="sw" style={{background:TOK.processor}}/><span>processor</span><span className="v">2 088/s · −50%</span></div>
            <div className="ob-legend-item"><span className="sw" style={{background:TOK.sink}}/><span>sink</span><span className="v">1 940/s</span></div>
            <div style={{flex:1}}/>
            <div style={{color:'var(--color-orange-300)', display:'inline-flex', alignItems:'center', gap:6, fontFamily:'JetBrains Mono, monospace'}}>
              <OBAIcon name="link" size={11}/> brushed range pinned: 13:00 – 13:08
            </div>
          </div>
        </div>

        {/* Panels under big chart — correlated metrics + jump to logs */}
        <div className="ob-grid" style={{marginTop:14}}>
          <div className="ob-chart">
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title">Latency p99 · same range</div>
                <div className="ob-chart-sub">spike correlates with the brushed window above</div>
              </div>
              <div className="ob-chart-current">
                <div className="value">312<span className="unit">ms</span></div>
                <div className="delta warn">+118ms in window</div>
              </div>
            </div>
            <OBChartSVG
              width={760}
              height={150}
              series={[{ values: obSeries({seed: 80, n: 96, base: 142, amp: 22, spike:{at: 64, amount: 170}}), color: TOK.warn, weight: 1.6, fill: TOK.warn}]}
              showBrush brushFrom={0.62} brushTo={0.74}
            />
          </div>

          <div className="ob-chart">
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title">Logs in this range</div>
                <div className="ob-chart-sub">jump to the Logs tab pre-filtered to 13:00 – 13:08</div>
              </div>
              <div className="ob-chart-current">
                <div className="value">2 084<span className="unit"> lines</span></div>
                <div className="delta warn">38 errors · 12 warns</div>
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8, padding:'4px 0 8px'}}>
              <div style={{display:'flex', gap:10, alignItems:'center'}}>
                <span style={{width:80, fontSize:10.5, color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:'JetBrains Mono, monospace'}}>processor</span>
                <div style={{flex:1, height:8, background:'#08080a', borderRadius:2, overflow:'hidden', display:'flex'}}>
                  <div style={{width:'52%', background:TOK.error}}/>
                  <div style={{width:'18%', background:TOK.warn}}/>
                  <div style={{width:'30%', background:TOK.processor, opacity:0.7}}/>
                </div>
                <span style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-foreground-neutral)'}}>1 318</span>
              </div>
              <div style={{display:'flex', gap:10, alignItems:'center'}}>
                <span style={{width:80, fontSize:10.5, color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:'JetBrains Mono, monospace'}}>ingestor</span>
                <div style={{flex:1, height:8, background:'#08080a', borderRadius:2, overflow:'hidden', display:'flex'}}>
                  <div style={{width:'2%', background:TOK.error}}/>
                  <div style={{width:'8%', background:TOK.warn}}/>
                  <div style={{width:'90%', background:TOK.ingestor, opacity:0.7}}/>
                </div>
                <span style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-foreground-neutral)'}}>522</span>
              </div>
              <div style={{display:'flex', gap:10, alignItems:'center'}}>
                <span style={{width:80, fontSize:10.5, color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:'JetBrains Mono, monospace'}}>sink</span>
                <div style={{flex:1, height:8, background:'#08080a', borderRadius:2, overflow:'hidden', display:'flex'}}>
                  <div style={{width:'4%', background:TOK.error}}/>
                  <div style={{width:'14%', background:TOK.warn}}/>
                  <div style={{width:'82%', background:TOK.sink, opacity:0.7}}/>
                </div>
                <span style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-foreground-neutral)'}}>244</span>
              </div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-secondary btn-sm"><OBAIcon name="link" size={11}/> Open Logs · pre-filtered</button>
              <button className="btn btn-ghost btn-sm">Copy LogsQL</button>
            </div>
          </div>
        </div>

        <OBNote>
          Brushing a range on any chart pins it as a global filter — every other panel and the Logs tab shrink to the same window.
          This is the killer move that makes "what happened at 13:02?" a one-click question instead of a context-switch through Grafana.
        </OBNote>
      </div>
    </div>
  );
};

// ============================================================
// O3 — Loading / sparse-data / first-run states
// ============================================================
const ArtObsLoadingStates = () => {
  return (
    <div className="ob-scene">
      <div className="ob-scene-inner">
        <div className="br-crumbs"><OBAIcon name="pipelines" size={12}/><a>Pipelines</a><OBAIcon name="chevR" size={10}/><span style={{color:'var(--color-foreground-neutral)'}}>states · gallery</span></div>
        <h1 className="br-title" style={{margin:'8px 0 4px'}}>Metrics · loading and sparse-data states</h1>
        <p className="br-subtitle">Three fallbacks that protect the dashboard's trust: still loading, just deployed (no data yet), and "we lost retention before this point." Same chart card, same density.</p>

        <div className="ob-grid">
          {/* Loading skeleton */}
          <div className="ob-chart">
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title">Records ingested</div>
                <div className="ob-chart-sub">loading · 1h · 30s buckets</div>
              </div>
              <div className="ob-chart-current">
                <div className="ob-skel" style={{width:80, height:18, marginBottom:4}}/>
                <div className="ob-skel" style={{width:60, height:10}}/>
              </div>
            </div>
            <div style={{position:'relative', height:150}}>
              <svg width="460" height="150">
                {[0,1,2,3,4].map(i => <line key={i} x1={32} x2={452} y1={6 + i*30} y2={6 + i*30} stroke="#15151b" strokeDasharray="2 4"/>)}
              </svg>
              <div className="ob-skel" style={{position:'absolute', left:32, right:8, top:60, height:2, borderRadius:1}}/>
              <div className="ob-skel" style={{position:'absolute', left:32, right:120, top:84, height:2, borderRadius:1}}/>
              <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center'}}>
                <div style={{display:'inline-flex', alignItems:'center', gap:8, fontSize:11, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', background:'#0c0c10', padding:'6px 10px', borderRadius:6, border:'1px solid var(--color-gray-dark-800)'}}>
                  <span className="ob-skel" style={{width:10, height:10, borderRadius:999}}/>
                  querying VictoriaMetrics…
                </div>
              </div>
            </div>
          </div>

          {/* No data yet — pipeline just started */}
          <div className="ob-chart">
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title">Processing latency · p99</div>
                <div className="ob-chart-sub">no data · pipeline started 38s ago</div>
              </div>
              <div className="ob-chart-current">
                <div className="value" style={{color:'var(--color-gray-dark-500)'}}>—</div>
                <div className="delta">waiting for first sample</div>
              </div>
            </div>
            <div style={{position:'relative', height:150, background:'repeating-linear-gradient(45deg, transparent 0 8px, #0a0a0d 8px 9px)', borderRadius:6, border:'1px dashed var(--color-gray-dark-800)'}}>
              <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center'}}>
                <div style={{textAlign:'center', maxWidth:280}}>
                  <div style={{fontSize:12, color:'var(--color-gray-dark-100)', fontWeight:500}}>No samples in window yet</div>
                  <div style={{fontSize:11, color:'var(--color-gray-dark-500)', marginTop:4}}>VictoriaMetrics scrapes every 15s — charts populate within ~30s of the first record.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sparse / retention edge */}
          <div className="ob-chart">
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title">Records ingested · 7d</div>
                <div className="ob-chart-sub">data only available for 6d 14h · earlier samples evicted</div>
              </div>
              <div className="ob-chart-current">
                <div className="value">3 980<span className="unit">/s avg</span></div>
                <div className="delta warn">retention boundary at left</div>
              </div>
            </div>
            <div style={{position:'relative'}}>
              <OBChartSVG
                width={460} height={150}
                series={[{values: [...Array(20).fill(0), ...obSeries({seed: 99, n: 52, base: 4000, amp: 600})], color: TOK.ingestor, fill: TOK.ingestor}]}
              />
              <div style={{position:'absolute', left: 32, top: 6, bottom: 22, width: '23%',
                background:'repeating-linear-gradient(135deg, transparent 0 6px, #15151b 6px 7px)',
                borderRight:'1px dashed var(--color-gray-dark-700)'}}/>
              <div style={{position:'absolute', left:38, top:18, fontSize:10, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>
                ← outside retention<br/>(7d default)
              </div>
            </div>
          </div>

          {/* Errored query */}
          <div className="ob-chart" style={{borderColor:'color-mix(in srgb, var(--color-red-500) 25%, var(--color-gray-dark-800))'}}>
            <div className="ob-chart-head">
              <div>
                <div className="ob-chart-title"><OBAIcon name="warn" size={12} color="var(--color-red-500)"/> Bytes/sec · ingest</div>
                <div className="ob-chart-sub" style={{color:'var(--color-red-500)'}}>query failed · vmsingle returned 503 (3/3 retries)</div>
              </div>
              <div className="ob-chart-current">
                <div className="value" style={{color:'var(--color-red-500)'}}>—</div>
                <div className="delta down">retry in 15s</div>
              </div>
            </div>
            <div style={{height:150, display:'grid', placeItems:'center', background:'color-mix(in srgb, var(--color-red-500) 4%, transparent)', borderRadius:6, border:'1px dashed color-mix(in srgb, var(--color-red-500) 30%, var(--color-gray-dark-800))'}}>
              <div style={{textAlign:'center', maxWidth:300}}>
                <div style={{fontSize:12, color:'var(--color-red-500)', fontFamily:'JetBrains Mono, monospace', fontWeight:600}}>503 service_unavailable</div>
                <div style={{fontSize:11, color:'var(--color-gray-dark-500)', marginTop:4}}>Other charts continue rendering — failure is per-query, not per-page.</div>
                <div style={{display:'flex', gap:6, justifyContent:'center', marginTop:10}}>
                  <button className="btn btn-ghost btn-sm">Retry now</button>
                  <button className="btn btn-ghost btn-sm">Copy query</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <OBNote>
          Empty- and error-states share the chart card frame so layout doesn't reflow when data arrives. Trust comes from the page <em>not flickering</em> when one query is slow.
        </OBNote>
      </div>
    </div>
  );
};

Object.assign(window, {
  ArtObsMetricsDashboard,
  ArtObsMetricFocus,
  ArtObsLoadingStates
});
