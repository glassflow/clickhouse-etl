// Pipeline list refresh (T-21) — artboards 1-3
// 1: dense table, default sort by status
// 2: grouped by team
// 3: grouped by health (triage)

const { useState: plUseState } = React;

// =====================================================================
// LOCAL PRIMITIVES
// =====================================================================

const PLChev = ({ dir = 'down', size = 8 }) => (
  <svg width={size} height={size} viewBox="0 0 8 8" fill="none">
    {dir === 'down' && <path d="M1 2 L 4 6 L 7 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>}
    {dir === 'right' && <path d="M2 1 L 6 4 L 2 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>
);

const PLArrow = () => (
  <svg width="10" height="8" viewBox="0 0 12 8" fill="none">
    <path d="M1 4 H 10 M 7 1 L 10 4 L 7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Mini sparkline for throughput cell
const PLSpark = ({ data, color = 'var(--color-orange-300)', flat }) => {
  if (flat) return <svg className="spark" viewBox="0 0 100 18" preserveAspectRatio="none"><line x1="0" y1="9" x2="100" y2="9" stroke="var(--color-gray-dark-500)" strokeWidth="0.8" strokeDasharray="2 2"/></svg>;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length-1)) * 100},${18 - ((v-min)/range) * 14 - 2}`).join(' ');
  const fillPts = `0,18 ${pts} 100,18`;
  return (
    <svg className="spark" viewBox="0 0 100 18" preserveAspectRatio="none">
      <polygon points={fillPts} fill={color} opacity="0.16"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const PLStatus = ({ s, label }) => (
  <span className={`pl-cell-status ${s}`}>
    <span className="dot"/>{label || s}
  </span>
);

const PLTypeCell = ({ kind, label }) => {
  // kind: ['ingest'], ['ingest','transform'], ['ingest','dedup'], ['ingest','join','transform'], ['ingest','filter','dedup','transform']
  const labels = {
    ingest:    { l: 'I', cls: 'gm-ingest' },
    transform: { l: 'T', cls: 'gm-transform' },
    dedup:     { l: 'D', cls: 'gm-dedup' },
    filter:    { l: 'F', cls: 'gm-filter' },
    join:      { l: 'J', cls: 'gm-join' },
    sink:      { l: 'S', cls: 'gm-sink' },
  };
  return (
    <div className="pl-cell-type">
      <span className="icons">
        {kind.map((k, i) => (
          <span key={i} className={`glyph-mini ${labels[k]?.cls}`}>{labels[k]?.l}</span>
        ))}
      </span>
      <span className="label">{label}</span>
    </div>
  );
};

const PLEnv = ({ env }) => <span className={`pl-cell-env ${env}`}>{env}</span>;

const PLFlow = ({ src, snk }) => (
  <span className="pl-cell-flow">
    <span className="src">{src}</span>
    <svg width="10" height="8" viewBox="0 0 12 8" fill="none">
      <path d="M1 4 H 10 M 7 1 L 10 4 L 7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <span className="snk">{snk}</span>
  </span>
);

const PLOwner = ({ name, team, code = 'pl' }) => (
  <div className="pl-cell-owner">
    <div className={`av t-${code}`}>{name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
    <div className="who">
      <span className="nm">{name}</span>
      <span className="tm">{team}</span>
    </div>
  </div>
);

const PLTags = ({ tags }) => (
  <div className="pl-cell-tags">
    {tags.slice(0,3).map((t, i) => (
      <span key={i} className={`pl-tag ${t.cls||''}`}>{t.l}</span>
    ))}
    {tags.length > 3 && <span className="pl-tag more">+{tags.length-3}</span>}
  </div>
);

const PLDeploy = ({ when, who }) => (
  <div className="pl-cell-deploy">
    <span className="who">{who}</span>
    {when}
  </div>
);

const PLDots = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="3" cy="7" r="1.2" fill="currentColor"/>
    <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
    <circle cx="11" cy="7" r="1.2" fill="currentColor"/>
  </svg>
);

const PLToolbar = ({ search, filters, grouping, density, hideDensity }) => (
  <div className="pl-toolbar">
    <div className="pl-search">
      <Icon name="search" size={13} color="var(--color-gray-dark-500)"/>
      {search ? <span>{search}</span> : <span className="ph">name, owner, tag, source… try "tier:1 dlq:&gt;0"</span>}
      <span className="cursor"/>
    </div>
    {filters?.map((f, i) => (
      <span key={i} className={`pl-filter ${f.on?'is-on':''}`}>
        {f.icon && <Icon name={f.icon} size={11}/>}
        {f.k}<span className="v">{f.v}</span>
        {f.on && <span className="x">×</span>}
      </span>
    ))}
    <div className="pl-spacer"/>
    {grouping && (
      <span className="pl-grouping">
        <Icon name="sparkles" size={10}/>
        Group: <strong>{grouping}</strong>
      </span>
    )}
    {!hideDensity && (
      <div className="pl-density">
        <button className={density==='table'?'is-on':''}>≡ Table</button>
        <button className={density==='hybrid'?'is-on':''}>▦ Hybrid</button>
        <button className={density==='cards'?'is-on':''}>▢ Cards</button>
      </div>
    )}
  </div>
);

const PLTitleRow = ({ title, count, right }) => (
  <div className="pl-titlerow">
    <h1>{title}</h1>
    <span className="meta">{count} pipelines · 5 environments · 4 teams</span>
    <div className="spacer"/>
    {right}
  </div>
);

const PLViews = ({ active }) => (
  <div className="pl-views">
    <div className={`pl-view ${active==='all'?'is-active':''}`}>All <span className="ct">142</span></div>
    <div className={`pl-view ${active==='mine'?'is-active':''}`}>My pipelines <span className="ct">23</span></div>
    <div className={`pl-view shared ${active==='prod-tier1'?'is-active':''}`}>Prod · Tier 1 <span className="ct">18</span></div>
    <div className={`pl-view shared ${active==='dlq-watch'?'is-active':''}`}>DLQ watch <span className="ct">7</span></div>
    <div className={`pl-view shared ${active==='checkout-team'?'is-active':''}`}>checkout team <span className="ct">12</span></div>
    <div className={`pl-view shared ${active==='unowned'?'is-active':''}`}>Unowned <span className="ct">3</span></div>
    <div className="pl-view add">+ Save current view</div>
  </div>
);

// Reusable seed data ---------------------------------------------------
const PIPELINE_DATA = [
  { id:'p1',  status:'error',  name:'orders-enrich-checkout', reason:'schema mismatch · v3 pinned', kind:['ingest','join','transform'], type:'ingest+join', env:'prod', src:'kafka:orders.events', snk:'ch:orders_enriched', thru:0,    flat:true, dlq:2194, dlqCls:'bk', owner:{n:'Alex Rivera', t:'team:checkout', code:'co'}, tags:[{l:'tier-1',cls:'tier1'},{l:'sla',cls:'sla'},{l:'pii',cls:'pii'}], deploy:{when:'14:21 today', who:'alex@'}, team:'checkout' },
  { id:'p2',  status:'error',  name:'orders-fanout-fraud', reason:'reads removed legacy_total', kind:['ingest','filter','transform'], type:'ingest+filter+transform', env:'prod', src:'kafka:orders.events', snk:'ch:fraud_signals', thru:0, flat:true, dlq:418, dlqCls:'bk', owner:{n:'Pat Singh', t:'team:risk', code:'ri'}, tags:[{l:'tier-1',cls:'tier1'},{l:'sla',cls:'sla'}], deploy:{when:'2d ago', who:'pat@'}, team:'risk' },
  { id:'p3',  status:'warn',   name:'orders-to-warehouse', reason:'amount narrowing · 99.4% parse', kind:['ingest','transform'], type:'ingest+transform', env:'prod', src:'kafka:orders.events', snk:'ch:orders_warehouse', thru:8420, dlq:184, dlqCls:'warn', owner:{n:'Mira Park', t:'team:data', code:'da'}, tags:[{l:'tier-1',cls:'tier1'},{l:'gdpr',cls:'gdpr'}], deploy:{when:'14:43 today', who:'auto-migration'}, team:'data' },
  { id:'p4',  status:'run',    name:'orders-metrics-1m', kind:['ingest','filter','transform'], type:'ingest+filter+transform', env:'prod', src:'kafka:orders.events', snk:'ch:orders_metrics', thru:9840, dlq:0, dlqCls:'zero', owner:{n:'Jin Kim', t:'team:platform', code:'pl'}, tags:[{l:'sla',cls:'sla'}], deploy:{when:'5d ago', who:'jin@'}, team:'platform' },
  { id:'p5',  status:'run',    name:'orders-archive', kind:['ingest','sink'], type:'ingest', env:'prod', src:'kafka:orders.events', snk:'s3://archive/orders', thru:9842, dlq:0, dlqCls:'zero', owner:{n:'Jin Kim', t:'team:platform', code:'pl'}, tags:[{l:'gdpr',cls:'gdpr'}], deploy:{when:'21d ago', who:'jin@'}, team:'platform' },
  { id:'p6',  status:'run',    name:'orders-audit-replay', kind:['ingest'], type:'ingest', env:'prod', src:'kafka:orders.events', snk:'kafka:audit.replay', thru:9844, dlq:0, dlqCls:'zero', owner:{n:'Pat Singh', t:'team:risk', code:'ri'}, tags:[], deploy:{when:'30d+ ago', who:'pat@'}, team:'risk' },
  { id:'p7',  status:'run',    name:'orders-dedup-1m', kind:['ingest','dedup'], type:'ingest+dedup', env:'prod', src:'kafka:orders.events', snk:'kafka:orders.dedup', thru:9840, dlq:0, dlqCls:'zero', owner:{n:'Jin Kim', t:'team:platform', code:'pl'}, tags:[], deploy:{when:'12d ago', who:'jin@'}, team:'platform' },
  { id:'p8',  status:'run',    name:'payments-enrich', kind:['ingest','join','transform'], type:'ingest+join', env:'prod', src:'kafka:payments.events', snk:'ch:payments_enriched', thru:4210, dlq:0, dlqCls:'zero', owner:{n:'Alex Rivera', t:'team:checkout', code:'co'}, tags:[{l:'tier-1',cls:'tier1'},{l:'pii',cls:'pii'},{l:'sla',cls:'sla'}], deploy:{when:'7d ago', who:'alex@'}, team:'checkout' },
  { id:'p9',  status:'run',    name:'payments-fanout-cs', kind:['ingest','filter'], type:'ingest+filter', env:'prod', src:'kafka:payments.events', snk:'kafka:cs.events', thru:1820, dlq:0, dlqCls:'zero', owner:{n:'Sam Reed', t:'team:growth', code:'gr'}, tags:[{l:'tier-2'}], deploy:{when:'3d ago', who:'sam@'}, team:'growth' },
  { id:'p10', status:'paused', name:'sessions-rollup-staging', kind:['ingest','dedup','transform'], type:'ingest+dedup+transform', env:'staging', src:'kafka:sessions.raw', snk:'ch:sessions_rollup', thru:0, flat:true, dlq:0, dlqCls:'zero', owner:{n:'Mira Park', t:'team:data', code:'da'}, tags:[{l:'experiment'}], deploy:{when:'1h ago', who:'mira@'}, team:'data' },
  { id:'p11', status:'draft',  name:'fraud-signals-v2', kind:['ingest','join','transform'], type:'ingest+join', env:'dev', src:'kafka:fraud.raw', snk:'ch:fraud_signals_v2', thru:0, flat:true, dlq:0, dlqCls:'zero', owner:{n:'Pat Singh', t:'team:risk', code:'ri'}, tags:[{l:'wip'}], deploy:{when:'25m ago', who:'pat@'}, team:'risk' },
  { id:'p12', status:'run',    name:'inventory-cdc-bridge', kind:['ingest','transform'], type:'ingest+transform', env:'prod', src:'pg:inventory.cdc', snk:'kafka:inventory.events', thru:340, dlq:0, dlqCls:'zero', owner:{n:'Jin Kim', t:'team:platform', code:'pl'}, tags:[{l:'cdc'}], deploy:{when:'14d ago', who:'jin@'}, team:'platform' },
  { id:'p13', status:'run',    name:'clickstream-windowed', kind:['ingest','filter','dedup'], type:'ingest+filter+dedup', env:'prod', src:'kafka:clicks.raw', snk:'ch:clicks_dedup', thru:24800, dlq:12, dlqCls:'warn', owner:{n:'Sam Reed', t:'team:growth', code:'gr'}, tags:[{l:'high-vol'}], deploy:{when:'1d ago', who:'sam@'}, team:'growth' },
];

// Sample sparkline values (for rows that are running)
const sparkA = [8.4,8.6,9.0,9.2,9.1,9.4,9.6,9.7,9.8,9.9,9.8,10,9.9,9.8];
const sparkB = [4.0,4.1,4.2,4.3,4.4,4.3,4.2,4.4,4.3,4.2,4.1,4.2,4.3,4.2];
const sparkC = [22,23,24,23,25,24,26,25,24,25,24,25,24,25];
const sparkD = [0.3,0.32,0.35,0.34,0.33,0.34,0.34,0.33,0.34,0.34,0.33,0.34,0.34,0.34];

const sparkFor = (id) => {
  if (id === 'p4' || id === 'p5' || id === 'p6' || id === 'p7') return sparkA;
  if (id === 'p3') return sparkA;
  if (id === 'p8') return sparkB;
  if (id === 'p13') return sparkC;
  if (id === 'p9') return [1.7,1.8,1.9,1.8,1.8,1.9,1.8,1.7,1.8,1.9,1.8,1.8,1.8,1.8];
  if (id === 'p12') return sparkD;
  return null;
};

const PLRow = ({ p, selected, mixed, hideSelect, hideTags, hideOwner, dim }) => {
  const trCls = p.status === 'error' ? 'is-error' : p.status === 'warn' ? 'is-warn' : '';
  const sel = selected === true;
  return (
    <tr className={`${trCls} ${sel?'is-selected':''}`}>
      {!hideSelect && <td className="c-sel"><span className={`pl-checkbox ${sel?'is-on':''} ${mixed?'is-mixed':''}`}/></td>}
      <td className="c-status"><PLStatus s={p.status} label={p.status === 'run' ? 'running' : p.status}/></td>
      <td className="c-name">
        <div className="pl-cell-name">
          <span className="n">{p.name}</span>
          {p.reason && <span className={`reason ${p.status==='warn'?'warn':''}`}>{p.reason}</span>}
        </div>
      </td>
      <td className="c-type"><PLTypeCell kind={p.kind} label={p.type}/></td>
      <td className="c-env"><PLEnv env={p.env}/></td>
      <td className="c-flow"><PLFlow src={p.src} snk={p.snk}/></td>
      <td className="c-thru">
        <div className="pl-cell-thru">
          <span className={`num ${p.thru===0?'zero':''}`}>{p.thru.toLocaleString()}</span>
          <PLSpark data={sparkFor(p.id) || [1,1,1,1,1]} flat={p.flat} color={p.status==='warn'?'var(--color-yellow-400)':'var(--color-orange-300)'}/>
        </div>
      </td>
      <td className="c-dlq"><span className={`pl-cell-dlq ${p.dlqCls}`}>{p.dlq.toLocaleString()}</span></td>
      {!hideOwner && <td className="c-owner"><PLOwner name={p.owner.n} team={p.owner.t} code={p.owner.code}/></td>}
      {!hideTags && <td className="c-tags"><PLTags tags={p.tags}/></td>}
      <td className="c-deploy"><PLDeploy when={p.deploy.when} who={p.deploy.who}/></td>
      <td className="c-act pl-cell-act"><PLDots/></td>
    </tr>
  );
};

const PLTableHead = ({ sort, hideSelect, hideOwner, hideTags }) => (
  <thead>
    <tr>
      {!hideSelect && <th className="c-sel"><span className="pl-checkbox"/></th>}
      <th className={`c-status ${sort==='status'?'sorted':''}`}>Status{sort==='status' && <span className="arr">▼</span>}</th>
      <th className={`c-name ${sort==='name'?'sorted':''}`}>Name{sort==='name' && <span className="arr">▼</span>}</th>
      <th className="c-type">Type</th>
      <th className="c-env">Env</th>
      <th className="c-flow">Source → Sink</th>
      <th className={`c-thru ${sort==='thru'?'sorted':''}`}>Throughput{sort==='thru' && <span className="arr">▼</span>}</th>
      <th className={`c-dlq ${sort==='dlq'?'sorted':''}`} style={{textAlign:'right'}}>DLQ{sort==='dlq' && <span className="arr">▼</span>}</th>
      {!hideOwner && <th className="c-owner">Owner</th>}
      {!hideTags && <th className="c-tags">Tags</th>}
      <th className={`c-deploy ${sort==='deploy'?'sorted':''}`}>Last deploy{sort==='deploy' && <span className="arr">▼</span>}</th>
      <th className="c-act"></th>
    </tr>
  </thead>
);

Object.assign(window, { PLChev, PLArrow, PLSpark, PLStatus, PLTypeCell, PLEnv, PLFlow, PLOwner, PLTags, PLDeploy, PLDots, PLToolbar, PLTitleRow, PLViews, PLRow, PLTableHead, PIPELINE_DATA });

// =====================================================================
// ARTBOARD 1 · Default flat view (sortable, filterable)
// =====================================================================

const ArtPLDefault = () => (
  <div className="pl-page">
    <AppShell activeNav="pipelines">
      <div className="pl-inner">
        <PLTitleRow title="Pipelines" count="142" right={<>
          <button className="btn btn-secondary" style={{fontSize:12}}><Icon name="library" size={12}/>Import</button>
          <button className="btn btn-primary" style={{fontSize:12}}><Icon name="plus" size={12}/>Create pipeline</button>
        </>}/>

        <PLViews active="all"/>

        <PLToolbar
          search='env:prod tier:1'
          filters={[
            { k:'Status:', v:'running, error', on:true, icon:'pip' },
            { k:'Env:',    v:'prod', on:true },
            { k:'+ Filter', v:'team · tag · DLQ' },
          ]}
          density="table"
        />

        <div className="pl-table-wrap">
          <table className="pl-table">
            <PLTableHead sort="status"/>
            <tbody>
              {PIPELINE_DATA.slice(0, 13).map(p => <PLRow key={p.id} p={p}/>)}
            </tbody>
          </table>
        </div>

        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:12, fontSize:11.5, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>
          <span>Showing 13 of 142 — refine with search or filters</span>
          <span style={{display:'flex', gap:8}}>
            <span style={{padding:'4px 8px', border:'1px solid var(--color-gray-dark-800)', borderRadius:5, background:'#0c0c10'}}>← Prev</span>
            <span style={{padding:'4px 8px', border:'1px solid var(--color-orange-alpha-20)', borderRadius:5, background:'var(--color-orange-alpha-10)', color:'var(--color-orange-300)'}}>1</span>
            <span style={{padding:'4px 8px', border:'1px solid var(--color-gray-dark-800)', borderRadius:5, background:'#0c0c10'}}>2</span>
            <span style={{padding:'4px 8px', border:'1px solid var(--color-gray-dark-800)', borderRadius:5, background:'#0c0c10'}}>3</span>
            <span style={{padding:'4px 8px', border:'1px solid var(--color-gray-dark-800)', borderRadius:5, background:'#0c0c10'}}>11</span>
            <span style={{padding:'4px 8px', border:'1px solid var(--color-gray-dark-800)', borderRadius:5, background:'#0c0c10'}}>Next →</span>
          </span>
        </div>

        <Annot>
          T-21 default. Dense table; sticky header; search-first toolbar; saved-views tab strip is the IA spine
          (team views are sharable with a blue-dot indicator). Status is the default sort because triage beats
          alphabet. Sparklines stay subtle — just enough to spot a flat line at a glance.
        </Annot>
      </div>
    </AppShell>
  </div>
);

// =====================================================================
// ARTBOARD 2 · Grouped by team
// =====================================================================

const TeamGroup = ({ name, code, count, healthy, warn, err, throughput, children, open = true }) => (
  <>
    <tr className="pl-group-row">
      <td colSpan={12}>
        <div className="pl-group-head">
          <span className="chev"><PLChev dir={open?'down':'right'}/></span>
          <span className={`av t-${code}`}>{name.replace('team:','').slice(0,2).toUpperCase()}</span>
          <span className="name">{name}</span>
          <span className="ct">{count} pipelines</span>
          <div className="health">
            <span className="pip ok"><span className="d"/>{healthy} ok</span>
            {warn > 0 && <span className="pip warn"><span className="d"/>{warn} warn</span>}
            {err > 0 && <span className="pip err"><span className="d"/>{err} err</span>}
            <span style={{marginLeft:10}}>· <span className="total">{throughput}</span> msg/s total</span>
          </div>
        </div>
      </td>
    </tr>
    {open && children}
  </>
);

const ArtPLByTeam = () => {
  const byTeam = {
    checkout: PIPELINE_DATA.filter(p => p.team === 'checkout'),
    risk:     PIPELINE_DATA.filter(p => p.team === 'risk'),
    data:     PIPELINE_DATA.filter(p => p.team === 'data'),
    platform: PIPELINE_DATA.filter(p => p.team === 'platform'),
    growth:   PIPELINE_DATA.filter(p => p.team === 'growth'),
  };
  return (
    <div className="pl-page">
      <AppShell activeNav="pipelines">
        <div className="pl-inner">
          <PLTitleRow title="Pipelines" count="142" right={<>
            <button className="btn btn-secondary" style={{fontSize:12}}>Import</button>
            <button className="btn btn-primary" style={{fontSize:12}}>Create pipeline</button>
          </>}/>
          <PLViews active="all"/>
          <PLToolbar
            search=""
            filters={[
              { k:'Env:', v:'prod', on:true },
            ]}
            grouping="team"
            density="table"
          />

          <div className="pl-table-wrap">
            <table className="pl-table">
              <PLTableHead/>
              <tbody>
                <TeamGroup name="team:checkout" code="co" count={byTeam.checkout.length} healthy={1} warn={0} err={1} throughput="4.21k">
                  {byTeam.checkout.map(p => <PLRow key={p.id} p={p}/>)}
                </TeamGroup>
                <TeamGroup name="team:risk" code="ri" count={byTeam.risk.length} healthy={1} warn={0} err={1} throughput="9.84k">
                  {byTeam.risk.map(p => <PLRow key={p.id} p={p}/>)}
                </TeamGroup>
                <TeamGroup name="team:data" code="da" count={byTeam.data.length} healthy={0} warn={1} err={0} throughput="8.42k">
                  {byTeam.data.map(p => <PLRow key={p.id} p={p}/>)}
                </TeamGroup>
                <TeamGroup name="team:platform" code="pl" count={byTeam.platform.length} healthy={4} warn={0} err={0} throughput="29.86k">
                  {byTeam.platform.map(p => <PLRow key={p.id} p={p}/>)}
                </TeamGroup>
                <TeamGroup name="team:growth" code="gr" count={byTeam.growth.length} healthy={2} warn={0} err={0} throughput="26.62k">
                  {byTeam.growth.map(p => <PLRow key={p.id} p={p}/>)}
                </TeamGroup>
              </tbody>
            </table>
          </div>

          <Annot>
            T-21 grouped-by-team. Group rows roll up health (ok/warn/err counts) and total throughput so a TPM
            can scan team status without expanding rows. Avatar matches the owner column's team palette.
          </Annot>
        </div>
      </AppShell>
    </div>
  );
};

// =====================================================================
// ARTBOARD 3 · Grouped by health (triage mode)
// =====================================================================

const HealthGroup = ({ tone, label, count, summary, children }) => (
  <>
    <tr className={`pl-group-row is-${tone}`}>
      <td colSpan={12}>
        <div className="pl-group-head">
          <span className="chev"><PLChev dir="down"/></span>
          <span className="name">{label}</span>
          <span className="ct">{count} pipelines</span>
          <div className="health" style={{color:'var(--color-gray-dark-100)'}}>{summary}</div>
        </div>
      </td>
    </tr>
    {children}
  </>
);

const ArtPLByHealth = () => {
  const errors = PIPELINE_DATA.filter(p => p.status === 'error');
  const warns = PIPELINE_DATA.filter(p => p.status === 'warn');
  const drafts = PIPELINE_DATA.filter(p => p.status === 'draft');
  const oks = PIPELINE_DATA.filter(p => p.status === 'run' || p.status === 'paused');
  return (
    <div className="pl-page">
      <AppShell activeNav="pipelines">
        <div className="pl-inner">
          <PLTitleRow title="Pipelines · triage view" count="142" right={<>
            <button className="btn btn-secondary" style={{fontSize:12}}>Import</button>
            <button className="btn btn-primary" style={{fontSize:12}}>Create pipeline</button>
          </>}/>
          <PLViews active="dlq-watch"/>

          <div className="pl-healthstrip">
            <div className="tile err">
              <div className="lbl"><span className="d"/>Errors</div>
              <div className="val">2</div>
              <div className="delta">2,612 DLQ events backlogged</div>
            </div>
            <div className="tile warn">
              <div className="lbl"><span className="d"/>Warnings</div>
              <div className="val">1</div>
              <div className="delta">amount narrowing · 99.4% parse</div>
            </div>
            <div className="tile draft">
              <div className="lbl"><span className="d"/>Drafts</div>
              <div className="val">1</div>
              <div className="delta">fraud-signals-v2 · awaiting review</div>
            </div>
            <div className="tile ok">
              <div className="lbl"><span className="d"/>Healthy</div>
              <div className="val">9</div>
              <div className="delta">88.6k msg/s total</div>
            </div>
          </div>

          <PLToolbar
            search=""
            filters={[
              { k:'Env:', v:'prod', on:true },
              { k:'DLQ:', v:'> 0', on:true },
            ]}
            grouping="health"
            density="table"
          />

          <div className="pl-table-wrap">
            <table className="pl-table">
              <PLTableHead/>
              <tbody>
                <HealthGroup tone="err" label="● Errors" count={errors.length} summary="needs attention now">
                  {errors.map(p => <PLRow key={p.id} p={p}/>)}
                </HealthGroup>
                <HealthGroup tone="warn" label="● Warnings" count={warns.length} summary="degraded — within tolerance">
                  {warns.map(p => <PLRow key={p.id} p={p}/>)}
                </HealthGroup>
                <HealthGroup tone="ok" label="● Drafts" count={drafts.length} summary="not yet running">
                  {drafts.map(p => <PLRow key={p.id} p={p}/>)}
                </HealthGroup>
                <HealthGroup tone="ok" label="● Running / paused" count={oks.length} summary="all green">
                  {oks.map(p => <PLRow key={p.id} p={p}/>)}
                </HealthGroup>
              </tbody>
            </table>
          </div>

          <Annot>
            T-21 triage view. Health summary strip up top is the answer to "what should I look at first?"
            Errors float to the top of the table and carry their reason inline so you can decide whether to
            click in without expanding.
          </Annot>
        </div>
      </AppShell>
    </div>
  );
};

Object.assign(window, { ArtPLDefault, ArtPLByTeam, ArtPLByHealth });
