// Artboards 5-8: Pipeline detail w/ drift, Kafka/ClickHouse conn detail, Empty state + folders

// ====================================================================
// A5. PIPELINE DETAIL with drift indicator
// ====================================================================
const ArtPipelineDrift = () => {
  return (
    <AppShell activeNav="pipelines">
      <div className="page-frame">
        <div className="crumbs mb-2">
          <a>Pipelines</a><span className="sep">/</span><span>prod-orders-to-analytics</span>
        </div>
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16}}>
          <div>
            <div className="flex gap-3 items-center">
              <h1 className="page-title" style={{fontSize:24, color:'var(--color-foreground-neutral)'}}>prod-orders-to-analytics</h1>
              <span className="chip chip-positive"><span className="dot ok"/> active</span>
              <span className="chip chip-warning"><Icon name="drift" size={10}/> schema drift</span>
            </div>
            <div className="text-xs text-dim mt-2 mono">pipeline_id: prod-orders-to-analytics-h8z9a</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary"><Icon name="stop" size={12}/> Stop</button>
            <button className="btn btn-ghost"><Icon name="more" size={14}/></button>
          </div>
        </div>

        <div className="callout warn mt-4">
          <Icon name="drift" size={16}/>
          <div style={{flex:1}}>
            <strong>Library blueprint has drifted</strong>
            Pipeline pinned <span className="mono">OrderEvents v3</span>. Library is now <span className="mono">v4</span> (+2 fields, −1 field, 2 type changes). Pipeline continues to run against its pinned snapshot.
          </div>
          <div className="callout-actions">
            <button className="btn btn-ghost btn-sm">Dismiss</button>
            <button className="btn btn-secondary btn-sm">View diff</button>
            <button className="btn btn-primary btn-sm">Stop &amp; reconcile</button>
          </div>
        </div>

        <div className="grid mt-4" style={{gridTemplateColumns:'1fr 1fr', gap:14}}>
          <div className="panel" style={{padding:16}}>
            <div className="flex items-center gap-2">
              <span style={{color:'var(--color-red-500)'}}>🕸</span>
              <div className="text-sm" style={{fontWeight:600}}>Dead Letter Queue</div>
              <span className="ml-auto text-xs text-dim">Updated just now</span>
            </div>
            <div className="flex gap-6 mt-4">
              <div><div style={{fontSize:26, fontWeight:700, color:'var(--color-orange-300)'}}>142</div><div className="text-xs text-dim">Unconsumed events</div></div>
              <div><div style={{fontSize:26, fontWeight:700}}>3.4k</div><div className="text-xs text-dim">Total in DLQ</div></div>
              <div className="ml-auto" style={{alignSelf:'center'}}><button className="btn btn-secondary btn-sm">Consume</button></div>
            </div>
          </div>
          <div className="panel" style={{padding:16}}>
            <div className="flex items-center gap-2">
              <span style={{color:'var(--color-orange-300)'}}>⚃</span>
              <div className="text-sm" style={{fontWeight:600}}>ClickHouse Table Metrics</div>
              <span className="ml-auto text-xs text-dim">Updated just now</span>
            </div>
            <div className="flex gap-6 mt-4">
              <div><div style={{fontSize:26, fontWeight:700}}>12.4M</div><div className="text-xs text-dim">Total rows</div></div>
              <div><div style={{fontSize:26, fontWeight:700, color:'var(--color-green-500)'}}>1.2k/s</div><div className="text-xs text-dim">Insert rate</div></div>
            </div>
          </div>
        </div>

        <div className="panel mt-4" style={{padding:20}}>
          <div className="panel-head">
            <h3 className="panel-title">Pipeline composition</h3>
            <span className="ml-auto text-xs text-dim">Click a stage to inspect. Stages marked <span style={{color:'var(--color-yellow-400)'}}>drift</span> need reconciliation.</span>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr auto 2fr auto 1fr', alignItems:'center', gap:10}}>
            <div className="node is-source">
              <div className="node-head"><Icon name="kafka" size={11}/> SOURCE · KAFKA</div>
              <div className="node-title">kafka-prod-eu</div>
              <div className="node-sub">orders.placed.v2</div>
              <div className="text-xs mt-2">
                <span className="chip chip-info mono" style={{height:18, fontSize:10}}>OrderEvents v3</span>
              </div>
              <div className="text-xs" style={{color:'var(--color-yellow-400)', marginTop:4}}>↳ blueprint v4 available</div>
            </div>
            <div className="arrow">──▶</div>
            <div>
              <div className="flex gap-2 items-stretch">
                <div className="node">
                  <div className="node-head"><Icon name="dedup" size={11}/> DEDUP</div>
                  <div className="node-title">order_id · 5m</div>
                  <div className="node-sub">saved: orders-dedup</div>
                </div>
                <div className="node is-warn">
                  <div className="node-head" style={{color:'var(--color-yellow-400)'}}><Icon name="filter" size={11}/> FILTER</div>
                  <div className="node-title">High-value orders</div>
                  <div className="node-sub" style={{color:'var(--color-yellow-400)'}}>references legacy_promo_id</div>
                </div>
                <div className="node">
                  <div className="node-head"><Icon name="transform" size={11}/> TRANSFORM</div>
                  <div className="node-title">+ revenue_cents</div>
                  <div className="node-sub">inline</div>
                </div>
              </div>
              <div className="text-xs text-dim mt-2" style={{textAlign:'center'}}>transformation: ingest + compute</div>
            </div>
            <div className="arrow">──▶</div>
            <div className="node is-sink">
              <div className="node-head"><Icon name="ch" size={11}/> SINK · CLICKHOUSE</div>
              <div className="node-title">ch-analytics-prod</div>
              <div className="node-sub">analytics.orders</div>
              <div className="text-xs mt-2">14 → 14 cols</div>
            </div>
          </div>
        </div>

        <div className="panel mt-4">
          <div className="panel-head">
            <h3 className="panel-title">Library links</h3>
            <span className="ml-auto text-xs text-dim">This pipeline references saved components. Edits to these have no live effect.</span>
          </div>
          <table className="tbl">
            <thead><tr><th>Component</th><th>Type</th><th>Pinned</th><th>Library state</th><th>Last synced</th><th></th></tr></thead>
            <tbody>
              <tr>
                <td><span className="flex gap-2 items-center"><TypeGlyph type="kafka" size={16}/><span>kafka-prod-eu</span></span></td>
                <td><span className="chip chip-neutral">connection</span></td>
                <td className="mono">—</td>
                <td><span className="chip chip-muted">always live</span></td>
                <td className="muted">—</td>
                <td><Icon name="chevR" size={14} color="var(--color-gray-dark-500)"/></td>
              </tr>
              <tr>
                <td><span className="flex gap-2 items-center"><TypeGlyph type="schema" size={16}/><span>OrderEvents</span></span></td>
                <td><span className="chip chip-neutral">schema blueprint</span></td>
                <td className="mono">v3</td>
                <td><span className="chip chip-warning"><Icon name="drift" size={10}/> drift · v4</span></td>
                <td className="muted">14d ago</td>
                <td><Icon name="chevR" size={14} color="var(--color-gray-dark-500)"/></td>
              </tr>
              <tr>
                <td><span className="flex gap-2 items-center"><TypeGlyph type="dedup" size={16}/><span>orders-dedup</span></span></td>
                <td><span className="chip chip-neutral">dedup config</span></td>
                <td className="mono">v1</td>
                <td><span className="chip chip-muted">in sync</span></td>
                <td className="muted">14d ago</td>
                <td><Icon name="chevR" size={14} color="var(--color-gray-dark-500)"/></td>
              </tr>
              <tr>
                <td><span className="flex gap-2 items-center"><TypeGlyph type="filter" size={16}/><span>High-value orders</span></span></td>
                <td><span className="chip chip-neutral">filter config</span></td>
                <td className="mono">v2</td>
                <td><span className="chip chip-warning">incompat · needs review</span></td>
                <td className="muted">14d ago</td>
                <td><Icon name="chevR" size={14} color="var(--color-gray-dark-500)"/></td>
              </tr>
              <tr>
                <td><span className="flex gap-2 items-center"><TypeGlyph type="ch" size={16}/><span>ch-analytics-prod</span></span></td>
                <td><span className="chip chip-neutral">connection</span></td>
                <td className="mono">—</td>
                <td><span className="chip chip-muted">always live</span></td>
                <td className="muted">—</td>
                <td><Icon name="chevR" size={14} color="var(--color-gray-dark-500)"/></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <Annot>
            Drift is surfaced <strong>at the pipeline</strong>, not the library. Pipeline is the artifact; blueprint is the description. Drift banner is dismissible but sticky until reconciled. Connections are "always live" because they're credentials, not schemas.
          </Annot>
        </div>
      </div>
    </AppShell>
  );
};

// ====================================================================
// A6. KAFKA CONNECTION DETAIL
// ====================================================================
const ArtKafkaConn = () => {
  return (
    <AppShell activeNav="library">
      <LibrarySide active="kafka"/>
      <div className="page-frame">
        <div className="crumbs mb-2">
          <a>Library</a><span className="sep">/</span><a>Kafka connections</a><span className="sep">/</span><span>kafka-prod-eu</span>
        </div>
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between'}}>
          <div>
            <div className="flex gap-3 items-center">
              <TypeGlyph type="kafka" size={22}/>
              <h1 className="page-title" style={{fontSize:24, color:'var(--color-foreground-neutral)'}}>kafka-prod-eu</h1>
              <span className="chip chip-positive"><span className="dot ok"/> reachable</span>
            </div>
            <p className="page-subtitle">EU-region production Kafka cluster. SASL/SCRAM auth.</p>
            <div className="flex gap-2 mt-2"><span className="tag">kafka-prod</span><span className="tag">eu-west-1</span></div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost"><Icon name="history" size={13}/> Audit log</button>
            <button className="btn btn-secondary"><Icon name="check" size={13}/> Test connection</button>
            <button className="btn btn-primary"><Icon name="edit" size={13}/> Edit</button>
          </div>
        </div>

        <div className="grid mt-6" style={{gridTemplateColumns:'2fr 1fr', gap:20}}>
          <div>
            <div className="panel">
              <div className="panel-head"><h3 className="panel-title">Connection</h3></div>
              <div className="kv-row"><span className="k">Bootstrap servers</span><span className="v mono">b-1.kafka.eu.glassflow.xyz:9092<br/>b-2.kafka.eu.glassflow.xyz:9092<br/>b-3.kafka.eu.glassflow.xyz:9092</span></div>
              <div className="kv-row"><span className="k">Auth method</span><span className="v">SASL / SCRAM-SHA-512</span></div>
              <div className="kv-row"><span className="k">Username</span><span className="v mono">glassflow-ingest</span></div>
              <div className="kv-row"><span className="k">Password</span><span className="v mono text-dim">•••••••••••••••••• <span className="text-xs" style={{color:'var(--color-gray-dark-500)', marginLeft:6}}>encrypted at rest</span></span></div>
              <div className="kv-row"><span className="k">TLS</span><span className="v">enabled</span></div>
              <div className="kv-row"><span className="k">Consumer group prefix</span><span className="v mono">glassflow-</span></div>
            </div>

            <div className="panel mt-4">
              <div className="panel-head">
                <h3 className="panel-title">Derived schemas</h3>
                <span className="chip chip-neutral">3</span>
                <span className="ml-auto text-xs text-dim">Blueprints derived from topics on this cluster</span>
              </div>
              <table className="tbl">
                <thead><tr><th>Schema</th><th>Derived from topic</th><th>Version</th><th>Used by</th></tr></thead>
                <tbody>
                  <tr><td><span className="flex gap-2 items-center"><TypeGlyph type="schema" size={16}/> OrderEvents</span></td><td className="mono text-muted">orders.placed.v2</td><td className="mono">v4</td><td>6 pipelines</td></tr>
                  <tr><td><span className="flex gap-2 items-center"><TypeGlyph type="schema" size={16}/> UserSignups</span></td><td className="mono text-muted">signups.v1</td><td className="mono">v2</td><td>3 pipelines</td></tr>
                  <tr><td><span className="flex gap-2 items-center"><TypeGlyph type="schema" size={16}/> BillingTransactions</span></td><td className="mono text-muted">billing.tx.v3</td><td className="mono">v7</td><td>5 pipelines</td></tr>
                </tbody>
              </table>
            </div>

            <div className="panel mt-4">
              <div className="panel-head">
                <h3 className="panel-title">Used by</h3>
                <span className="chip chip-neutral">9 pipelines</span>
              </div>
              <div className="text-xs text-dim mb-4">Edits to this connection affect running pipelines the next time they reconnect.</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 8}}>
                {["prod-orders-to-analytics","prod-orders-to-billing","prod-signups-to-crm","growth-order-attribution","finance-order-refunds","prod-billing-to-ch","ops-order-dlq-monitor","prod-signups-slack","prod-signups-to-segment"].map((p,i)=>(
                  <div key={i} className="surface" style={{padding:'8px 10px', fontSize:12, display:'flex', alignItems:'center', gap:8}}>
                    <span className="dot ok"/>
                    <span className="mono" style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="panel">
              <div className="panel-head"><h3 className="panel-title">Health</h3></div>
              <div className="kv-row"><span className="k">Last tested</span><span className="v">2 min ago · <span style={{color:'var(--color-green-500)'}}>ok</span></span></div>
              <div className="kv-row"><span className="k">Broker latency</span><span className="v">12 ms (avg)</span></div>
              <div className="kv-row"><span className="k">Topics visible</span><span className="v">247</span></div>
              <div className="kv-row"><span className="k">Active consumers</span><span className="v">9</span></div>
            </div>

            <div className="panel mt-4">
              <div className="panel-head"><h3 className="panel-title">Metadata</h3></div>
              <div className="kv-row"><span className="k">ID</span><span className="v mono">conn_kfk_01HXK9…</span></div>
              <div className="kv-row"><span className="k">Folder</span><span className="v">Production / analytics</span></div>
              <div className="kv-row"><span className="k">Created</span><span className="v">Jan 8 · VC</span></div>
              <div className="kv-row"><span className="k">Updated</span><span className="v">14d ago · Petra</span></div>
            </div>

            <div className="panel mt-4" style={{borderColor:'var(--color-red-900)'}}>
              <div className="panel-head"><h3 className="panel-title" style={{color:'var(--color-red-500)'}}>Danger zone</h3></div>
              <div className="text-xs text-muted mb-4">Deleting this connection breaks 9 running pipelines.</div>
              <button className="btn btn-danger-ghost w-full"><Icon name="trash" size={13}/> Delete connection</button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Annot>
            Connection detail mirrors the schema-detail layout: configuration, derived schemas, used-by, metadata, danger zone. <strong>Credentials are always "live"</strong> — no pinning, no drift concept — edits affect pipelines on next reconnect.
          </Annot>
        </div>
      </div>
    </AppShell>
  );
};

// ====================================================================
// A7. CLICKHOUSE CONNECTION DETAIL (denser; shows layout reuse)
// ====================================================================
const ArtClickHouseConn = () => {
  return (
    <AppShell activeNav="library">
      <LibrarySide active="ch"/>
      <div className="page-frame">
        <div className="crumbs mb-2">
          <a>Library</a><span className="sep">/</span><a>ClickHouse connections</a><span className="sep">/</span><span>ch-analytics-prod</span>
        </div>
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between'}}>
          <div>
            <div className="flex gap-3 items-center">
              <TypeGlyph type="ch" size={22}/>
              <h1 className="page-title" style={{fontSize:24, color:'var(--color-foreground-neutral)'}}>ch-analytics-prod</h1>
              <span className="chip chip-positive"><span className="dot ok"/> reachable</span>
            </div>
            <p className="page-subtitle">Analytics ClickHouse cluster · HTTP+TLS on 8443, native on 9440.</p>
            <div className="flex gap-2 mt-2"><span className="tag">clickhouse-prod</span><span className="tag">analytics</span></div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary"><Icon name="check" size={13}/> Test connection</button>
            <button className="btn btn-primary"><Icon name="edit" size={13}/> Edit</button>
          </div>
        </div>

        <div className="grid mt-6" style={{gridTemplateColumns:'2fr 1fr', gap:20}}>
          <div>
            <div className="panel">
              <div className="panel-head"><h3 className="panel-title">Connection</h3></div>
              <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                <div>
                  <div className="kv-row" style={{gridTemplateColumns:'110px 1fr'}}><span className="k">Host</span><span className="v mono">ch.prod.glassflow.xyz</span></div>
                  <div className="kv-row" style={{gridTemplateColumns:'110px 1fr'}}><span className="k">HTTP port</span><span className="v mono">8443</span></div>
                  <div className="kv-row" style={{gridTemplateColumns:'110px 1fr'}}><span className="k">Native port</span><span className="v mono">9440</span></div>
                </div>
                <div>
                  <div className="kv-row" style={{gridTemplateColumns:'110px 1fr'}}><span className="k">Username</span><span className="v mono">glassflow_writer</span></div>
                  <div className="kv-row" style={{gridTemplateColumns:'110px 1fr'}}><span className="k">Password</span><span className="v mono text-dim">••••••••••••</span></div>
                  <div className="kv-row" style={{gridTemplateColumns:'110px 1fr'}}><span className="k">SSL</span><span className="v">enabled · verify cert</span></div>
                </div>
              </div>
            </div>

            <div className="panel mt-4">
              <div className="panel-head">
                <h3 className="panel-title">Databases &amp; tables</h3>
                <span className="ml-auto text-xs text-dim">Introspected 4 min ago</span>
                <button className="btn btn-ghost btn-sm" style={{marginLeft:10}}>Refresh</button>
              </div>
              <table className="tbl">
                <thead><tr><th>Database</th><th>Tables</th><th>Rows</th><th>Used by sinks</th></tr></thead>
                <tbody>
                  <tr><td className="mono">analytics</td><td>12</td><td className="num">412.6M</td><td>5 pipelines</td></tr>
                  <tr><td className="mono">billing</td><td>8</td><td className="num">91.2M</td><td>3 pipelines</td></tr>
                  <tr><td className="mono">ops</td><td>4</td><td className="num">3.1M</td><td>1 pipeline</td></tr>
                  <tr><td className="mono">default</td><td>2</td><td className="num">212k</td><td>0</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="panel">
              <div className="panel-head"><h3 className="panel-title">Health</h3></div>
              <div className="kv-row"><span className="k">Last tested</span><span className="v">4 min ago · <span style={{color:'var(--color-green-500)'}}>ok</span></span></div>
              <div className="kv-row"><span className="k">Insert latency p95</span><span className="v">180 ms</span></div>
              <div className="kv-row"><span className="k">Server version</span><span className="v mono">24.3.2.1</span></div>
              <div className="kv-row"><span className="k">Replicas</span><span className="v">3</span></div>
            </div>
            <div className="panel mt-4">
              <div className="panel-head"><h3 className="panel-title">Used by</h3></div>
              <div className="text-sm mb-2"><strong>9</strong> pipelines write to this cluster.</div>
              <button className="btn btn-ghost btn-sm w-full">View all pipelines</button>
            </div>
            <div className="panel mt-4">
              <div className="panel-head"><h3 className="panel-title">Metadata</h3></div>
              <div className="kv-row"><span className="k">ID</span><span className="v mono">conn_ch_01HXR2…</span></div>
              <div className="kv-row"><span className="k">Folder</span><span className="v">Production / analytics</span></div>
              <div className="kv-row"><span className="k">Updated</span><span className="v">30d ago · VC</span></div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Annot>
            ClickHouse connection detail reuses the same <strong>two-column shell</strong> as Kafka; only the config block and "databases &amp; tables" introspection differ. This consistency is what makes Library navigation feel one-piece.
          </Annot>
        </div>
      </div>
    </AppShell>
  );
};

// ====================================================================
// A8. EMPTY STATE — first-time Library
// ====================================================================
const ArtEmptyState = () => {
  return (
    <AppShell activeNav="library">
      <LibrarySide active="all"/>
      <div className="page-frame">
        <div className="crumbs mb-2"><a>Library</a><span className="sep">/</span><span>All components</span></div>
        <h1 className="page-title">Library</h1>
        <p className="page-subtitle">Reusable connections, schemas, and processing configs. Build one, use many.</p>

        <div className="panel mt-6" style={{padding: 32, textAlign: 'center', background:'var(--color-black-300)'}}>
          <div style={{margin:'0 auto 20px', width:72, height:72, borderRadius:16, background:'var(--color-orange-alpha-10)', border:'1px solid var(--color-orange-alpha-20)', display:'grid', placeItems:'center', color:'var(--color-orange-300)'}}>
            <Icon name="library" size={32}/>
          </div>
          <h2 style={{fontFamily:'var(--font-family-title)', fontWeight:700, fontSize:22, margin:'0 0 8px'}}>Your library is empty</h2>
          <p className="text-muted" style={{maxWidth: 520, margin:'0 auto 24px'}}>
            Save connections and schemas as you build pipelines, or seed your library now. Library items become available in the wizard and canvas the moment they're saved.
          </p>

          <div className="grid" style={{gridTemplateColumns:'repeat(4, 1fr)', gap:12, maxWidth:820, margin:'0 auto'}}>
            {[
              { type:"kafka", title:"Add Kafka connection", desc:"Bootstrap servers, auth" },
              { type:"ch", title:"Add ClickHouse connection", desc:"Host, credentials, SSL" },
              { type:"schema", title:"Define a schema", desc:"Derive from topic or manual" },
              { type:"filter", title:"Save a filter", desc:"Bound to a schema" },
            ].map((c,i)=>(
              <div key={i} className="surface-raised" style={{padding:16, textAlign:'left', cursor:'pointer'}}>
                <TypeGlyph type={c.type} size={20}/>
                <div className="text-sm mt-2" style={{fontWeight:600}}>{c.title}</div>
                <div className="text-xs text-dim mt-2">{c.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-xs text-dim">
            Prefer to start with a pipeline? <span className="text-accent" style={{cursor:'pointer'}}>Open the Create wizard</span> — you can save connections to the library from there.
          </div>
        </div>

        <div className="mt-6">
          <Annot>
            First-run lands in the <strong>existing Create wizard</strong> by default. The Library empty state is discoverable but not pushy — it exists for the moment a user clicks "Library" to see what's there. Contribution flow lives in the wizard (Phase 3).
          </Annot>
        </div>
      </div>
    </AppShell>
  );
};

// ====================================================================
// A9. PICK-FROM-LIBRARY SHORTCUT in wizard (bonus: shows the bridge)
// ====================================================================
const ArtWizardBridge = () => {
  return (
    <AppShell activeNav="pipelines">
      <div className="page-frame">
        <div className="crumbs mb-2"><a>Pipelines</a><span className="sep">/</span><a>Create</a><span className="sep">/</span><span>Kafka connection</span></div>

        <div style={{display:'grid', gridTemplateColumns:'240px 1fr', gap: 24, maxWidth: 1000, margin:'16px auto 0'}}>
          {/* wizard rail */}
          <div style={{paddingTop: 10}}>
            {[
              { name: "Pipeline type",        done: true },
              { name: "Kafka connection",     active: true },
              { name: "Topic & schema" },
              { name: "Deduplication" },
              { name: "ClickHouse connection" },
              { name: "Mapping" },
              { name: "Pipeline resources" },
            ].map((s,i)=>(
              <div key={i} className="flex gap-3 items-center" style={{padding:'10px 6px', color: s.active?'var(--color-foreground-neutral)': s.done?'var(--color-gray-dark-100)':'var(--color-gray-dark-500)', fontSize:13}}>
                <span style={{width:18, height:18, borderRadius:999, background: s.done?'var(--color-orange-300)':'transparent', border:'1px solid var(--color-orange-400)', display:'grid', placeItems:'center', color:'var(--color-black)', fontSize:11}}>
                  {s.done ? <Icon name="check" size={11}/> : s.active ? '●' : ''}
                </span>
                <span>{s.name}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Kafka connection</h3>
              <span className="ml-auto text-xs text-dim">Step 2 of 7</span>
            </div>

            <div className="callout info mb-4">
              <Icon name="library" size={14}/>
              <div style={{flex:1}}>
                <strong>2 saved connections match this broker</strong>
                <span className="text-xs">b-1.kafka.eu.glassflow.xyz · auto-detected</span>
              </div>
            </div>

            <div className="mb-4" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              {[
                { name:"kafka-prod-eu", meta:"SASL/SCRAM · 9 pipelines", rec:true },
                { name:"kafka-staging-eu", meta:"SASL/SCRAM · 2 pipelines" },
              ].map((c,i)=>(
                <div key={i} className="surface-raised" style={{padding:14, cursor:'pointer', borderColor: c.rec?'var(--color-orange-400)':'var(--color-gray-350)'}}>
                  <div className="flex items-center gap-2">
                    <TypeGlyph type="kafka" size={16}/>
                    <div className="text-sm" style={{fontWeight:600}}>{c.name}</div>
                    {c.rec && <span className="chip chip-positive ml-auto" style={{fontSize:10, height:18}}>match</span>}
                  </div>
                  <div className="text-xs text-dim mt-2">{c.meta}</div>
                </div>
              ))}
            </div>

            <div style={{textAlign:'center', margin:'18px 0', color:'var(--color-gray-dark-500)', fontSize:11, letterSpacing:'0.06em'}}>OR CONFIGURE MANUALLY</div>

            <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:10}}>
              <div><div className="text-xs text-dim mb-2">Bootstrap servers</div><input className="input" placeholder="b-1.kafka.example.com:9092"/></div>
              <div><div className="text-xs text-dim mb-2">Auth method</div><input className="input" defaultValue="SASL / SCRAM-SHA-512"/></div>
              <div><div className="text-xs text-dim mb-2">Username</div><input className="input" placeholder="kafka-user"/></div>
              <div><div className="text-xs text-dim mb-2">Password</div><input className="input" type="password" placeholder="••••••"/></div>
            </div>

            <div className="mt-4 flex items-center gap-2" style={{padding:'12px 14px', background:'var(--color-black-600)', border:'1px dashed var(--color-gray-dark-300)', borderRadius:8}}>
              <input type="checkbox" defaultChecked/>
              <span className="text-sm">Save this connection to Library as</span>
              <input className="input" style={{maxWidth:220, height:28}} placeholder="kafka-prod-eu-2"/>
              <span className="ml-auto text-xs text-dim">non-blocking — you can skip</span>
            </div>

            <div className="flex justify-between mt-6">
              <button className="btn btn-ghost">Back</button>
              <div className="flex gap-2">
                <button className="btn btn-secondary">Test connection</button>
                <button className="btn btn-primary">Continue</button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Annot>
            The bridge pattern (Phase 3 in the ADR). Wizard detects broker match and surfaces saved connections inline. The "Save to Library" checkbox is pre-checked but non-blocking — this is how the Library grows organically from wizard usage without retraining users.
          </Annot>
        </div>
      </div>
    </AppShell>
  );
};

Object.assign(window, { ArtPipelineDrift, ArtKafkaConn, ArtClickHouseConn, ArtEmptyState, ArtWizardBridge });
