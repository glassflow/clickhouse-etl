// Canvas artboards 5-10: empty, slot picker, modal inspector, drag, deploy, draft, AI

// ============ C5. EMPTY CANVAS + STARTER SLOT ============
const ArtCanvasEmpty = () => {
  return (
    <div className="pc-stage">
      <PCHeader
        name="Untitled pipeline"
        nameId="new draft · not saved"
        actions={<>
          <button className="btn btn-ghost btn-sm" disabled>Validate</button>
          <button className="btn btn-primary btn-sm" disabled><CIcon name="rocket" size={12}/> Deploy</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill">Start by picking a source</div>
            <div style={{flex:1}}/>
            <PCZoom level="100%"/>
          </PCToolbar>

          <div className="pc-flow" style={{flexDirection:'column', gap:24}}>
            <div className="pc-empty-hint" style={{marginBottom:8}}>
              <div style={{width:56, height:56, borderRadius:14, background:'var(--color-orange-alpha-10)', border:'1px solid var(--color-orange-alpha-20)', display:'grid', placeItems:'center', color:'var(--color-orange-300)'}}>
                <Icon name="pipelines" size={24}/>
              </div>
              <h3>Build your pipeline</h3>
              <p>Drag a source from the Library, pick one below, or let the AI assistant sketch the first draft.</p>
            </div>

            <div className="pc-row">
              <div className="pc-starter-slot">
                <span className="lbl-sm">+ source</span>
                <span className="lbl-lg">Pick a source</span>
                <span style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>Kafka · OTLP</span>
              </div>
              <PCEdge/>
              <div className="pc-starter-slot" style={{opacity:0.5}}>
                <span className="lbl-sm">stages</span>
                <span style={{fontSize:12}}>dedup · filter · transform · join</span>
              </div>
              <PCEdge/>
              <div className="pc-starter-slot" style={{opacity:0.5}}>
                <span className="lbl-sm">+ sink</span>
                <span className="lbl-lg">ClickHouse</span>
              </div>
            </div>
          </div>

          <PCDeployBar
            status="Add a source to begin"
            actions={<>
              <button className="btn btn-ghost btn-sm">Cancel</button>
              <button className="btn btn-secondary btn-sm"><CIcon name="save" size={12}/> Save as draft</button>
            </>}
          />
        </div>
        <PCDock items={[
          { label: "Sources", rows: [
            { type:"source", glyph:"kafka", name:"kafka-prod-eu", sub:"SASL/SCRAM · 9 pipelines" },
            { type:"source", glyph:"kafka", name:"kafka-staging-eu", sub:"SASL/SCRAM · 2 pipelines" },
            { type:"otlp", glyph:"schema", name:"otlp-ingest-eu", sub:"grpc://…:4317" },
          ]},
          { label: "Starting templates", rows: [
            { type:"schema", glyph:"schema", name:"Kafka → CH (simple)", sub:"source · dedup · sink" },
            { type:"schema", glyph:"schema", name:"OTLP → CH (logs)", sub:"source · filter · sink" },
          ]},
        ]}/>
      </div>
    </div>
  );
};

// ============ C6. SLOT PICKER OPEN — compatible vs locked ============
const ArtCanvasSlotPicker = () => {
  const picker = (
    <PCSlotPicker
      contextLabel="Between SOURCE and DEDUP · schema = OrderEvents v4"
      compatible={[
        { type:"filter",    title:"New filter",         sub:"Start from current schema",  glyph:"filter" },
        { type:"transform", title:"New transform",      sub:"Add or reshape fields",      glyph:"transform" },
        { type:"filter",    title:"High-value orders",  sub:"saved · compatible",         meta:"from Library", glyph:"filter" },
        { type:"transform", title:"Mask PII",           sub:"saved · compatible",         meta:"from Library", glyph:"transform" },
      ]}
      incompatible={[
        { type:"dedup",  title:"Deduplication", sub:"Already present earlier in pipeline", reason:"single-per-flow", glyph:"dedup" },
        { type:"join",   title:"Join",          sub:"Needs two sources",                    reason:"needs 2 sources", glyph:"dedup" },
        { type:"source", title:"Source",        sub:"Pipeline already has a source",        reason:"one source only", glyph:"kafka" },
        { type:"sink",   title:"Sink",          sub:"Sink belongs at end of pipeline",      reason:"end-only",         glyph:"ch" },
      ]}
    />
  );

  return (
    <div className="pc-stage">
      <PCHeader
        name="prod-orders-to-analytics"
        nameId="draft · inserting stage"
        actions={<>
          <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill"><Icon name="schema" size={12}/> <strong>OrderEvents v4</strong></div>
            <div style={{flex:1}}/>
            <PCZoom level="100%"/>
          </PCToolbar>

          <div className="pc-flow">
            <div className="pc-row" style={{alignItems:'center'}}>
              <PCNode type="source" saved
                title="kafka-prod-eu"
                sub="orders.placed.v2"
                body={<span className="pc-schema-chip">OrderEvents v4</span>}
              />
              <PCEdge/>
              <PCSlot open picker={picker}/>
              <PCEdge/>
              <PCNode type="dedup" saved
                title="orders-dedup"
                sub="order_id · 5m"
              />
              <PCEdge/>
              <PCSlot/>
              <PCEdge/>
              <PCNode type="sink" saved
                title="ch-analytics-prod"
                sub="analytics.orders"
              />
            </div>
          </div>

          <div style={{position:'absolute', left:24, bottom:80, maxWidth:320}}>
            <div className="annot">
              <strong>NOTE</strong> Slot pickers are <em>context-aware</em>: only stage types legal at this position appear enabled. Locked ones show why (single-per-flow, sink-only, etc). Saved-from-Library compatible configs are sorted first; "new from scratch" always available at the top.
            </div>
          </div>
        </div>
        <PCDock items={[
          { label: "Compatible processors", rows: [
            { type:"filter", glyph:"filter", name:"High-value orders", sub:"price × qty ≥ 5000", compat:true },
            { type:"transform", glyph:"transform", name:"Mask PII", sub:"hash customer_id", compat:true },
          ]},
        ]}/>
      </div>
    </div>
  );
};

// ============ C7. MODAL INSPECTOR — configure Kafka source ============
const ArtCanvasModal = () => {
  return (
    <div className="pc-stage">
      <PCHeader
        name="prod-orders-to-analytics"
        nameId="draft"
        actions={<>
          <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill">Configuring Kafka source</div>
            <div style={{flex:1}}/>
          </PCToolbar>

          {/* Dimmed flow in background */}
          <div className="pc-flow" style={{opacity:0.35, filter:'blur(1px)'}}>
            <div className="pc-row">
              <PCNode type="source" selected
                title="kafka-prod-eu"
                sub="orders.placed.v2"
              />
              <PCEdge/>
              <PCSlot/>
              <PCEdge/>
              <PCNode type="dedup" saved title="orders-dedup" sub="order_id · 5m"/>
              <PCEdge/>
              <PCSlot/>
              <PCEdge/>
              <PCNode type="sink" saved title="ch-analytics-prod" sub="analytics.orders"/>
            </div>
          </div>

          {/* Modal */}
          <PCModal
            icon="kafka"
            title="Kafka source"
            subtitle="Step 1 of the pipeline · defines the stream"
            wide
            footer={<>
              <button className="btn btn-ghost">Cancel</button>
              <div style={{flex:1}}/>
              <button className="btn btn-secondary"><Icon name="check" size={12}/> Test connection</button>
              <button className="btn btn-primary">Save &amp; close</button>
            </>}
          >
            <div>
              <label style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--color-gray-dark-500)', fontWeight:600}}>Use saved connection</label>
              <div className="pc-source-picker" style={{marginTop:8}}>
                <div className="sp-row is-selected">
                  <span className="glyph g-kafka" style={{width:28, height:28, borderRadius:6}}><Icon name="kafka" size={13}/></span>
                  <div>
                    <div className="sp-title">kafka-prod-eu</div>
                    <div className="sp-sub">b-1.kafka.eu.glassflow.xyz · SASL/SCRAM · 9 pipelines</div>
                  </div>
                  <span className="chip chip-positive"><Icon name="check" size={10}/> reachable</span>
                  <span className="chip chip-neutral">selected</span>
                </div>
                <div className="sp-row">
                  <span className="glyph g-kafka" style={{width:28, height:28, borderRadius:6}}><Icon name="kafka" size={13}/></span>
                  <div>
                    <div className="sp-title">kafka-staging-eu</div>
                    <div className="sp-sub">b-1.kafka.staging.glassflow.xyz · SASL/SCRAM · 2 pipelines</div>
                  </div>
                  <span className="chip chip-muted">not reachable</span>
                  <span></span>
                </div>
                <div className="sp-row" style={{color:'var(--color-orange-300)'}}>
                  <span className="glyph" style={{width:28, height:28, borderRadius:6}}><Icon name="plus" size={13}/></span>
                  <div>
                    <div className="sp-title">Add new connection…</div>
                    <div className="sp-sub">Configure and save to Library</div>
                  </div>
                  <span/><span/>
                </div>
              </div>
            </div>

            <div className="pc-field-grid">
              <div className="pc-field">
                <label>Topic</label>
                <input className="input" defaultValue="orders.placed.v2"/>
                <div className="hint">247 topics visible on cluster</div>
              </div>
              <div className="pc-field">
                <label>Consumer group</label>
                <input className="input" defaultValue="glassflow-prod-orders-analytics"/>
                <div className="hint">Auto-generated · override if needed</div>
              </div>
              <div className="pc-field">
                <label>Start position</label>
                <input className="input" defaultValue="latest"/>
                <div className="hint">earliest · latest · timestamp</div>
              </div>
              <div className="pc-field">
                <label>Deserialiser</label>
                <input className="input" defaultValue="JSON (inferred)"/>
                <div className="hint">JSON · Avro · Protobuf</div>
              </div>
            </div>

            <div>
              <label style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--color-gray-dark-500)', fontWeight:600}}>Schema · derived from topic sample</label>
              <div className="flex gap-2 items-center" style={{marginTop:8, marginBottom:8}}>
                <span className="pc-schema-chip"><Icon name="schema" size={10}/> OrderEvents v4</span>
                <span className="text-xs text-dim">from Library · pinned at save</span>
                <div style={{flex:1}}/>
                <button className="btn btn-ghost btn-sm">Re-infer</button>
                <button className="btn btn-secondary btn-sm">Open in Library</button>
              </div>
              <div className="pc-kv-list">
                {[
                  ["order_id","string","req"],
                  ["customer_id","string","req"],
                  ["sku","string","req"],
                  ["quantity","uint32","req"],
                  ["unit_price_cents","uint64","req"],
                  ["currency","string","req"],
                  ["discount_cents","uint64","opt"],
                  ["tax_cents","uint64","opt"],
                  ["channel","string","req"],
                  ["placed_at","datetime","req"],
                ].map(([n,t,r],i)=>(
                  <div key={i} className="r">
                    <span className="n">{n}</span>
                    <span className="t">{t}</span>
                    <span className="rq">{r}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="callout info">
              <Icon name="info" size={14}/>
              <div>
                <strong>This source will be saved to Library</strong>
                Connection <span className="mono">kafka-prod-eu</span> already exists. Schema <span className="mono">OrderEvents v4</span> will be pinned into this pipeline.
              </div>
            </div>
          </PCModal>
        </div>
        <PCDock items={[{label:"Library", rows:[]}]}/>
      </div>
    </div>
  );
};

// ============ C8. DRAG-FROM-LIBRARY INTERACTION ============
const ArtCanvasDrag = () => {
  return (
    <div className="pc-stage">
      <PCHeader
        name="prod-orders-to-analytics"
        nameId="draft · dragging filter"
        actions={<>
          <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill"><Icon name="schema" size={12}/> <strong>OrderEvents v4</strong></div>
            <div className="pc-pill" style={{color:'var(--color-orange-300)', borderColor:'var(--color-orange-alpha-20)'}}>
              <Icon name="info" size={12}/> Drop onto a glowing slot · 2 legal positions
            </div>
            <div style={{flex:1}}/>
          </PCToolbar>

          <div className="pc-flow">
            <div className="pc-row">
              <PCNode type="source" saved
                title="kafka-prod-eu"
                sub="orders.placed.v2"
                body={<span className="pc-schema-chip">OrderEvents v4</span>}
              />
              <PCEdge/>
              <PCSlot dropTarget/>
              <PCEdge/>
              <PCNode type="dedup" saved
                title="orders-dedup"
                sub="order_id · 5m"
              />
              <PCEdge/>
              <PCSlot dropTarget/>
              <PCEdge/>
              <PCNode type="sink" saved
                title="ch-analytics-prod"
                sub="analytics.orders"
              />
            </div>
          </div>

          {/* Drag ghost */}
          <div className="pc-drag-ghost">
            <PCNode type="filter"
              title="EU shipments only"
              sub="shipping_country in EU_LIST"
              badge="dragging"
            />
          </div>

          <div style={{position:'absolute', left:24, bottom:80, maxWidth:340}}>
            <div className="annot">
              <strong>NOTE</strong> During drag, slots the stage is legal at pulse orange. Illegal slots stay gray. A ghost of the dragged item follows the cursor at -2° tilt. Drop = configured-and-placed (inherits Library settings); cursor Esc = cancel.
            </div>
          </div>

          <PCDeployBar
            status="Placing EU shipments only…"
            mono="schema guard: pass"
            actions={<>
              <button className="btn btn-ghost btn-sm">Cancel drag</button>
            </>}
          />
        </div>
        <PCDock dragging="filter-eu" items={[
          { label: "Dragging", rows: [
            { key:"filter-eu", type:"filter", glyph:"filter", name:"EU shipments only", sub:"shipping_country in EU_LIST", compat:true },
          ]},
          { label: "Processors", rows: [
            { type:"filter", glyph:"filter", name:"High-value orders", sub:"price × qty ≥ 5000", compat:true },
            { type:"transform", glyph:"transform", name:"Mask PII", sub:"hash customer_id", compat:true },
            { type:"dedup", glyph:"dedup", name:"session-dedup", sub:"session_id · 10m" },
          ]},
        ]}/>
      </div>
    </div>
  );
};

// ============ C9. DEPLOY CONFIRMATION / SUMMARY ============
const ArtCanvasDeploy = () => {
  return (
    <div className="pc-stage">
      <PCHeader
        name="prod-orders-to-analytics"
        nameId="draft · review before deploy"
        actions={<>
          <button className="btn btn-ghost btn-sm">Back to canvas</button>
        </>}
      />
      <div style={{flex:1, overflow:'auto', padding:'28px 40px', background:'#08080a'}}>
        <div style={{maxWidth: 1120, margin:'0 auto'}}>
          <div className="flex gap-3 items-center mb-2">
            <h1 style={{margin:0, fontFamily:'var(--font-family-title)', fontSize:22, fontWeight:700, color:'var(--color-foreground-neutral)'}}>Review &amp; deploy</h1>
            <span className="chip chip-positive"><Icon name="check" size={10}/> valid</span>
            <span className="chip chip-neutral">5 stages</span>
            <div style={{flex:1}}/>
            <button className="btn btn-ghost">Cancel</button>
            <button className="btn btn-secondary"><CIcon name="save" size={12}/> Save as draft</button>
            <button className="btn btn-primary"><CIcon name="rocket" size={12}/> Deploy pipeline</button>
          </div>
          <p style={{color:'var(--color-gray-250)', margin:'2px 0 22px', fontSize:13}}>
            Once deployed, the pipeline begins consuming from <span className="mono">orders.placed.v2</span> at position <span className="mono">latest</span> and writes to <span className="mono">analytics.orders</span>.
          </p>

          {/* Mini flow preview */}
          <div className="pc-deploy-card mb-4">
            <h4><Icon name="pipelines" size={14}/> Pipeline composition <span className="chip chip-muted">preview</span></h4>
            <div className="pc-row" style={{transform:'scale(0.85)', transformOrigin:'left', gap:0}}>
              <PCNode type="source" saved title="kafka-prod-eu" sub="orders.placed.v2" body={<span className="pc-schema-chip">OrderEvents v4</span>}/>
              <PCEdge/>
              <PCNode type="dedup" saved title="orders-dedup" sub="order_id · 5m"/>
              <PCEdge/>
              <PCNode type="filter" title="High-value" sub="price × qty ≥ 5000" badge="inline"/>
              <PCEdge/>
              <PCNode type="transform" title="+ revenue_cents" sub="derived" badge="inline"/>
              <PCEdge/>
              <PCNode type="sink" saved title="ch-analytics-prod" sub="analytics.orders"/>
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            <div className="pc-deploy-card">
              <h4><Icon name="kafka" size={14}/> Source <span className="chip chip-muted">kafka-prod-eu · saved</span></h4>
              <div className="kv"><span className="k">topic</span><span className="v">orders.placed.v2</span></div>
              <div className="kv"><span className="k">consumer group</span><span className="v">glassflow-prod-orders-analytics</span></div>
              <div className="kv"><span className="k">start position</span><span className="v">latest</span></div>
              <div className="kv"><span className="k">schema</span><span className="v">OrderEvents v4 (pinned snapshot)</span></div>
            </div>

            <div className="pc-deploy-card">
              <h4><Icon name="ch" size={14}/> Sink <span className="chip chip-muted">ch-analytics-prod · saved</span></h4>
              <div className="kv"><span className="k">database</span><span className="v">analytics</span></div>
              <div className="kv"><span className="k">table</span><span className="v">orders</span></div>
              <div className="kv"><span className="k">mode</span><span className="v">append</span></div>
              <div className="kv"><span className="k">column mapping</span><span className="v">15 → 15 (auto)</span></div>
            </div>

            <div className="pc-deploy-card">
              <h4><Icon name="dedup" size={14}/> Processors <span className="chip chip-neutral">3</span></h4>
              <div className="kv"><span className="k">dedup</span><span className="v">orders-dedup · order_id · 5m</span></div>
              <div className="kv"><span className="k">filter</span><span className="v">High-value orders (inline)</span></div>
              <div className="kv"><span className="k">transform</span><span className="v">+ revenue_cents (inline)</span></div>
            </div>

            <div className="pc-deploy-card">
              <h4><Icon name="schema" size={14}/> Library links <span className="chip chip-muted">3 saved · 2 inline</span></h4>
              <div className="kv"><span className="k">kafka-prod-eu</span><span className="v">connection · always live</span></div>
              <div className="kv"><span className="k">OrderEvents</span><span className="v">schema · pinned v4</span></div>
              <div className="kv"><span className="k">orders-dedup</span><span className="v">dedup config · pinned v1</span></div>
              <div className="kv"><span className="k">ch-analytics-prod</span><span className="v">connection · always live</span></div>
            </div>

            <div className="pc-deploy-card">
              <h4><Icon name="pipelines" size={14}/> Resources</h4>
              <div className="kv"><span className="k">replicas</span><span className="v">2</span></div>
              <div className="kv"><span className="k">cpu / replica</span><span className="v">500m</span></div>
              <div className="kv"><span className="k">memory / replica</span><span className="v">1 GiB</span></div>
              <div className="kv"><span className="k">est. throughput</span><span className="v">~ 2.4k events/sec</span></div>
            </div>

            <div className="pc-deploy-card">
              <h4><Icon name="warn" size={14} color="var(--color-yellow-400)"/> Pre-flight checks <span className="chip chip-positive">all pass</span></h4>
              <div className="kv"><span className="k">source reachable</span><span className="v" style={{color:'var(--color-green-500)'}}>✓ 12ms</span></div>
              <div className="kv"><span className="k">sink reachable</span><span className="v" style={{color:'var(--color-green-500)'}}>✓ 180ms p95</span></div>
              <div className="kv"><span className="k">schema → CH mapping</span><span className="v" style={{color:'var(--color-green-500)'}}>✓ 15/15</span></div>
              <div className="kv"><span className="k">consumer-group conflict</span><span className="v" style={{color:'var(--color-green-500)'}}>✓ none</span></div>
            </div>
          </div>

          <div className="mt-6">
            <div className="annot">
              <strong>NOTE</strong> Deploy is a <em>dedicated screen</em>, not a small confirmation. Users see the whole pipeline in a single frame before committing. Pre-flight checks run inline. "Save as draft" remains a first-class option here — many users will review and decide to pause.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ C10. SAVE-AS-DRAFT FLOW ============
const ArtCanvasDraft = () => {
  return (
    <div className="pc-stage">
      <PCHeader
        name="prod-orders-to-analytics"
        nameId="draft · just saved"
        actions={<>
          <button className="btn btn-secondary btn-sm">Validate</button>
          <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill"><Icon name="schema" size={12}/> <strong>OrderEvents v4</strong></div>
            <div className="pc-pill"><Icon name="info" size={12}/> autosaved 3s ago</div>
            <div style={{flex:1}}/>
            <PCZoom level="100%"/>
          </PCToolbar>

          <div className="pc-flow">
            <div className="pc-row">
              <PCNode type="source" saved title="kafka-prod-eu" sub="orders.placed.v2" body={<span className="pc-schema-chip">OrderEvents v4</span>}/>
              <PCEdge/>
              <PCSlot/>
              <PCEdge/>
              <PCNode type="dedup" saved title="orders-dedup" sub="order_id · 5m"/>
              <PCEdge/>
              <PCSlot/>
              <PCEdge/>
              <PCNode type="filter" title="High-value orders" sub="price × qty ≥ 5000" badge="inline"/>
              <PCEdge/>
              <PCSlot/>
              <PCEdge/>
              <PCNode type="sink" saved title="ch-analytics-prod" sub="analytics.orders"/>
            </div>
          </div>

          {/* Toast */}
          <div className="pc-toast is-success">
            <span className="dot"/>
            <div>
              <div style={{fontWeight:500}}>Saved as draft</div>
              <div style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>Resume from <span className="text-accent">Pipelines → Drafts</span> or the Create modal</div>
            </div>
            <div style={{flex:1}}/>
            <button className="btn btn-ghost btn-sm">View drafts</button>
          </div>

          <PCDeployBar
            status="Draft saved · all changes persisted"
            mono="3 stages · 2 empty slots"
            actions={<>
              <button className="btn btn-ghost btn-sm">Keep editing</button>
              <button className="btn btn-secondary btn-sm">Close</button>
            </>}
          />
        </div>
        <div style={{width:300, flex:'0 0 300px', background:'#0c0c0f', borderLeft:'1px solid var(--color-gray-dark-700)', padding:16, overflow:'auto'}}>
          <div className="pc-dock-head" style={{padding:0, border:0}}>
            <h3 style={{margin:0, fontFamily:'var(--font-family-title)', fontSize:14, fontWeight:600, color:'var(--color-foreground-neutral)'}}>Draft history</h3>
            <p style={{margin:'3px 0 0', fontSize:11, color:'var(--color-gray-dark-500)'}}>Autosave every 10s · last 20 versions kept</p>
          </div>

          <div style={{marginTop:14, display:'flex', flexDirection:'column', gap:6}}>
            {[
              { t:"just now",   note:"Added filter · High-value orders", cur:true },
              { t:"2m ago",     note:"Added dedup · orders-dedup" },
              { t:"4m ago",     note:"Configured Kafka source" },
              { t:"5m ago",     note:"Created draft" },
            ].map((v,i)=>(
              <div key={i} style={{padding:'10px 12px', background: v.cur?'var(--color-orange-alpha-10)':'#131317', border: v.cur?'1px solid var(--color-orange-alpha-20)':'1px solid var(--color-gray-dark-800)', borderRadius:8}}>
                <div style={{fontSize:10, color:'var(--color-gray-dark-500)', display:'flex', alignItems:'center', gap:6}}>
                  <Icon name="history" size={10}/> {v.t}
                  {v.cur && <span className="chip chip-positive" style={{height:16, fontSize:9, marginLeft:'auto'}}>current</span>}
                </div>
                <div style={{fontSize:12, marginTop:4, color: v.cur?'var(--color-foreground-neutral)':'var(--color-gray-dark-100)'}}>{v.note}</div>
              </div>
            ))}
          </div>

          <div style={{marginTop:20}} className="annot">
            <strong>NOTE</strong> Drafts appear in <em>two</em> places: a "Drafts" filter on the Pipelines list (quick resume) and a "Resume draft" section at the top of the Create modal (discovery for new flow).
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ C11. AI PRE-POPULATES CANVAS ============
const ArtCanvasAI = () => {
  return (
    <div className="pc-stage">
      <PCHeader
        name="Untitled pipeline"
        nameId="draft · AI sketched"
        actions={<>
          <button className="btn btn-secondary btn-sm">Validate</button>
          <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill" style={{borderColor:'rgba(183,148,255,0.3)', color:'#d2b8ff'}}>
              <CIcon name="ai" size={12} color="#b794ff"/> AI draft · review before deploy
            </div>
            <div className="pc-pill"><Icon name="schema" size={12}/> <strong>OrderEvents v4</strong></div>
            <div style={{flex:1}}/>
            <PCZoom level="92%"/>
          </PCToolbar>

          <div className="pc-flow">
            <div className="pc-row">
              <PCNode type="source" saved aiPlaced
                title="kafka-prod-eu"
                sub="orders.placed.v2"
                body={<span className="pc-schema-chip">OrderEvents v4</span>}
              />
              <PCEdge/>
              <PCSlot/>
              <PCEdge/>
              <PCNode type="dedup" aiPlaced
                title="Dedup on order_id"
                sub="5-minute window"
                badge="inline"
              />
              <PCEdge/>
              <PCSlot/>
              <PCEdge/>
              <PCNode type="filter" aiPlaced
                title="EU shipments only"
                sub="shipping_country in EU_LIST"
                badge="inline"
              />
              <PCEdge/>
              <PCSlot/>
              <PCEdge/>
              <PCNode type="transform" aiPlaced
                title="Add revenue_cents"
                sub="+ unit_price_cents × quantity"
                badge="inline"
              />
              <PCEdge/>
              <PCSlot/>
              <PCEdge/>
              <PCNode type="sink" saved aiPlaced
                title="ch-analytics-prod"
                sub="analytics.orders_eu"
              />
            </div>
          </div>

          {/* AI bar */}
          <div className="pc-ai-bar">
            <div className="head">
              <CIcon name="ai" size={12} color="#b794ff"/> AI draft
              <span style={{color:'var(--color-gray-dark-500)', textTransform:'none', letterSpacing:0, fontWeight:400, marginLeft:'auto'}}>3.2s · haiku</span>
            </div>
            <div className="reply">
              Based on <b>"dedupe EU orders and write revenue to ClickHouse"</b>: pinned your <b>kafka-prod-eu</b> source on <span className="mono">orders.placed.v2</span>, added dedup on <span className="mono">order_id</span>, filtered to EU countries, added a derived <span className="mono">revenue_cents</span> field, and routed to a new <span className="mono">analytics.orders_eu</span> table.
              <div style={{marginTop:8, color:'var(--color-gray-dark-500)', fontSize:11.5}}>
                <Icon name="info" size={10}/> Nothing is deployed. Review stages and click Apply to commit to the canvas, or ask for changes below.
              </div>
            </div>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <input className="input" placeholder="Refine… e.g. 'use a 1-minute window' or 'drop revenue calculation'" style={{flex:1}}/>
              <button className="btn btn-ghost btn-sm">Discard</button>
              <button className="btn ai-apply btn-sm"><Icon name="check" size={12}/> Apply to canvas</button>
            </div>
          </div>

          <PCDeployBar
            status="AI-drafted · review stages before deploy"
            mono="5 stages · 3 new"
            actions={<>
              <button className="btn btn-ghost btn-sm">Discard draft</button>
              <button className="btn btn-secondary btn-sm"><CIcon name="save" size={12}/> Save as draft</button>
            </>}
          />
        </div>
        <PCDock items={[
          { label: "AI-suggested additions", rows: [
            { type:"filter", glyph:"filter", name:"Recent only (24h)", sub:"placed_at > now − 24h", compat:true },
            { type:"transform", glyph:"transform", name:"Currency → USD", sub:"normalise price", compat:true },
          ]},
          { label: "Schemas", rows: [
            { type:"schema", glyph:"schema", name:"OrderEvents", sub:"v4 · pinned" },
          ]},
        ]}/>
      </div>
    </div>
  );
};

Object.assign(window, {
  ArtCanvasEmpty, ArtCanvasSlotPicker, ArtCanvasModal,
  ArtCanvasDrag, ArtCanvasDeploy, ArtCanvasDraft, ArtCanvasAI,
});
