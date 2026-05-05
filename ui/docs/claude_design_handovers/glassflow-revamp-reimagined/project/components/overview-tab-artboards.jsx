// =============================================================
// T-04 — Pipeline Detail · Overview tab artboards
// =============================================================
// Local cockpit for one pipeline. Sits at the top of every pipeline page
// (default tab; siblings are Canvas, Metrics, Logs, DLQ, Versions, Library).
//
// Goal: in 5 seconds, answer "is this pipeline OK and what should I look at?"
// without forcing the user to leave for the heavy detail tabs.
//
// Builds on:
//   - bridge.css         (br-pip-dot, br-title, chip)
//   - observability.css  (ob-tabs, ob-pill, ob-live, ob-spark)
//   - overview-tab.css   (ot-stats, ot-topology, ot-tiles, ot-feed, ot-rail)

const {
  Icon: OTIcon,
  OBLive, OBPipelineHeader, OBTabs, OBSpark, obSeries,
  BRVersionPill,
} = window;

// ----- shared bits -------------------------------------------------------

// Top of any pipeline page: header + tabs in one block. We keep the same
// chrome on every tab so users feel they are inside one detail view.
const PipeChrome = ({ name = "checkout-orders", env = "prod", revision = "v12 · 8c4ad21",
                     status = "running", paused = false, attnBadge = null }) => (
  <div style={{padding:'24px 26px 0'}}>
    <OBPipelineHeader name={name} env={env} revision={revision} status={status}>
      <div className="flex items-center gap-2">
        <OBLive paused={paused} rate={status === 'running' ? '4.2k/sec' : undefined}/>
        <button className="btn btn-ghost btn-sm">
          <OTIcon name={paused ? "play" : "stop"} size={12}/>
          {paused ? "Resume" : "Pause"}
        </button>
        <button className="btn btn-ghost btn-sm">
          <OTIcon name="edit" size={12}/>
          Edit in canvas
        </button>
        <button className="btn btn-primary btn-sm">
          <OTIcon name="rocket" size={12}/>
          Deploy
        </button>
      </div>
    </OBPipelineHeader>
    <OBTabs
      tabs={[
        "Overview",
        "Canvas",
        "Metrics",
        "Logs",
        { label: "DLQ", badge: attnBadge?.dlq },
        "Versions",
        "Library",
        "Settings",
      ]}
      active="Overview"
    />
  </div>
);

// Stat card (top row). Tone drives color.
const StatCard = ({ label, value, unit, delta, deltaTone, tone = "good", spark, sparkColor }) => (
  <div className={"ot-stat tone-" + tone}>
    <div className="lbl">{label}</div>
    <div className="val">
      {value}
      {unit && <span className="unit">{unit}</span>}
    </div>
    {delta && <div className={"delta " + (deltaTone || "")}>{delta}</div>}
    {spark && (
      <div className="spark">
        <OBSpark values={spark} color={sparkColor || "var(--color-orange-300)"} width={220} height={28}/>
      </div>
    )}
  </div>
);

// Quick-link tile to another tab. ic = icon, status = small line under title.
const QuickTile = ({ icon, name, blurb, stat, statSub, tone, attn }) => (
  <div className={"ot-tile" + (tone === 'warn' ? ' has-attn' : tone === 'bad' ? ' has-bad' : '')}>
    <div className="row1">
      <span className="ic"><OTIcon name={icon} size={14}/></span>
      <h5>{name}</h5>
      {attn && (
        <span className="badge" style={{
          background:'var(--color-red-500)', color:'#fff',
          fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4,
          fontFamily:'JetBrains Mono, monospace', letterSpacing:0.04,
        }}>{attn}</span>
      )}
      <span className="arrow"><OTIcon name="chevR" size={12}/></span>
    </div>
    <p>{blurb}</p>
    {stat && <div className="stat">{stat}{statSub && <span className="sub">{statSub}</span>}</div>}
  </div>
);

// Activity feed row.
const FeedRow = ({ kind = "ok", icon, when, title, sub, who }) => (
  <div className={"ot-feed-row " + kind}>
    <span className="dot"><OTIcon name={icon} size={12}/></span>
    <span className="when">{when}</span>
    <span className="body">
      <div className="title">{title}</div>
      {sub && <div className="sub">{sub}</div>}
    </span>
    <span className="who">{who}</span>
  </div>
);

// Right-rail health check row.
const Check = ({ kind = "ok", name, val }) => (
  <div className={"ot-check " + kind}>
    <span className="icon-wrap">
      <OTIcon name={kind === 'ok' ? 'check' : kind === 'warn' ? 'warn' : 'x'} size={9} strokeWidth={2.5}/>
    </span>
    <span className="name">{name}</span>
    <span className="val">{val}</span>
  </div>
);

// Mini topology stage cell.
const Stage = ({ icon, role, name, meta, stat, tone }) => (
  <div className="ot-stage">
    <div className={"pill " + (tone === 'warn' ? 'warn' : tone === 'bad' ? 'bad' : '')}>
      <span className="ic"><OTIcon name={icon} size={12}/></span>
      <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis'}}>{name}</span>
    </div>
    <div className="role">{role}</div>
    {meta && <div className="meta">{meta}</div>}
    {stat && <div className="stat-tiny">{stat}</div>}
  </div>
);
const Edge = ({ label }) => (
  <div className="ot-edge">{label && <div className="lbl">{label}</div>}</div>
);

// ============================================================
// ARTBOARD 1 — Healthy pipeline cockpit
// ============================================================
const ArtPipeOverviewHealthy = () => {
  const ingest  = obSeries({seed: 11, n: 32, base: 4200, amp: 600, drift: 1});
  const lag     = obSeries({seed: 12, n: 32, base: 78, amp: 14, drift: 0.05});
  const dlq     = obSeries({seed: 13, n: 32, base: 0.4, amp: 0.5, floor: 0});
  const errPct  = obSeries({seed: 14, n: 32, base: 0.02, amp: 0.04, floor: 0});

  return (
    <div data-screen-label="Pipeline Overview · healthy" style={{background:'#08080a', minHeight:'100%', color:'var(--color-foreground-neutral)', fontFamily:'var(--font-family-body)'}}>
      <PipeChrome
        name="checkout-orders"
        env="prod"
        revision="v12 · deployed 4d ago"
        status="running"
      />
      <div style={{padding:'4px 26px 26px'}}>
        <div className="ot-page">
          {/* MAIN COLUMN ----------------------------------------- */}
          <div>
            {/* KPI strip */}
            <div className="ot-stats">
              <StatCard
                label="status"
                value="running"
                tone="good"
                delta="uptime 14d 6h"
                spark={obSeries({seed: 5, n: 32, base: 0.99, amp: 0.005, floor: 0.95})}
                sparkColor="var(--color-green-500)"
              />
              <StatCard
                label="throughput"
                value="4.2k"
                unit="msg/s"
                tone="good"
                delta="+2.1% vs 1h"
                deltaTone="up"
                spark={ingest}
                sparkColor="var(--color-orange-300)"
              />
              <StatCard
                label="lag · p95"
                value="78"
                unit="ms"
                tone="good"
                delta="−4ms vs 1h"
                deltaTone="up"
                spark={lag}
                sparkColor="var(--color-blue-500)"
              />
              <StatCard
                label="DLQ · 24h"
                value="3"
                unit="msgs"
                tone="good"
                delta="0.07% of volume"
                spark={dlq}
                sparkColor="var(--color-yellow-400)"
              />
            </div>

            {/* Topology mini-map */}
            <div className="ot-section-head">
              <h3>Topology</h3>
              <span className="rule"/>
              <a>Open in canvas <OTIcon name="chevR" size={10}/></a>
            </div>
            <div className="ot-topology">
              <Stage icon="kafka" role="source"  name="orders.events" meta="kafka · 12 partitions" stat={<><span>•</span><strong>4.2k/s</strong></>}/>
              <Edge label="JSON · 1.4 MB/s"/>
              <Stage icon="dedup"     role="transform" name="dedup-idem-key" meta="window: 30s" stat={<><span>dedup rate</span><strong>0.3%</strong></>}/>
              <Edge/>
              <Stage icon="filter"    role="transform" name="filter-test-traffic" meta="drop where env=test" stat={<><span>kept</span><strong>96.4%</strong></>}/>
              <Edge/>
              <Stage icon="schema"    role="transform" name="orders-v3" meta="map · 18 fields" stat={<><span>p50</span><strong>32ms</strong></>}/>
              <Edge label="Avro"/>
              <Stage icon="ch" role="sink" name="orders_fact" meta="clickhouse · prod-eu" stat={<><span>writes</span><strong>4.18k/s</strong></>}/>
            </div>

            {/* Quick-link tiles */}
            <div className="ot-section-head">
              <h3>Jump to</h3>
              <span className="rule"/>
            </div>
            <div className="ot-tiles">
              <QuickTile icon="obs" name="Metrics"
                blurb="Throughput, latency, DLQ — pipeline-scoped."
                stat="all green" statSub="last hour"/>
              <QuickTile icon="warn" name="DLQ"
                blurb="Dead-letter queue. Replay & inspect failures."
                stat="3 msgs" statSub="last 24h"/>
              <QuickTile icon="library" name="Library deps"
                blurb="Sources, transforms & sinks this pipeline uses."
                stat="5 components" statSub="all in sync"/>
              <QuickTile icon="history" name="Versions"
                blurb="Deploy history, diffs, and rollback."
                stat="v12" statSub="4d ago · @maria"/>
              <QuickTile icon="folder" name="Logs"
                blurb="Live tail across all components."
                stat="0 errors" statSub="last hour"/>
              <QuickTile icon="ai" name="Ask AI"
                blurb="Investigate issues or propose changes."
                stat="ready"/>
            </div>

            {/* Activity feed */}
            <div className="ot-section-head">
              <h3>Recent activity</h3>
              <span className="rule"/>
              <a>View all <OTIcon name="chevR" size={10}/></a>
            </div>
            <div className="ot-feed">
              <FeedRow kind="deploy"
                icon="rocket" when="4d ago"
                title="v12 deployed to prod"
                sub="diff: orders-v3 add field `promo_id` · zero downtime"
                who="@maria"/>
              <FeedRow kind="lib"
                icon="library" when="4d ago"
                title="schema orders-v3 published"
                sub="library/schemas/orders v2 → v3 · adopted by 3 pipelines"
                who="@maria"/>
              <FeedRow kind="ok"
                icon="check" when="6d ago"
                title="dedup-idem-key tightened window 60s → 30s"
                sub="canvas edit · auto-tested in staging"
                who="@maria"/>
              <FeedRow kind="ok"
                icon="check" when="9d ago"
                title="connector kafka-prod-eu rotated credentials"
                sub="library/connectors/kafka-prod-eu · scheduled rotation"
                who="system"/>
              <FeedRow kind="deploy"
                icon="rocket" when="14d ago"
                title="v11 deployed to prod"
                sub="initial release of test-traffic filter"
                who="@kenji"/>
            </div>
          </div>

          {/* RIGHT RAIL ------------------------------------------ */}
          <div className="ot-rail">
            <div className="ot-rail-card tone-good">
              <h6>Health <span className="right">10/10 checks</span></h6>
              <div className="ot-health-headline">
                <span className="pill ok">healthy</span>
                <span>Running clean</span>
              </div>
              <div className="ot-checks">
                <Check kind="ok" name="Source reachable"      val="kafka · 4ms"/>
                <Check kind="ok" name="Sink reachable"        val="ch · 6ms"/>
                <Check kind="ok" name="Schema in sync"        val="orders-v3"/>
                <Check kind="ok" name="Credentials valid"     val="36d left"/>
                <Check kind="ok" name="Lag p95 within SLO"    val="78 / 200ms"/>
                <Check kind="ok" name="Error rate within SLO" val="0.02 / 0.5%"/>
                <Check kind="ok" name="DLQ rate within SLO"   val="0.07 / 1%"/>
                <Check kind="ok" name="No drift detected"     val="—"/>
                <Check kind="ok" name="Backfill not running"  val="—"/>
                <Check kind="ok" name="No active alerts"      val="—"/>
              </div>
            </div>

            <div className="ot-rail-card">
              <h6>Library snapshot <span className="right">v12</span></h6>
              <div className="ot-snap-row">
                <span className="ic"><OTIcon name="kafka" size={13}/></span>
                <span className="name">kafka-prod-eu<span className="kind">connector</span></span>
                <BRVersionPill v="v3" current/>
              </div>
              <div className="ot-snap-row">
                <span className="ic"><OTIcon name="schema" size={13}/></span>
                <span className="name">orders-v3<span className="kind">schema</span></span>
                <BRVersionPill v="v3" current/>
              </div>
              <div className="ot-snap-row">
                <span className="ic"><OTIcon name="dedup" size={13}/></span>
                <span className="name">dedup-idem-key<span className="kind">transform</span></span>
                <BRVersionPill v="v2" current/>
              </div>
              <div className="ot-snap-row">
                <span className="ic"><OTIcon name="filter" size={13}/></span>
                <span className="name">filter-test-traffic<span className="kind">transform</span></span>
                <BRVersionPill v="v1" current/>
              </div>
              <div className="ot-snap-row">
                <span className="ic"><OTIcon name="ch" size={13}/></span>
                <span className="name">clickhouse-prod<span className="kind">connector</span></span>
                <BRVersionPill v="v5" current/>
              </div>
            </div>

            <div className="ot-rail-card">
              <h6>About</h6>
              <dl className="ot-meta">
                <dt>owner</dt><dd>@maria · payments</dd>
                <dt>created</dt><dd>2025-08-14</dd>
                <dt>environment</dt><dd>prod-eu <span className="chip chip-warn" style={{padding:'1px 6px', fontSize:9}}>prod</span></dd>
                <dt>SLO</dt><dd>p95 &lt; 200ms · err &lt; 0.5%</dd>
                <dt>cost · 24h</dt><dd>$3.12</dd>
                <dt>tags</dt><dd>
                  <span className="chip" style={{padding:'1px 6px', fontSize:9}}>orders</span>
                  <span className="chip" style={{padding:'1px 6px', fontSize:9}}>realtime</span>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ARTBOARD 2 — Pipeline with active issues
// ============================================================
const ArtPipeOverviewIssue = () => {
  const ingest = obSeries({seed: 21, n: 32, base: 3800, amp: 700, drift: -2, dipAt: 22});
  const lag    = obSeries({seed: 22, n: 32, base: 240, amp: 30, drift: 4, spike: {at: 24, amount: 180}});
  const dlq    = obSeries({seed: 23, n: 32, base: 6, amp: 4, drift: 0.6, spike: {at: 24, amount: 28}, floor: 0});
  const errPct = obSeries({seed: 24, n: 32, base: 0.6, amp: 0.4, drift: 0.05, spike: {at: 24, amount: 2.1}, floor: 0});

  return (
    <div data-screen-label="Pipeline Overview · degraded" style={{background:'#08080a', minHeight:'100%', color:'var(--color-foreground-neutral)', fontFamily:'var(--font-family-body)'}}>
      <PipeChrome
        name="user-events-enrich"
        env="prod"
        revision="v18 · deployed 22m ago"
        status="warning"
        attnBadge={{ dlq: 47 }}
      />
      <div style={{padding:'4px 26px 26px'}}>

        {/* Top banner — explain WHY this is degraded, link to fix */}
        <div className="ot-banner" style={{marginTop:6}}>
          <span className="icon"><OTIcon name="warn" size={14}/></span>
          <div style={{flex:1}}>
            <div><strong>SLO breach — lag p95 above 200ms for 18m.</strong> Sink <span className="mono" style={{color:'var(--color-foreground-neutral)'}}>postgres-users</span> connection pool saturated since 14:24.</div>
            <div className="mono" style={{fontSize:11, color:'var(--color-gray-dark-500)', marginTop:3}}>
              first seen 14:24 · alerted #data-platform · pageable in 22m if unresolved
            </div>
          </div>
          <button className="btn btn-ghost btn-sm">
            <OTIcon name="ai" size={12}/>
            Investigate with AI
          </button>
          <button className="btn btn-primary btn-sm">Open metrics</button>
        </div>

        <div className="ot-page" style={{marginTop:14}}>
          <div>
            <div className="ot-stats">
              <StatCard
                label="status"
                value="degraded"
                tone="warn"
                delta="since 14:24"
                spark={obSeries({seed: 99, n: 32, base: 0.9, amp: 0.06, drift: -0.01, floor: 0.7})}
                sparkColor="var(--color-yellow-400)"
              />
              <StatCard
                label="throughput"
                value="3.1k"
                unit="msg/s"
                tone="warn"
                delta="−18% vs 1h"
                deltaTone="down"
                spark={ingest}
                sparkColor="var(--color-orange-300)"
              />
              <StatCard
                label="lag · p95"
                value="412"
                unit="ms"
                tone="bad"
                delta="↑ +334ms · breach"
                deltaTone="down"
                spark={lag}
                sparkColor="var(--color-red-500)"
              />
              <StatCard
                label="DLQ · 1h"
                value="47"
                unit="msgs"
                tone="bad"
                delta="↑ from 0/h · 28 in last 5m"
                deltaTone="down"
                spark={dlq}
                sparkColor="var(--color-red-500)"
              />
            </div>

            <div className="ot-section-head">
              <h3>Topology</h3>
              <span className="rule"/>
              <span className="meta">red border = bottleneck</span>
            </div>
            <div className="ot-topology">
              <Stage icon="kafka" role="source" name="user.events" meta="kafka · 24 partitions" stat={<><span>•</span><strong>3.1k/s</strong></>}/>
              <Edge/>
              <Stage icon="schema" role="transform" name="users-v2" meta="map · 12 fields" stat={<><span>p50</span><strong>28ms</strong></>}/>
              <Edge/>
              <Stage icon="transform" role="transform" name="enrich-geo" meta="cache hit 94%" stat={<><span>p99</span><strong>92ms</strong></>}/>
              <Edge label="↓ saturated"/>
              <Stage icon="ch" role="sink" name="postgres-users" meta="rds · primary"
                tone="bad" stat={<><span>pool</span><strong style={{color:'var(--color-red-500)'}}>40 / 40</strong></>}/>
            </div>

            <div className="ot-section-head">
              <h3>Jump to</h3>
              <span className="rule"/>
            </div>
            <div className="ot-tiles">
              <QuickTile icon="warn" name="DLQ" tone="bad" attn="47"
                blurb="Spike: 28 failures in last 5m — same error class."
                stat="ConnectionTimeout" statSub="× 47"/>
              <QuickTile icon="obs" name="Metrics" tone="bad"
                blurb="Lag p95 has been above SLO for 18 minutes."
                stat="412ms" statSub="SLO 200ms"/>
              <QuickTile icon="library" name="Library deps" tone="warn"
                blurb="postgres-users pool size is set in connector library."
                stat="1 hot edit" statSub="from this incident"/>
              <QuickTile icon="history" name="Versions" tone="warn"
                blurb="Last deploy 22m ago changed enrich-geo. Rollback?"
                stat="v18 → v17" statSub="rollback ready"/>
              <QuickTile icon="folder" name="Logs"
                blurb="Live tail — filter to errors."
                stat="47 errors" statSub="last 5m"/>
              <QuickTile icon="ai" name="Ask AI"
                blurb="Auto-suggested: pool exhaustion + replay plan."
                stat="3 hypotheses" statSub="ready"/>
            </div>

            <div className="ot-section-head">
              <h3>Recent activity</h3>
              <span className="rule"/>
              <a>View all <OTIcon name="chevR" size={10}/></a>
            </div>
            <div className="ot-feed">
              <FeedRow kind="error"
                icon="warn" when="2m ago"
                title="DLQ spike — 28 messages in 5 minutes"
                sub="all errors: ConnectionTimeout · sink postgres-users"
                who="alert"/>
              <FeedRow kind="error"
                icon="warn" when="14m ago"
                title="SLO breach: lag p95 above 200ms"
                sub="paged #data-platform · escalates in 22m"
                who="alert"/>
              <FeedRow kind="drift"
                icon="drift" when="22m ago"
                title="Drift detected on connector postgres-users"
                sub="library expects pool=80, prod is using pool=40"
                who="system"/>
              <FeedRow kind="deploy"
                icon="rocket" when="22m ago"
                title="v18 deployed to prod"
                sub="changed enrich-geo · added country-code fallback"
                who="@kenji"/>
              <FeedRow kind="lib"
                icon="library" when="3h ago"
                title="connector postgres-users edited (not deployed)"
                sub="library/connectors/postgres-users · pool 80 → 40 · drafted"
                who="@kenji"/>
            </div>
          </div>

          {/* Right rail — issue mode */}
          <div className="ot-rail">
            <div className="ot-rail-card tone-bad">
              <h6>Health <span className="right">7/10 checks</span></h6>
              <div className="ot-health-headline">
                <span className="pill bad">degraded</span>
                <span>3 checks failing</span>
              </div>
              <div className="ot-checks">
                <Check kind="ok"   name="Source reachable"      val="kafka · 4ms"/>
                <Check kind="bad"  name="Sink reachable"        val="pool full"/>
                <Check kind="ok"   name="Schema in sync"        val="users-v2"/>
                <Check kind="ok"   name="Credentials valid"     val="36d left"/>
                <Check kind="bad"  name="Lag p95 within SLO"    val="412 / 200ms"/>
                <Check kind="warn" name="Error rate within SLO" val="2.4 / 0.5%"/>
                <Check kind="bad"  name="DLQ rate within SLO"   val="3.1 / 1%"/>
                <Check kind="warn" name="No drift detected"     val="postgres-users"/>
                <Check kind="ok"   name="Backfill not running"  val="—"/>
                <Check kind="warn" name="No active alerts"      val="2 firing"/>
              </div>
            </div>

            <div className="ot-rail-card tone-warn">
              <h6>Quick actions</h6>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                <button className="btn btn-primary btn-sm" style={{justifyContent:'flex-start', width:'100%'}}>
                  <OTIcon name="ai" size={12}/>
                  Investigate with AI
                </button>
                <button className="btn btn-secondary btn-sm" style={{justifyContent:'flex-start', width:'100%'}}>
                  <OTIcon name="undo" size={12}/>
                  Roll back to v17
                </button>
                <button className="btn btn-secondary btn-sm" style={{justifyContent:'flex-start', width:'100%'}}>
                  <OTIcon name="stop" size={12}/>
                  Pause pipeline
                </button>
                <button className="btn btn-secondary btn-sm" style={{justifyContent:'flex-start', width:'100%'}}>
                  <OTIcon name="link" size={12}/>
                  Replay 47 DLQ msgs
                </button>
              </div>
            </div>

            <div className="ot-rail-card">
              <h6>About</h6>
              <dl className="ot-meta">
                <dt>owner</dt><dd>@kenji · platform</dd>
                <dt>created</dt><dd>2025-09-02</dd>
                <dt>environment</dt><dd>prod-eu <span className="chip chip-warn" style={{padding:'1px 6px', fontSize:9}}>prod</span></dd>
                <dt>SLO</dt><dd>p95 &lt; 200ms · err &lt; 0.5%</dd>
                <dt>cost · 24h</dt><dd>$8.40</dd>
                <dt>on-call</dt><dd>@kenji · paged 14:38</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  ArtPipeOverviewHealthy,
  ArtPipeOverviewIssue,
});
