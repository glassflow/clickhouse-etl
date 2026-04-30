// Bridge artboards 1-4: edit dialog w/ blast radius, schema versions, pipeline linkage, in-canvas indicator

// ============ B1. CONNECTION EDIT — blast radius ("always live") ============
const ArtBridgeConnEdit = () => {
  return (
    <div className="br-scene">
      <div className="br-scene-inner">
        <div className="br-crumbs">
          <Icon name="library" size={12}/>
          <a>Library</a> <CIcon name="chevR" size={10}/>
          <a>Kafka connections</a> <CIcon name="chevR" size={10}/>
          <span style={{color:'var(--color-foreground-neutral)'}}>kafka-prod-eu</span>
          <span style={{marginLeft:'auto'}}/>
        </div>
        <div className="flex items-center gap-3" style={{marginTop:8}}>
          <h1 className="br-title" style={{margin:0}}>Edit kafka-prod-eu</h1>
          <span className="chip chip-positive"><Icon name="check" size={10}/> reachable</span>
          <BRCountChip n={9}/>
        </div>
        <p className="br-subtitle">
          Connections are <strong style={{color:'var(--color-foreground-neutral)'}}>always live</strong> — there is no version pin. Any change here propagates to every pipeline below on next event.
        </p>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
          <div className="br-card">
            <h4><Icon name="kafka" size={14}/> Connection details</h4>
            <div className="pc-field-grid" style={{gridTemplateColumns:'1fr'}}>
              <div className="pc-field">
                <label>Bootstrap servers</label>
                <input className="input" defaultValue="b-1.kafka.eu.glassflow.xyz:9092,b-2.kafka.eu.glassflow.xyz:9092"/>
                <div className="hint" style={{color:'var(--color-yellow-400)'}}><Icon name="warn" size={10}/> changing hostname rewrites destructive — all 9 pipelines reconnect</div>
              </div>
              <div className="pc-field">
                <label>Auth mechanism</label>
                <input className="input" defaultValue="SASL/SCRAM-SHA-512"/>
              </div>
              <div className="pc-field">
                <label>Username</label>
                <input className="input" defaultValue="glassflow-prod"/>
              </div>
              <div className="pc-field">
                <label>Password</label>
                <input className="input" type="password" defaultValue="••••••••••••"/>
                <div className="hint">Rotating creds is safe — just update here</div>
              </div>
            </div>
          </div>

          <div className="br-card">
            <h4><Icon name="pipelines" size={14}/> Blast radius <span className="chip chip-muted" style={{marginLeft:'auto'}}>9 pipelines · 3 prod</span></h4>
            <BRBlastList
              caption="Pipelines that will be affected on save"
              rows={[
                { name:"prod-orders-to-analytics",      env:"prod",    owner:"commerce-team",  status:"running", effect:"reconnect on next event" },
                { name:"prod-payments-dedup",           env:"prod",    owner:"payments-team",  status:"running", effect:"reconnect on next event" },
                { name:"prod-inventory-sync",           env:"prod",    owner:"commerce-team",  status:"running", effect:"reconnect on next event" },
                { name:"staging-orders-to-analytics",   env:"staging", owner:"commerce-team",  status:"running", effect:"reconnect on next event" },
                { name:"staging-fraud-enrichment",      env:"staging", owner:"risk-team",      status:"paused",  effect:"applied on resume" },
                { name:"dev-orders-debug",              env:"dev",     owner:"vincent.co",     status:"running", effect:"reconnect on next event" },
              ]}
            />
            <div className="annot" style={{marginTop:12}}>
              <strong>NOTE</strong> No pin flag, no version. Blast radius is the whole affordance — users see exactly what will be affected and when, before committing.
            </div>
          </div>
        </div>

        <div className="br-card" style={{marginTop:14, borderColor:'color-mix(in srgb, var(--color-red-500) 30%, var(--color-gray-dark-800))'}}>
          <h4><Icon name="warn" size={14} color="var(--color-red-500)"/> Confirm destructive change <span className="chip chip-warn" style={{marginLeft:'auto'}}>hostname edited</span></h4>
          <p style={{margin:'0 0 12px', fontSize:12, color:'var(--color-gray-250)'}}>
            You're editing the bootstrap servers of a connection used by <strong style={{color:'var(--color-foreground-neutral)'}}>3 production pipelines</strong>. Type the connection name to confirm.
          </p>
          <div className="br-confirm-type">
            <div className="q">Type <span className="mono">kafka-prod-eu</span> to continue:</div>
            <input className="input" placeholder="kafka-prod-eu"/>
          </div>
          <div className="flex gap-2 items-center" style={{marginTop:14}}>
            <button className="btn btn-ghost">Cancel</button>
            <div style={{flex:1}}/>
            <button className="btn btn-secondary">Save for staging + dev only</button>
            <button className="btn btn-primary" disabled>Save and propagate to all 9</button>
          </div>
        </div>

        <div className="annot" style={{marginTop:14}}>
          <strong>OPEN QUESTIONS</strong><br/>
          1. Should we support <em>per-env</em> save (selective propagation)? Shown above as a secondary action — worth validating.<br/>
          2. On rotation-only changes (password), do we still require typed confirm? Probably not — only require it for host/auth mechanism.
        </div>
      </div>
    </div>
  );
};

// ============ B2. SCHEMA VERSIONS — timeline + used-by ============
const ArtBridgeSchemaVersions = () => {
  return (
    <div className="br-scene">
      <div className="br-scene-inner">
        <div className="br-crumbs">
          <Icon name="library" size={12}/>
          <a>Library</a> <CIcon name="chevR" size={10}/>
          <a>Schemas</a> <CIcon name="chevR" size={10}/>
          <span style={{color:'var(--color-foreground-neutral)'}}>OrderEvents</span>
        </div>
        <div className="flex items-center gap-3" style={{marginTop:8}}>
          <h1 className="br-title" style={{margin:0}}>OrderEvents</h1>
          <BRVersionPill v="v5" latest/>
          <BRVersionPill v="v4" current/>
          <BRCountChip n={6}/>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost btn-sm"><Icon name="edit" size={12}/> Edit schema</button>
          <button className="btn btn-secondary btn-sm"><Icon name="pipelines" size={12}/> Roll out v5…</button>
        </div>
        <p className="br-subtitle">
          Schemas are versioned. Editing creates a new version; deployed pipelines stay pinned to their snapshot until upgraded. <strong style={{color:'var(--color-foreground-neutral)'}}>v5</strong> is the latest; <strong style={{color:'var(--color-foreground-neutral)'}}>v4</strong> is what most pipelines are running.
        </p>

        <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:14}}>
          <div className="br-card">
            <h4><Icon name="history" size={14}/> Version history</h4>
            <BRVersionTimeline
              current="v4"
              items={[
                { v:"v5", latest:true, when:"2 hours ago", author:"maya.li",
                  msg:"Added optional discount_code field for promo tracking.",
                  diff:"+ discount_code: string  (optional)",
                  usedBy: 0 },
                { v:"v4", when:"11 days ago", author:"maya.li",
                  msg:"Added tax_cents and discount_cents.",
                  diff:"+ tax_cents: uint64  (optional)\n+ discount_cents: uint64  (optional)",
                  usedBy: 5 },
                { v:"v3", when:"Mar 4", author:"vincent.co",
                  msg:"Widened quantity from uint16 to uint32.",
                  diff:"~ quantity: uint16 → uint32",
                  usedBy: 1 },
                { v:"v2", when:"Feb 11", author:"vincent.co",
                  msg:"Added channel (web, mobile, pos).",
                  diff:"+ channel: string  (required)",
                  usedBy: 0 },
                { v:"v1", when:"Jan 6", author:"maya.li",
                  msg:"Initial schema — 8 fields.",
                  usedBy: 0 },
              ]}
            />
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="br-card">
              <h4><Icon name="drift" size={14}/> v4 → v5 diff</h4>
              <BRSchemaDiff
                before={{
                  v:4,
                  fields:[
                    {name:"order_id", type:"string"},
                    {name:"customer_id", type:"string"},
                    {name:"sku", type:"string"},
                    {name:"quantity", type:"uint32"},
                    {name:"unit_price_cents", type:"uint64"},
                    {name:"tax_cents", type:"uint64"},
                    {name:"discount_cents", type:"uint64"},
                  ]
                }}
                after={{
                  v:5,
                  fields:[
                    {name:"order_id", type:"string"},
                    {name:"customer_id", type:"string"},
                    {name:"sku", type:"string"},
                    {name:"quantity", type:"uint32"},
                    {name:"unit_price_cents", type:"uint64"},
                    {name:"tax_cents", type:"uint64"},
                    {name:"discount_cents", type:"uint64"},
                    {name:"discount_code", type:"string  (opt)", change:"add"},
                  ]
                }}
              />
              <div className="callout info" style={{marginTop:12}}>
                <Icon name="info" size={14}/>
                <div>
                  <strong>Compatible upgrade</strong>
                  Adding an optional field is backwards-compatible. All 5 pipelines on v4 can upgrade without rewriting configs.
                </div>
              </div>
            </div>

            <div className="br-card">
              <h4><Icon name="pipelines" size={14}/> Pinned versions across pipelines</h4>
              <div style={{display:'flex', flexDirection:'column', gap:6}}>
                <div className="flex items-center gap-3" style={{fontSize:11.5, color:'var(--color-gray-dark-500)'}}>
                  <span style={{width:40}}>v5</span>
                  <div style={{flex:1, height:6, background:'#141418', borderRadius:3, overflow:'hidden'}}><div style={{width:'0%', height:'100%', background:'var(--color-green-500)'}}/></div>
                  <span style={{width:30, textAlign:'right'}}>0</span>
                </div>
                <div className="flex items-center gap-3" style={{fontSize:11.5, color:'var(--color-gray-dark-500)'}}>
                  <span style={{width:40}}>v4</span>
                  <div style={{flex:1, height:6, background:'#141418', borderRadius:3, overflow:'hidden'}}><div style={{width:'83%', height:'100%', background:'var(--color-orange-300)'}}/></div>
                  <span style={{width:30, textAlign:'right'}}>5</span>
                </div>
                <div className="flex items-center gap-3" style={{fontSize:11.5, color:'var(--color-gray-dark-500)'}}>
                  <span style={{width:40}}>v3</span>
                  <div style={{flex:1, height:6, background:'#141418', borderRadius:3, overflow:'hidden'}}><div style={{width:'17%', height:'100%', background:'var(--color-gray-dark-500)'}}/></div>
                  <span style={{width:30, textAlign:'right'}}>1</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="br-card" style={{marginTop:14}}>
          <h4><Icon name="pipelines" size={14}/> Used by 6 pipelines</h4>
          <BRUsedByTable rows={[
            { name:"prod-orders-to-analytics",   env:"prod",    owner:"commerce-team",   pinned:"v4", latest:"v5", drift:true,  status:"running" },
            { name:"prod-orders-eu-analytics",   env:"prod",    owner:"commerce-team",   pinned:"v4", latest:"v5", drift:true,  status:"running" },
            { name:"prod-payments-dedup",        env:"prod",    owner:"payments-team",   pinned:"v4", latest:"v5", drift:true,  status:"running" },
            { name:"staging-orders-to-analytics",env:"staging", owner:"commerce-team",   pinned:"v4", latest:"v5", drift:true,  status:"running" },
            { name:"staging-fraud-enrichment",   env:"staging", owner:"risk-team",       pinned:"v4", latest:"v5", drift:true,  status:"paused"  },
            { name:"dev-orders-debug-vincent",   env:"dev",     owner:"vincent.co",      pinned:"v3", latest:"v5", drift:true,  status:"running" },
          ]}/>
          <div className="annot" style={{marginTop:12}}>
            <strong>NOTE</strong> "Upgrade…" on each row opens the per-pipeline upgrade flow (artboard B5). The "Roll out v5…" button in the header opens bulk rollout (B6).
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ B3. PIPELINE DETAIL — Library linkage panel ============
const ArtBridgePipelineDetail = () => {
  return (
    <div className="br-scene">
      <div className="br-scene-inner">
        <div className="br-crumbs">
          <Icon name="pipelines" size={12}/>
          <a>Pipelines</a> <CIcon name="chevR" size={10}/>
          <span style={{color:'var(--color-foreground-neutral)'}}>prod-orders-to-analytics</span>
        </div>
        <div className="flex items-center gap-3" style={{marginTop:8}}>
          <span className="br-pip-dot br-pip-running"/>
          <h1 className="br-title" style={{margin:0}}>prod-orders-to-analytics</h1>
          <span className="chip chip-warn">prod</span>
          <span className="mono" style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>prod-orders-analytics-h8z9a</span>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost btn-sm"><Icon name="stop" size={12}/> Pause</button>
          <button className="btn btn-secondary btn-sm"><Icon name="edit" size={12}/> Open in canvas</button>
        </div>

        {/* Row of tabs */}
        <div style={{display:'flex', gap:0, borderBottom:'1px solid var(--color-gray-dark-800)', margin:'18px 0 20px'}}>
          {["Overview","Canvas","Library links","Metrics","Logs","Settings"].map((t,i)=>(
            <div key={i} style={{
              padding:'10px 16px',
              fontSize:12,
              cursor:'pointer',
              color: t==="Library links" ? 'var(--color-foreground-neutral)' : 'var(--color-gray-dark-500)',
              fontWeight: t==="Library links" ? 600 : 400,
              borderBottom: t==="Library links" ? '2px solid var(--color-orange-300)' : '2px solid transparent',
              marginBottom:'-1px'
            }}>{t}</div>
          ))}
        </div>

        <div className="br-card" style={{marginBottom:14, borderColor:'color-mix(in srgb, var(--color-yellow-400) 35%, var(--color-gray-dark-800))'}}>
          <h4><Icon name="warn" size={14} color="var(--color-yellow-400)"/> 2 Library updates available for this pipeline
            <div style={{flex:1}}/>
            <button className="btn btn-secondary btn-sm">Review &amp; upgrade…</button>
          </h4>
          <div style={{fontSize:12.5, color:'var(--color-gray-250)', lineHeight:1.55}}>
            <span className="mono" style={{color:'var(--color-foreground-neutral)'}}>OrderEvents</span> has a newer version (v5, compatible) and <span className="mono" style={{color:'var(--color-foreground-neutral)'}}>orders-dedup</span> has a newer config (v2, window changed 5m → 10m).
            Neither has been applied — this pipeline is still running v4 / v1.
          </div>
        </div>

        <div className="br-card">
          <h4><Icon name="link" size={14}/> Library links
            <span className="chip chip-muted" style={{marginLeft:'auto'}}>5 links · 3 live · 2 pinned</span>
          </h4>

          <div className="br-linkage">
            <div className="icon-badge"><Icon name="kafka" size={14}/></div>
            <div className="lk-main">
              <div className="lk-name">kafka-prod-eu <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontWeight:400}}>· source connection</span></div>
              <div className="lk-meta">b-1.kafka.eu.glassflow.xyz:9092 · SASL/SCRAM</div>
            </div>
            <span className="lk-mode"><span className="dot live"/> always live</span>
            <button className="btn btn-ghost btn-sm">Open in library</button>
          </div>

          <div className="br-linkage">
            <div className="icon-badge"><Icon name="schema" size={14}/></div>
            <div className="lk-main">
              <div className="lk-name">OrderEvents <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontWeight:400}}>· schema</span></div>
              <div className="lk-meta">10 fields · pinned on deploy</div>
            </div>
            <span className="lk-mode"><span className="dot pinned"/> pinned</span>
            <div className="flex items-center gap-2">
              <BRVersionPill v="v4" current/>
              <span className="mono" style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>→</span>
              <BRVersionPill v="v5" latest/>
              <button className="btn btn-secondary btn-sm">Upgrade</button>
            </div>
          </div>

          <div className="br-linkage">
            <div className="icon-badge gray"><Icon name="dedup" size={14}/></div>
            <div className="lk-main">
              <div className="lk-name">orders-dedup <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontWeight:400}}>· dedup config</span></div>
              <div className="lk-meta">order_id · 5m window · pinned on deploy</div>
            </div>
            <span className="lk-mode"><span className="dot pinned"/> pinned</span>
            <div className="flex items-center gap-2">
              <BRVersionPill v="v1" current/>
              <span className="mono" style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>→</span>
              <BRVersionPill v="v2" latest/>
              <button className="btn btn-secondary btn-sm">Upgrade</button>
            </div>
          </div>

          <div className="br-linkage">
            <div className="icon-badge gray"><Icon name="filter" size={14}/></div>
            <div className="lk-main">
              <div className="lk-name">High-value orders <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontWeight:400}}>· inline filter</span></div>
              <div className="lk-meta">price × qty ≥ 5000 · not saved to library</div>
            </div>
            <span className="lk-mode" style={{color:'var(--color-gray-dark-500)'}}>inline only</span>
            <button className="btn btn-ghost btn-sm">Save to library…</button>
          </div>

          <div className="br-linkage">
            <div className="icon-badge blue"><Icon name="ch" size={14}/></div>
            <div className="lk-main">
              <div className="lk-name">ch-analytics-prod <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontWeight:400}}>· sink connection</span></div>
              <div className="lk-meta">analytics.orders · append mode</div>
            </div>
            <span className="lk-mode"><span className="dot live"/> always live</span>
            <button className="btn btn-ghost btn-sm">Open in library</button>
          </div>
        </div>

        <div className="annot" style={{marginTop:14}}>
          <strong>NOTE</strong> Library links is a first-class tab on every pipeline, not buried under Settings. It's the counterpart to Library's "used by" list — from here a user answers "what is this pipeline made of, and is any piece out of date?"
        </div>
      </div>
    </div>
  );
};

// ============ B4. IN-CANVAS "update available" indicator ============
const ArtBridgeCanvasIndicator = () => {
  return (
    <div className="pc-stage">
      <PCHeader
        name="prod-orders-to-analytics"
        nameId="deployed · v4 · library updates detected"
        actions={<>
          <button className="btn btn-ghost btn-sm"><Icon name="stop" size={12}/> Pause</button>
          <button className="btn btn-secondary btn-sm">Review upgrades…</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill"><Icon name="schema" size={12}/> <strong>OrderEvents</strong>
              <span className="br-pinned-badge is-drift" style={{marginLeft:6}}>
                <Icon name="warn" size={9}/> v4 · v5 available
              </span>
            </div>
            <div style={{flex:1}}/>
            <PCZoom level="100%"/>
          </PCToolbar>

          <div className="pc-flow" style={{flexDirection:'column', gap:20, paddingTop:70}}>
            {/* Banner */}
            <div className="br-canvas-banner" style={{maxWidth:880}}>
              <div className="icon"><Icon name="warn" size={14}/></div>
              <div style={{flex:1}}>
                <div><strong>2 library components have newer versions.</strong> This pipeline is still running pinned snapshots.</div>
                <div style={{fontSize:11, color:'var(--color-gray-dark-500)', marginTop:2}}>
                  <span className="mono">OrderEvents v4 → v5</span> (compatible) · <span className="mono">orders-dedup v1 → v2</span> (compatible)
                </div>
              </div>
              <button className="btn btn-ghost btn-sm">Dismiss</button>
              <button className="btn btn-secondary btn-sm">Review upgrades</button>
            </div>

            <div className="pc-row">
              <PCNode type="source" saved
                title="kafka-prod-eu"
                sub="orders.placed.v2"
                body={<>
                  <span className="pc-schema-chip">OrderEvents</span>
                  <span className="br-pinned-badge is-drift" style={{marginLeft:4}}>v4 · v5 avail</span>
                </>}
                warn
              />
              <PCEdge/>
              <PCNode type="dedup" saved
                title="orders-dedup"
                sub="order_id · 5m"
                body={<span className="br-pinned-badge is-drift">v1 · v2 avail</span>}
                warn
              />
              <PCEdge/>
              <PCNode type="filter"
                title="High-value orders"
                sub="price × qty ≥ 5000"
                badge="inline"
              />
              <PCEdge/>
              <PCNode type="sink" saved
                title="ch-analytics-prod"
                sub="analytics.orders"
                body={<span className="br-pinned-badge" style={{borderColor:'color-mix(in srgb, var(--color-green-500) 30%, var(--color-gray-dark-800))', color:'var(--color-green-500)'}}>
                  <span style={{width:5, height:5, borderRadius:999, background:'var(--color-green-500)', display:'inline-block'}}/> live
                </span>}
              />
            </div>
          </div>

          <div style={{position:'absolute', left:24, bottom:80, maxWidth:360}}>
            <div className="annot">
              <strong>NOTE</strong> Pinned nodes show a <em>small version badge</em>; drift appears as a yellow "v4 · v5 avail" chip. Live connections show a green "live" chip. Banner sits at the top with one-click access to the upgrade flow. Dismiss hides the banner but node-level chips persist — drift is never silent.
            </div>
          </div>

          <PCDeployBar
            status="Running · 2 library updates available"
            mono="last deploy 11 days ago · revision 8"
            actions={<>
              <button className="btn btn-ghost btn-sm">Diff from latest</button>
              <button className="btn btn-primary btn-sm">Review upgrades</button>
            </>}
          />
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  ArtBridgeConnEdit, ArtBridgeSchemaVersions,
  ArtBridgePipelineDetail, ArtBridgeCanvasIndicator,
});
