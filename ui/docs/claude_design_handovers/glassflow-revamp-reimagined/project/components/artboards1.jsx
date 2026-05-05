// Artboards 1-4: Library home, Schema blueprint detail, Drift reconciliation, Compat warn + auto-suggest

// ====================================================================
// A1. LIBRARY HOME — Schemas view, grid of cards + left nav
// ====================================================================
const ArtLibraryHome = () => {
  const schemas = [
    { name: "OrderEvents",       folder: "Production / analytics", tags: ["kafka-prod","pii"],    fields: 14, usedBy: 6, source: "kafka",  version: "v4", updated: "2d ago" },
    { name: "UserSignups",       folder: "Production / growth",    tags: ["kafka-prod"],          fields: 9,  usedBy: 3, source: "kafka",  version: "v2", updated: "5d ago" },
    { name: "OtelLogs",          folder: "Production / analytics", tags: ["otlp","logs"],         fields: 14, usedBy: 4, source: "otlp",   version: "v1", updated: "1w ago" },
    { name: "BillingTransactions", folder: "Production / billing", tags: ["kafka-prod","pii"],    fields: 22, usedBy: 5, source: "kafka",  version: "v7", updated: "12h ago", drift: true },
    { name: "ClickstreamRaw",    folder: "Staging",                tags: ["kafka-staging"],       fields: 18, usedBy: 2, source: "kafka",  version: "v3", updated: "3d ago" },
    { name: "MetricsGauge",      folder: "Production / analytics", tags: ["otlp","metrics"],      fields: 11, usedBy: 1, source: "otlp",   version: "v1", updated: "2w ago" },
    { name: "SupportTickets",    folder: "Team A",                 tags: ["manual"],              fields: 8,  usedBy: 0, source: "manual", version: "v1", updated: "1mo ago" },
    { name: "DeviceTelemetry",   folder: "Staging",                tags: ["kafka-staging","iot"], fields: 16, usedBy: 0, source: "kafka",  version: "v2", updated: "4d ago" },
  ];

  return (
    <AppShell activeNav="library">
      <LibrarySide active="schemas"/>
      <div className="page-frame">
        <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom: 18}}>
          <div>
            <div className="crumbs mb-2">
              <a>Library</a><span className="sep">/</span><span>Schemas</span>
            </div>
            <h1 className="page-title">Schemas</h1>
            <p className="page-subtitle">Reusable data blueprints. Pipelines bind to an instance of a schema at creation time.</p>
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn btn-secondary"><Icon name="download" size={13}/> Import</button>
            <button className="btn btn-primary"><Icon name="plus" size={13}/> New schema</button>
          </div>
        </div>

        <div className="flex gap-3 items-center mb-4" style={{flexWrap:'wrap'}}>
          <div style={{position:'relative', flex:'1 1 320px', maxWidth: 360}}>
            <div style={{position:'absolute', left:10, top:9, color:'var(--color-gray-dark-500)'}}>
              <Icon name="search" size={14}/>
            </div>
            <input className="input" placeholder="Search schemas, fields, tags…" style={{paddingLeft:32}}/>
          </div>
          <div className="seg">
            <button className="is-active">All sources</button>
            <button>Kafka</button>
            <button>OTLP</button>
            <button>Manual</button>
          </div>
          <div className="seg">
            <button className="is-active">Any usage</button>
            <button>Used</button>
            <button>Unused</button>
          </div>
          <div className="ml-auto flex gap-2 items-center">
            <span className="text-xs text-dim">Sort</span>
            <div className="seg"><button className="is-active">Updated</button><button>Name</button><button>Usage</button></div>
          </div>
        </div>

        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap: 14}}>
          {schemas.map((s,i)=>(
            <div key={i} className="lib-card">
              <div className="lib-card-header">
                <TypeGlyph type="schema"/>
                <div className="min-w-0" style={{flex:1}}>
                  <div className="lib-card-title">{s.name}</div>
                  <div className="lib-card-meta">{s.source} · {s.version} · {s.updated}</div>
                </div>
                {s.drift && (
                  <span title="Library has drifted" style={{color:'var(--color-yellow-400)'}}>
                    <Icon name="warn" size={15}/>
                  </span>
                )}
                <button className="icon-btn"><Icon name="more" size={14}/></button>
              </div>
              <div className="text-xs" style={{color:'var(--color-gray-250)'}}>
                <Icon name="folder" size={11}/> <span style={{marginLeft:4}}>{s.folder}</span>
              </div>
              <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                {s.tags.map((t,j)=>(<span key={j} className="tag">{t}</span>))}
              </div>
              <div className="lib-card-stats">
                <div className="stat"><strong>{s.fields}</strong> fields</div>
                <div className="stat"><strong>{s.usedBy}</strong> pipelines</div>
                {s.drift && <div className="stat" style={{color:'var(--color-yellow-400)', marginLeft:'auto'}}>drift</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Annot>
            Library home is the same shell for Kafka, ClickHouse, Schemas, Dedup/Filter/Transform configs. Left nav scopes the section; search and filters are per-section. Every item shows source type, version, freshness, folder, tags, and a <strong>used-by count</strong>.
          </Annot>
        </div>
      </div>
    </AppShell>
  );
};

// ====================================================================
// A2. SCHEMA BLUEPRINT — detail, fields, used-by, version history
// ====================================================================
const ArtSchemaBlueprint = () => {
  const fields = [
    { name: "order_id",        type: "string",  req: true,  pk: true,  desc: "Unique order identifier" },
    { name: "customer_id",     type: "string",  req: true,  desc: "Customer FK" },
    { name: "sku",             type: "string",  req: true },
    { name: "quantity",        type: "uint",    req: true },
    { name: "unit_price_cents",type: "uint64",  req: true },
    { name: "currency",        type: "string",  req: true },
    { name: "discount_cents",  type: "uint64",  req: false },
    { name: "tax_cents",       type: "uint64",  req: false },
    { name: "channel",         type: "string",  req: true,  desc: "web / mobile / pos" },
    { name: "payment_method",  type: "string",  req: true },
    { name: "placed_at",       type: "datetime", req: true },
    { name: "shipping_country", type: "string",  req: true },
    { name: "promo_code",      type: "string",  req: false },
    { name: "metadata",        type: "map",     req: false, desc: "Freeform event attributes" },
  ];
  const usedBy = [
    { name: "prod-orders-to-analytics", pinned: "v3", current: "v4", drift: true,  health: "ok", status: "active" },
    { name: "prod-orders-to-billing",   pinned: "v4", current: "v4", drift: false, health: "ok", status: "active" },
    { name: "growth-order-attribution", pinned: "v4", current: "v4", drift: false, health: "warn", status: "active" },
    { name: "ops-order-dlq-monitor",    pinned: "v2", current: "v4", drift: true,  health: "ok", status: "stopped" },
    { name: "finance-order-refunds",    pinned: "v4", current: "v4", drift: false, health: "ok", status: "active" },
    { name: "staging-orders-smoke",     pinned: "v3", current: "v4", drift: true,  health: "err", status: "stopped" },
  ];

  return (
    <AppShell activeNav="library">
      <LibrarySide active="schemas"/>
      <div className="page-frame">
        <div className="crumbs mb-2">
          <a>Library</a><span className="sep">/</span><a>Schemas</a><span className="sep">/</span><span>OrderEvents</span>
        </div>
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 16}}>
          <div style={{flex:1, minWidth:0}}>
            <div className="flex gap-3 items-center">
              <h1 className="page-title" style={{fontSize:26, color:'var(--color-foreground-neutral)'}}>OrderEvents</h1>
              <span className="chip chip-info">blueprint</span>
              <span className="chip chip-neutral mono">v4</span>
            </div>
            <p className="page-subtitle">Order-placed events emitted by the checkout service. Blueprint derived from Kafka topic <span className="mono" style={{color:'var(--color-foreground-neutral)'}}>orders.placed.v2</span>.</p>
            <div className="flex gap-2 mt-2" style={{flexWrap:'wrap'}}>
              <span className="tag">kafka-prod</span>
              <span className="tag">pii</span>
              <span className="tag">checkout</span>
              <span className="tag" style={{borderStyle:'dashed', color:'var(--color-gray-dark-500)'}}>+ tag</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost"><Icon name="history" size={13}/> Version history</button>
            <button className="btn btn-secondary"><Icon name="clone" size={13}/> Duplicate</button>
            <button className="btn btn-primary"><Icon name="edit" size={13}/> Edit fields</button>
          </div>
        </div>

        <div className="grid mt-6" style={{gridTemplateColumns:'2fr 1fr', gap: 20}}>
          <div>
            <div className="panel">
              <div className="panel-head">
                <h3 className="panel-title">Fields</h3>
                <span className="chip chip-neutral">{fields.length}</span>
                <div className="ml-auto flex gap-2">
                  <button className="btn btn-ghost btn-sm">Import JSON</button>
                  <button className="btn btn-secondary btn-sm"><Icon name="plus" size={12}/> Add field</button>
                </div>
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{width:32}}></th>
                    <th>Field</th>
                    <th style={{width:120}}>Type</th>
                    <th style={{width:80}}>Required</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f,i)=>(
                    <tr key={i}>
                      <td style={{color:'var(--color-gray-dark-500)'}} className="mono">{i+1}</td>
                      <td>
                        <span className="mono" style={{color:'var(--color-foreground-neutral)'}}>{f.name}</span>
                        {f.pk && <span className="chip chip-warning" style={{marginLeft:8, height:16, fontSize:10}}>key</span>}
                      </td>
                      <td><span className="mono text-muted">{f.type}</span></td>
                      <td>{f.req ? <span className="chip chip-positive" style={{height:16, fontSize:10}}>required</span> : <span className="text-dim text-xs">optional</span>}</td>
                      <td className="muted">{f.desc || <span className="text-dim">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel mt-4">
              <div className="panel-head">
                <h3 className="panel-title">Used by</h3>
                <span className="chip chip-neutral">{usedBy.length} pipelines</span>
                <div className="ml-auto text-xs text-dim">Edits to this blueprint have no immediate effect. Drift is reconciled when a pipeline is next edited.</div>
              </div>

              <div>
                {usedBy.map((p,i)=>(
                  <div key={i} className="usedby-row">
                    <div>
                      <div className="p-name">{p.name}</div>
                      <div className="p-sub">pinned {p.pinned} · current {p.current}</div>
                    </div>
                    <div>
                      {p.drift
                        ? <span className="chip chip-warning"><Icon name="drift" size={10}/> drift {p.pinned}→{p.current}</span>
                        : <span className="chip chip-muted">in sync</span>}
                    </div>
                    <div>
                      <span className="chip chip-neutral"><span className={`dot ${p.health==='ok'?'ok':p.health==='warn'?'warn':'err'}`}/> {p.health}</span>
                    </div>
                    <div>
                      {p.status === 'active'
                        ? <span className="chip chip-positive">active</span>
                        : <span className="chip chip-neutral">stopped</span>}
                    </div>
                    <div><Icon name="chevR" size={14} color="var(--color-gray-dark-500)"/></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="panel">
              <div className="panel-head"><h3 className="panel-title">Metadata</h3></div>
              <div className="kv-row"><span className="k">ID</span><span className="v mono">schema_or_01HXK9…</span></div>
              <div className="kv-row"><span className="k">Source type</span><span className="v">Kafka</span></div>
              <div className="kv-row"><span className="k">Derived from</span><span className="v mono">orders.placed.v2<br/><span className="text-xs text-dim">via conn: kafka-prod-eu</span></span></div>
              <div className="kv-row"><span className="k">Folder</span><span className="v">Production / analytics</span></div>
              <div className="kv-row"><span className="k">Created</span><span className="v">Mar 12, 2026 · VC</span></div>
              <div className="kv-row"><span className="k">Updated</span><span className="v">2d ago · VC</span></div>
            </div>

            <div className="panel mt-4">
              <div className="panel-head"><h3 className="panel-title">Version history</h3></div>
              {[
                { v: "v4", when: "2d ago",   who: "VC",    diff: "+2 fields, 1 rename", current: true },
                { v: "v3", when: "3w ago",   who: "VC",    diff: "+1 field" },
                { v: "v2", when: "2mo ago",  who: "Petra", diff: "type change ×1" },
                { v: "v1", when: "5mo ago",  who: "VC",    diff: "initial" },
              ].map((v,i)=>(
                <div key={i} style={{display:'grid', gridTemplateColumns:'48px 1fr auto', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--color-gray-dark-800)', gap: 10}}>
                  <span className="mono" style={{color: v.current?'var(--color-orange-300)':'var(--color-gray-dark-500)', fontSize: 12}}>{v.v}</span>
                  <div>
                    <div className="text-sm">{v.diff}</div>
                    <div className="text-xs text-dim">{v.when} · {v.who}</div>
                  </div>
                  {v.current
                    ? <span className="chip chip-positive" style={{height:18, fontSize:10}}>current</span>
                    : <button className="btn btn-ghost btn-sm">Compare</button>}
                </div>
              ))}
            </div>

            <div className="panel mt-4" style={{borderColor:'var(--color-red-900)'}}>
              <div className="panel-head"><h3 className="panel-title" style={{color:'var(--color-red-500)'}}>Danger zone</h3></div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted">Delete blueprint. Existing pipelines keep their pinned snapshot.</div>
                <button className="btn btn-danger-ghost"><Icon name="trash" size={13}/> Delete</button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Annot>
            Blueprint == mutable template. Each pipeline pins a <strong>snapshot</strong> at bind-time. "Used by" makes the blast radius visible but never blocks editing. Drift is surfaced passively and consolidated during pipeline edit (see artboard 3 &amp; 5).
          </Annot>
        </div>
      </div>
    </AppShell>
  );
};

// ====================================================================
// A3. DRIFT RECONCILIATION — diff view with upstream/downstream merge
// ====================================================================
const ArtDriftReconcile = () => {
  const diff = [
    { sign: "unchanged", name: "order_id",         type: "string"  },
    { sign: "unchanged", name: "customer_id",      type: "string"  },
    { sign: "unchanged", name: "sku",              type: "string"  },
    { sign: "changed",   name: "quantity",         type: "uint → uint32", note: "widened" },
    { sign: "unchanged", name: "unit_price_cents", type: "uint64"  },
    { sign: "unchanged", name: "currency",         type: "string"  },
    { sign: "added",     name: "discount_cents",   type: "uint64", note: "new in v4" },
    { sign: "added",     name: "tax_cents",        type: "uint64", note: "new in v4" },
    { sign: "unchanged", name: "channel",          type: "string"  },
    { sign: "unchanged", name: "payment_method",   type: "string"  },
    { sign: "removed",   name: "legacy_promo_id",  type: "string", note: "removed in v4" },
    { sign: "unchanged", name: "placed_at",        type: "datetime"},
    { sign: "unchanged", name: "shipping_country", type: "string"  },
    { sign: "changed",   name: "metadata",         type: "map<string,string> → map", note: "relaxed" },
  ];

  return (
    <AppShell activeNav="library">
      <LibrarySide active="schemas"/>
      <div className="page-frame">
        <div className="crumbs mb-2">
          <a>Library</a><span className="sep">/</span><a>Schemas</a><span className="sep">/</span><a>OrderEvents</a><span className="sep">/</span><span>Reconcile drift</span>
        </div>
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between'}}>
          <div>
            <h1 className="page-title" style={{fontSize:24, color:'var(--color-foreground-neutral)'}}>Reconcile <span style={{color:'var(--color-orange-300)'}}>OrderEvents</span></h1>
            <p className="page-subtitle">Pipeline <span className="mono" style={{color:'var(--color-foreground-neutral)'}}>prod-orders-to-analytics</span> pinned <span className="mono">v3</span>. Library blueprint is now <span className="mono">v4</span>.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost">Cancel</button>
            <button className="btn btn-primary">Apply &amp; save pipeline</button>
          </div>
        </div>

        <div className="callout warn mt-4">
          <Icon name="warn" size={16}/>
          <div>
            <strong>2 new fields, 1 removed field, 2 type changes</strong>
            Choose how to merge. Pipeline stays stopped until you apply.
          </div>
        </div>

        <div className="flex gap-2 mt-4 items-center">
          <span className="text-xs text-dim">Direction</span>
          <div className="seg">
            <button className="is-active">Downstream · adopt v4 in pipeline</button>
            <button>Upstream · push pipeline back to blueprint</button>
            <button>Custom · field-by-field</button>
          </div>
          <div className="ml-auto flex gap-2 items-center">
            <span className="text-xs text-dim">Show</span>
            <div className="seg"><button className="is-active">All</button><button>Changed only</button></div>
          </div>
        </div>

        <div className="grid mt-4" style={{gridTemplateColumns:'1fr 1fr', gap: 16}}>
          <div className="panel" style={{padding: 0, overflow:'hidden'}}>
            <div style={{padding:'14px 16px', borderBottom:'1px solid var(--color-gray-dark-700)', display:'flex', alignItems:'center', gap:10}}>
              <h3 className="panel-title" style={{margin:0}}>Pipeline · pinned v3</h3>
              <span className="chip chip-neutral mono">14 fields</span>
              <span className="ml-auto text-xs text-dim">prod-orders-to-analytics</span>
            </div>
            <div>
              {diff.map((d,i)=>(
                <div key={i} className={`diff-row ${d.sign}`}>
                  <div className={`diff-sign ${d.sign}`}>{d.sign==='added'?'+':d.sign==='removed'?'–':d.sign==='changed'?'~':''}</div>
                  <div style={{color: d.sign==='added'?'var(--color-gray-dark-500)':'var(--color-foreground-neutral)'}}>
                    {d.sign==='added' ? <span style={{opacity:0.4}}>{d.name}</span> : d.name}
                  </div>
                  <div className="type-pill">{d.sign==='added' ? <span style={{opacity:0.4}}>—</span> : d.type.split(' → ')[0]}</div>
                  <div style={{textAlign:'right', fontSize:11, color:'var(--color-gray-dark-500)'}}>{d.sign==='removed'?'will drop':''}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{padding: 0, overflow:'hidden'}}>
            <div style={{padding:'14px 16px', borderBottom:'1px solid var(--color-gray-dark-700)', display:'flex', alignItems:'center', gap:10}}>
              <h3 className="panel-title" style={{margin:0}}>Blueprint · current v4</h3>
              <span className="chip chip-info mono">15 fields</span>
              <span className="ml-auto text-xs text-dim">Library / OrderEvents</span>
            </div>
            <div>
              {diff.map((d,i)=>(
                <div key={i} className={`diff-row ${d.sign}`}>
                  <div className={`diff-sign ${d.sign}`}>{d.sign==='added'?'+':d.sign==='removed'?'–':d.sign==='changed'?'~':''}</div>
                  <div style={{color: d.sign==='removed'?'var(--color-gray-dark-500)':'var(--color-foreground-neutral)'}}>
                    {d.sign==='removed' ? <span style={{opacity:0.4, textDecoration:'line-through'}}>{d.name}</span> : d.name}
                  </div>
                  <div className="type-pill">{d.sign==='removed' ? <span style={{opacity:0.4}}>—</span> : d.type.split(' → ').slice(-1)[0]}</div>
                  <div style={{textAlign:'right', fontSize:11, color:'var(--color-gray-dark-500)'}}>{d.note||''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel mt-4">
          <div className="panel-head">
            <h3 className="panel-title">Downstream actions on pipeline</h3>
            <span className="ml-auto text-xs text-dim">When applied, the pipeline's ClickHouse mapping is re-checked against the new schema.</span>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 12}}>
            <div className="surface" style={{padding: 14}}>
              <div className="flex gap-2 items-center mb-2">
                <span className="diff-sign added">+</span>
                <div className="text-sm" style={{fontWeight:600}}>2 new fields</div>
              </div>
              <div className="text-xs text-muted mb-4">
                <span className="mono">discount_cents</span>, <span className="mono">tax_cents</span>
              </div>
              <div className="text-xs text-dim mb-2">Handling</div>
              <div className="seg" style={{display:'flex', width:'100%'}}>
                <button className="is-active" style={{flex:1}}>Auto-map to ClickHouse</button>
                <button style={{flex:1}}>Ignore</button>
              </div>
            </div>
            <div className="surface" style={{padding: 14}}>
              <div className="flex gap-2 items-center mb-2">
                <span className="diff-sign removed">–</span>
                <div className="text-sm" style={{fontWeight:600}}>1 removed field</div>
              </div>
              <div className="text-xs text-muted mb-4">
                <span className="mono">legacy_promo_id</span> · still in CH table
              </div>
              <div className="text-xs text-dim mb-2">Handling</div>
              <div className="seg" style={{display:'flex', width:'100%'}}>
                <button className="is-active" style={{flex:1}}>Keep CH column</button>
                <button style={{flex:1}}>Drop column</button>
              </div>
            </div>
            <div className="surface" style={{padding: 14}}>
              <div className="flex gap-2 items-center mb-2">
                <span className="diff-sign changed">~</span>
                <div className="text-sm" style={{fontWeight:600}}>2 type changes</div>
              </div>
              <div className="text-xs text-muted mb-4">
                <span className="mono">quantity</span>, <span className="mono">metadata</span>
              </div>
              <div className="text-xs text-dim mb-2">Handling</div>
              <div className="seg" style={{display:'flex', width:'100%'}}>
                <button className="is-active" style={{flex:1}}>Widen where safe</button>
                <button style={{flex:1}}>Review each</button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Annot>
            Drift reconciliation is a <strong>full screen</strong>, not a modal — the diff needs room. Downstream adopts blueprint into pipeline; upstream pushes pipeline changes back into the library blueprint. Both directions use the same diff UI with the labels swapped.
          </Annot>
        </div>
      </div>
    </AppShell>
  );
};

// ====================================================================
// A4. COMPATIBILITY WARN + AUTO-SUGGEST — picking a config during pipeline edit
// ====================================================================
const ArtCompatSuggest = () => {
  return (
    <AppShell activeNav="pipelines">
      <div className="page-frame">
        <div className="crumbs mb-2">
          <a>Pipelines</a><span className="sep">/</span><a>prod-orders-to-analytics</a><span className="sep">/</span><span>Add filter</span>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="page-title" style={{fontSize:22, color:'var(--color-foreground-neutral)'}}>Add filter</h1>
          <span className="chip chip-info">schema: OrderEvents v4</span>
        </div>
        <p className="page-subtitle">Pick a saved filter from Library, or start from scratch. Compatibility is checked against the current source schema.</p>

        <div className="grid mt-4" style={{gridTemplateColumns:'1fr 360px', gap: 20}}>
          <div>
            <div className="flex gap-2 items-center mb-2">
              <div style={{position:'relative', flex:1}}>
                <div style={{position:'absolute', left:10, top:9, color:'var(--color-gray-dark-500)'}}><Icon name="search" size={14}/></div>
                <input className="input" placeholder="Search filters…" style={{paddingLeft:32}}/>
              </div>
              <div className="seg">
                <button className="is-active">Compatible (2)</button>
                <button>All (9)</button>
                <button>Incompatible (7)</button>
              </div>
            </div>

            <div className="panel" style={{padding:0, overflow:'hidden'}}>
              {/* COMPATIBLE */}
              {[
                { name: "High-value orders", expr: "unit_price_cents * quantity >= 5000", usedBy: 3, compat: "ok" },
                { name: "EU shipments only", expr: "shipping_country in EU_LIST",          usedBy: 2, compat: "ok" },
              ].map((f,i)=>(
                <div key={i} style={{padding:'14px 16px', borderBottom:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:12}}>
                  <TypeGlyph type="filter" size={18}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="text-sm" style={{fontWeight:600}}>{f.name}</div>
                    <div className="mono text-xs text-dim" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.expr}</div>
                  </div>
                  <span className="chip chip-positive"><Icon name="check" size={10}/> compatible</span>
                  <span className="text-xs text-dim">used by {f.usedBy}</span>
                  <button className="btn btn-primary btn-sm">Use</button>
                </div>
              ))}

              {/* INCOMPATIBLE BUT RELATED */}
              <div style={{padding:'10px 16px', background:'var(--color-black-100)', fontSize:11, color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em'}}>
                Incompatible · references missing fields
              </div>
              {[
                { name: "Attributed orders (growth)", expr: "utm_source is not null AND utm_campaign is not null", missing: ["utm_source","utm_campaign"] },
                { name: "Refund events",              expr: "event_type = 'refund' AND refund_amount > 0",         missing: ["event_type","refund_amount"] },
                { name: "Payment retries",            expr: "payment_retry_count > 2",                             missing: ["payment_retry_count"] },
              ].map((f,i)=>(
                <div key={i} style={{padding:'14px 16px', borderBottom:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:12, opacity:0.85}}>
                  <TypeGlyph type="filter" size={18}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="text-sm" style={{fontWeight:600}}>{f.name}</div>
                    <div className="mono text-xs text-dim" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.expr}</div>
                  </div>
                  <span className="chip chip-warning" title={`Missing: ${f.missing.join(', ')}`}>
                    <Icon name="warn" size={10}/> missing {f.missing.length} field{f.missing.length>1?'s':''}
                  </span>
                  <button className="btn btn-ghost btn-sm">Inspect</button>
                  <button className="btn btn-secondary btn-sm">Use anyway</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="suggest-card mb-4">
              <Icon name="info" size={16} color="var(--color-orange-300)"/>
              <div style={{flex:1}}>
                <div className="text-sm" style={{fontWeight:600, color:'var(--color-foreground-neutral)'}}>Suggested</div>
                <div className="text-xs text-muted">2 filters in Library are directly compatible with <span className="mono">OrderEvents v4</span>.</div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h3 className="panel-title">Current schema</h3><span className="ml-auto text-xs text-dim">OrderEvents · v4</span></div>
              <div className="text-xs text-muted mb-2">Fields available to filter against</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {["order_id","customer_id","sku","quantity","unit_price_cents","currency","discount_cents","tax_cents","channel","payment_method","placed_at","shipping_country","promo_code","metadata"].map((f,i)=>(
                  <span key={i} className="tag mono" style={{fontSize:10, color:'var(--color-gray-dark-100)'}}>{f}</span>
                ))}
              </div>
            </div>

            <div className="panel mt-4">
              <div className="panel-head"><h3 className="panel-title">Or start fresh</h3></div>
              <div className="text-sm text-muted mb-4">Build a new filter from the current schema. Can be saved back to Library when done.</div>
              <button className="btn btn-secondary w-full"><Icon name="plus" size={13}/> New filter from scratch</button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Annot>
            Compatibility is <strong>warn + auto-suggest</strong>, never a hard block. Compatible configs are sorted first and badged green. Incompatible configs are listed but dimmed, with the exact missing fields surfaced — and "Use anyway" remains available for power users.
          </Annot>
        </div>
      </div>
    </AppShell>
  );
};

Object.assign(window, { ArtLibraryHome, ArtSchemaBlueprint, ArtDriftReconcile, ArtCompatSuggest });
