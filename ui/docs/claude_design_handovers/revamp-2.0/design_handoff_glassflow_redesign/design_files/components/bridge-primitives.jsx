// Bridge primitives — pinned-vs-live model, blast radius, upgrade flow
//
// MODEL
// -----
// Connections (Kafka/CH creds) — ALWAYS LIVE. No pin. Edit propagates immediately.
//   UX: show blast radius in the edit dialog; require typed confirmation for destructive fields (host, auth).
// Schemas + Configs (dedup/filter/transform) — PINNED ON DEPLOY.
//   Each save creates a new immutable version (v1, v2, …).
//   Deployed pipelines reference a specific version. They don't auto-update.
//   When a new version exists, pipelines show "update available" and can upgrade individually or in bulk.
// Usage: every library item surfaces "used by N pipelines" at a glance.

// ---- Small shared bits ----------------------------------------------------

const BRLink = ({ name, schema, status = "running", pinned, driftOK }) => (
  <div className={`br-link-row ${driftOK===false?'is-drift':''}`}>
    <span className={`br-pip-dot br-pip-${status}`}/>
    <div className="br-link-main">
      <div className="br-link-name">{name}</div>
      {schema && <div className="br-link-meta mono">{schema}</div>}
    </div>
    {pinned && <span className="chip chip-muted">pinned {pinned}</span>}
    {driftOK === false && <span className="chip chip-warn"><Icon name="warn" size={10}/> update avail</span>}
    {driftOK === true && <span className="chip chip-positive"><Icon name="check" size={10}/> latest</span>}
  </div>
);

const BRVersionPill = ({ v, current, latest }) => (
  <span className={`br-vpill ${current?'is-current':''} ${latest?'is-latest':''}`}>
    {v}{current && <em>current</em>}{latest && !current && <em>latest</em>}
  </span>
);

const BRCountChip = ({ n, label = "pipelines" }) => (
  <span className="br-count-chip"><Icon name="pipelines" size={10}/> used by <strong>{n}</strong> {label}</span>
);

// Blast-radius list — compact list used in multiple artboards
const BRBlastList = ({ rows, caption }) => (
  <div className="br-blast">
    {caption && <div className="br-blast-caption">{caption}</div>}
    <div className="br-blast-rows">
      {rows.map((r, i) => (
        <div key={i} className={`br-blast-row ${r.severity||''}`}>
          <span className={`br-pip-dot br-pip-${r.status||'running'}`}/>
          <div className="br-blast-name">{r.name}</div>
          <div className="br-blast-env"><span className={`chip chip-${r.env==='prod'?'warn':'muted'}`}>{r.env}</span></div>
          <div className="br-blast-owner mono">{r.owner}</div>
          <div className="br-blast-effect">{r.effect}</div>
        </div>
      ))}
    </div>
  </div>
);

// Timeline of versions (used in schema detail)
const BRVersionTimeline = ({ items, current }) => (
  <div className="br-timeline">
    {items.map((it, i) => (
      <div key={i} className={`br-timeline-row ${it.v===current?'is-current':''}`}>
        <div className="br-timeline-dot"/>
        <div className="br-timeline-body">
          <div className="br-timeline-head">
            <span className="br-timeline-v">{it.v}</span>
            {it.v === current && <span className="chip chip-positive">deployed</span>}
            {it.latest && it.v !== current && <span className="chip chip-neutral">latest</span>}
            <span className="br-timeline-meta">{it.when} · {it.author}</span>
          </div>
          <div className="br-timeline-msg">{it.msg}</div>
          {it.diff && <div className="br-timeline-diff mono">{it.diff}</div>}
          <div className="br-timeline-use">
            used by <strong>{it.usedBy}</strong> pipeline{it.usedBy!==1?'s':''}
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Used-by table — pipelines referencing an item, with per-row action
const BRUsedByTable = ({ rows, compareCols = true }) => (
  <table className="br-usedby">
    <thead>
      <tr>
        <th>Pipeline</th>
        <th>Env</th>
        <th>Owner</th>
        {compareCols && <th>Pinned version</th>}
        {compareCols && <th>Latest compatible</th>}
        <th></th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i} className={r.drift?'is-drift':''}>
          <td>
            <div className="flex items-center gap-2">
              <span className={`br-pip-dot br-pip-${r.status||'running'}`}/>
              <span style={{fontWeight:500, color:'var(--color-foreground-neutral)'}}>{r.name}</span>
              {r.driftBreaking && <span className="chip chip-warn">breaking</span>}
            </div>
          </td>
          <td><span className={`chip chip-${r.env==='prod'?'warn':'muted'}`}>{r.env}</span></td>
          <td className="mono">{r.owner}</td>
          {compareCols && <td className="mono">{r.pinned}</td>}
          {compareCols && <td className="mono">
            {r.latest}
            {r.drift && <span className="br-delta"> →</span>}
          </td>}
          <td style={{textAlign:'right'}}>
            {r.drift
              ? <button className="btn btn-secondary btn-sm">Upgrade…</button>
              : <span className="chip chip-positive"><Icon name="check" size={10}/> up to date</span>
            }
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

// Schema diff box
const BRSchemaDiff = ({ title, before, after }) => (
  <div className="br-diff">
    {title && <div className="br-diff-head">{title}</div>}
    <div className="br-diff-cols">
      <div className="br-diff-col">
        <div className="br-diff-col-label">before · v{before.v}</div>
        {before.fields.map((f,i)=>(
          <div key={i} className={`br-diff-line ${f.change||''}`}>
            <span className="mono">{f.name}</span>
            <span className="mono dim">{f.type}</span>
          </div>
        ))}
      </div>
      <div className="br-diff-col">
        <div className="br-diff-col-label">after · v{after.v}</div>
        {after.fields.map((f,i)=>(
          <div key={i} className={`br-diff-line ${f.change||''}`}>
            <span className="mono">{f.name}</span>
            <span className="mono dim">{f.type}</span>
            {f.change === 'add'    && <span className="chip chip-positive">new</span>}
            {f.change === 'remove' && <span className="chip chip-warn">removed</span>}
            {f.change === 'type'   && <span className="chip chip-warn">type changed</span>}
          </div>
        ))}
      </div>
    </div>
  </div>
);

Object.assign(window, {
  BRLink, BRVersionPill, BRCountChip, BRBlastList,
  BRVersionTimeline, BRUsedByTable, BRSchemaDiff
});
