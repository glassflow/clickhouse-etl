// Bridge artboards 5-7: per-pipeline upgrade, bulk rollout, pipelines-list drift overview

// ============ B5. PER-PIPELINE UPGRADE FLOW (modal) ============
const ArtBridgeUpgrade = () => {
  return (
    <div className="br-scene">
      <div className="br-scene-inner" style={{opacity:0.35, filter:'blur(1px)', pointerEvents:'none'}}>
        <div className="br-crumbs">
          <Icon name="pipelines" size={12}/>
          <a>Pipelines</a> <CIcon name="chevR" size={10}/>
          <span>prod-orders-to-analytics</span>
        </div>
        <h1 className="br-title">prod-orders-to-analytics</h1>
        <p className="br-subtitle">Library links · review &amp; upgrade</p>
      </div>

      {/* Modal */}
      <div style={{
        position:'absolute', inset:0, display:'grid', placeItems:'center',
        background: 'color-mix(in srgb, #05050a 70%, transparent)', backdropFilter:'blur(4px)', zIndex:20
      }}>
        <div style={{
          width: 980, maxHeight:'calc(100% - 60px)',
          background:'#0c0c10', border:'1px solid var(--color-gray-dark-700)', borderRadius:14, overflow:'hidden',
          boxShadow:'0 30px 80px rgba(0,0,0,0.6)'
        }}>
          <div style={{padding:'18px 22px', borderBottom:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:12}}>
            <div style={{width:32, height:32, borderRadius:8, background:'var(--color-orange-alpha-10)', border:'1px solid var(--color-orange-alpha-20)', display:'grid', placeItems:'center', color:'var(--color-orange-300)'}}>
              <Icon name="drift" size={16}/>
            </div>
            <div>
              <h2 style={{margin:0, fontFamily:'var(--font-family-title)', fontSize:16, fontWeight:600, color:'var(--color-foreground-neutral)'}}>Upgrade library components</h2>
              <p style={{margin:'2px 0 0', fontSize:11.5, color:'var(--color-gray-dark-500)'}}>
                <span className="mono">prod-orders-to-analytics</span> · 2 upgrades available · pipeline will restart
              </p>
            </div>
            <div style={{flex:1}}/>
            <button style={{background:'transparent', border:0, color:'var(--color-gray-dark-500)', cursor:'pointer', padding:8}}><Icon name="x" size={14}/></button>
          </div>

          <div style={{padding:'22px', display:'flex', flexDirection:'column', gap:18, maxHeight:'70vh', overflowY:'auto'}}>
            {/* Summary */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
              <div className="br-card" style={{margin:0}}>
                <h4><Icon name="schema" size={14}/> OrderEvents <BRVersionPill v="v4" current/> <span className="mono" style={{color:'var(--color-gray-dark-500)'}}>→</span> <BRVersionPill v="v5" latest/> <span className="chip chip-positive" style={{marginLeft:'auto'}}>compatible</span></h4>
                <BRSchemaDiff
                  before={{v:4, fields:[{name:"…existing fields", type:"(10)"}]}}
                  after={{v:5, fields:[
                    {name:"…existing fields", type:"(10)"},
                    {name:"discount_code", type:"string  (opt)", change:"add"},
                  ]}}
                />
                <div style={{fontSize:11.5, color:'var(--color-gray-250)', marginTop:8}}>
                  Downstream filter <span className="mono">High-value orders</span> does not reference <span className="mono">discount_code</span> — no config changes needed.
                </div>
              </div>

              <div className="br-card" style={{margin:0}}>
                <h4><Icon name="dedup" size={14}/> orders-dedup <BRVersionPill v="v1" current/> <span className="mono" style={{color:'var(--color-gray-dark-500)'}}>→</span> <BRVersionPill v="v2" latest/> <span className="chip chip-warn" style={{marginLeft:'auto'}}>behavior change</span></h4>
                <div className="br-diff" style={{marginTop:0}}>
                  <div className="br-diff-head">dedup config diff</div>
                  <div className="br-diff-cols">
                    <div className="br-diff-col">
                      <div className="br-diff-col-label">v1 · current</div>
                      <div className="br-diff-line"><span className="mono">key</span><span className="mono dim">order_id</span></div>
                      <div className="br-diff-line type"><span className="mono">window</span><span className="mono dim">5m</span></div>
                      <div className="br-diff-line"><span className="mono">strategy</span><span className="mono dim">first</span></div>
                    </div>
                    <div className="br-diff-col">
                      <div className="br-diff-col-label">v2 · latest</div>
                      <div className="br-diff-line"><span className="mono">key</span><span className="mono dim">order_id</span></div>
                      <div className="br-diff-line type"><span className="mono">window</span><span className="mono dim">10m</span> <span className="chip chip-warn">changed</span></div>
                      <div className="br-diff-line"><span className="mono">strategy</span><span className="mono dim">first</span></div>
                    </div>
                  </div>
                </div>
                <div className="callout warn" style={{marginTop:8}}>
                  <Icon name="warn" size={14}/>
                  <div>
                    <strong>Window widened 5m → 10m</strong>
                    Late-arriving duplicates up to 10 min old will now be dropped. Low risk for <span className="mono">order_id</span> but verify if downstream relies on 5m.
                  </div>
                </div>
              </div>
            </div>

            {/* Upgrade plan */}
            <div>
              <h4 style={{margin:'0 0 10px', fontFamily:'var(--font-family-title)', fontSize:13, fontWeight:600, color:'var(--color-foreground-neutral)'}}>
                Upgrade plan
              </h4>
              <div className="br-upgrade-plan">
                <div className="br-upgrade-step">
                  <div className="num">1</div>
                  <div className="desc">
                    <strong>Pause pipeline at safe commit point</strong>
                    <small>drain in-flight events · ~3 seconds</small>
                  </div>
                  <span className="chip chip-muted">auto</span>
                </div>
                <div className="br-upgrade-step">
                  <div className="num">2</div>
                  <div className="desc">
                    <strong>Pin OrderEvents v5</strong>
                    <small>re-derive column mappings · no schema migration on ClickHouse needed</small>
                  </div>
                  <span className="chip chip-muted">auto</span>
                </div>
                <div className="br-upgrade-step">
                  <div className="num">3</div>
                  <div className="desc">
                    <strong>Pin orders-dedup v2</strong>
                    <small>reset dedup window state · first 10m will not dedup</small>
                  </div>
                  <span className="chip chip-warn">stateful</span>
                </div>
                <div className="br-upgrade-step">
                  <div className="num">4</div>
                  <div className="desc">
                    <strong>Resume from last offset</strong>
                    <small>consumer group: glassflow-prod-orders-analytics · offset preserved</small>
                  </div>
                  <span className="chip chip-muted">auto</span>
                </div>
              </div>
            </div>

            <div className="callout info">
              <Icon name="info" size={14}/>
              <div>
                <strong>Rollback is one click.</strong>
                We keep the previous pin (<span className="mono">OrderEvents v4 · orders-dedup v1</span>) available for 7 days. If this upgrade misbehaves you can roll back from the pipeline's Library links tab.
              </div>
            </div>
          </div>

          <div style={{padding:'14px 22px', borderTop:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:10}}>
            <div style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>
              <Icon name="warn" size={10} color="var(--color-yellow-400)"/> Upgrading 1 pipeline · est. ~20s downtime
            </div>
            <div style={{flex:1}}/>
            <button className="btn btn-ghost">Cancel</button>
            <button className="btn btn-secondary">Only upgrade OrderEvents</button>
            <button className="btn btn-primary"><CIcon name="rocket" size={12}/> Apply both upgrades</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ B6. BULK ROLLOUT (from Library schema detail) ============
const ArtBridgeBulkRollout = () => {
  return (
    <div className="br-scene">
      <div className="br-scene-inner">
        <div className="br-crumbs">
          <Icon name="library" size={12}/>
          <a>Library</a> <CIcon name="chevR" size={10}/>
          <a>Schemas</a> <CIcon name="chevR" size={10}/>
          <a>OrderEvents</a> <CIcon name="chevR" size={10}/>
          <span style={{color:'var(--color-foreground-neutral)'}}>Roll out v5</span>
        </div>
        <div className="flex items-center gap-3" style={{marginTop:8}}>
          <h1 className="br-title" style={{margin:0}}>Roll out OrderEvents v5</h1>
          <BRVersionPill v="v5" latest/>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost btn-sm">Cancel</button>
          <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Start rollout</button>
        </div>
        <p className="br-subtitle">
          Upgrade the pinned version on multiple pipelines at once. Choose a strategy, select pipelines, review impact.
        </p>

        {/* Strategy */}
        <div className="br-card">
          <h4><Icon name="drift" size={14}/> Rollout strategy</h4>
          <div className="br-rollout-grid">
            <div className="br-rollout-card">
              <h5><Icon name="play" size={12}/> All at once</h5>
              <p>Apply to every selected pipeline in parallel. Fast, but coordinated downtime.</p>
              <div className="eg">est. 20s total · all pause together</div>
            </div>
            <div className="br-rollout-card is-selected">
              <h5><Icon name="history" size={12}/> Staged · dev → staging → prod</h5>
              <p>Roll through environments in order. Auto-pause between stages so you can verify metrics.</p>
              <div className="eg">est. 90s + verification windows</div>
            </div>
            <div className="br-rollout-card">
              <h5><Icon name="check" size={12}/> One by one</h5>
              <p>Manual confirmation per pipeline. Safest, slowest — for high-stakes rollouts.</p>
              <div className="eg">manual pacing · you control each</div>
            </div>
          </div>
        </div>

        {/* Selection */}
        <div className="br-card">
          <h4><Icon name="pipelines" size={14}/> Pipelines in scope
            <span className="chip chip-muted" style={{marginLeft:'auto'}}>5 selected · 1 excluded</span>
          </h4>

          <div style={{fontSize:11, color:'var(--color-gray-dark-500)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600}}>Stage 1 · dev</div>
          <div style={{display:'flex', flexDirection:'column', gap:6, marginBottom:14}}>
            <div className="br-link-row">
              <input type="checkbox" defaultChecked/>
              <span className="br-pip-dot br-pip-running"/>
              <div className="br-link-main">
                <div className="br-link-name">dev-orders-debug-vincent</div>
                <div className="br-link-meta">owner: vincent.co · currently pinned: v3</div>
              </div>
              <span className="chip chip-muted">dev</span>
              <BRVersionPill v="v3" current/>
              <span className="mono" style={{color:'var(--color-gray-dark-500)'}}>→</span>
              <BRVersionPill v="v5" latest/>
            </div>
          </div>

          <div style={{fontSize:11, color:'var(--color-gray-dark-500)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600}}>Stage 2 · staging</div>
          <div style={{display:'flex', flexDirection:'column', gap:6, marginBottom:14}}>
            <div className="br-link-row">
              <input type="checkbox" defaultChecked/>
              <span className="br-pip-dot br-pip-running"/>
              <div className="br-link-main">
                <div className="br-link-name">staging-orders-to-analytics</div>
                <div className="br-link-meta">owner: commerce-team · currently pinned: v4</div>
              </div>
              <span className="chip chip-muted">staging</span>
              <BRVersionPill v="v4" current/>
              <span className="mono" style={{color:'var(--color-gray-dark-500)'}}>→</span>
              <BRVersionPill v="v5" latest/>
            </div>
            <div className="br-link-row is-drift">
              <input type="checkbox"/>
              <span className="br-pip-dot br-pip-paused"/>
              <div className="br-link-main">
                <div className="br-link-name">staging-fraud-enrichment</div>
                <div className="br-link-meta">owner: risk-team · paused for 4 days · excluded by default</div>
              </div>
              <span className="chip chip-muted">staging</span>
              <span className="chip chip-warn">paused</span>
            </div>
          </div>

          <div style={{fontSize:11, color:'var(--color-gray-dark-500)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600}}>Stage 3 · prod</div>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            <div className="br-link-row">
              <input type="checkbox" defaultChecked/>
              <span className="br-pip-dot br-pip-running"/>
              <div className="br-link-main">
                <div className="br-link-name">prod-orders-to-analytics</div>
                <div className="br-link-meta">owner: commerce-team · 2.4k events/sec · currently pinned: v4</div>
              </div>
              <span className="chip chip-warn">prod</span>
              <BRVersionPill v="v4" current/>
              <span className="mono" style={{color:'var(--color-gray-dark-500)'}}>→</span>
              <BRVersionPill v="v5" latest/>
            </div>
            <div className="br-link-row">
              <input type="checkbox" defaultChecked/>
              <span className="br-pip-dot br-pip-running"/>
              <div className="br-link-main">
                <div className="br-link-name">prod-orders-eu-analytics</div>
                <div className="br-link-meta">owner: commerce-team · 900 events/sec · currently pinned: v4</div>
              </div>
              <span className="chip chip-warn">prod</span>
              <BRVersionPill v="v4" current/>
              <span className="mono" style={{color:'var(--color-gray-dark-500)'}}>→</span>
              <BRVersionPill v="v5" latest/>
            </div>
            <div className="br-link-row">
              <input type="checkbox" defaultChecked/>
              <span className="br-pip-dot br-pip-running"/>
              <div className="br-link-main">
                <div className="br-link-name">prod-payments-dedup</div>
                <div className="br-link-meta">owner: payments-team · 4.1k events/sec · currently pinned: v4</div>
              </div>
              <span className="chip chip-warn">prod</span>
              <BRVersionPill v="v4" current/>
              <span className="mono" style={{color:'var(--color-gray-dark-500)'}}>→</span>
              <BRVersionPill v="v5" latest/>
            </div>
          </div>
        </div>

        {/* Verification gates */}
        <div className="br-card">
          <h4><Icon name="check" size={14}/> Verification gates between stages</h4>
          <div style={{display:'flex', flexDirection:'column', gap:10, fontSize:12.5, color:'var(--color-gray-250)'}}>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked/> Auto-proceed if error rate stays below <span className="mono" style={{color:'var(--color-foreground-neutral)'}}>0.1%</span> for 2 minutes</label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked/> Auto-proceed if throughput stays within ±15% of baseline</label>
            <label className="flex items-center gap-2"><input type="checkbox"/> Require manual approval before advancing to prod</label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked/> Auto-rollback all upgraded pipelines if any prod pipeline fails verification</label>
          </div>
        </div>

        <div className="annot" style={{marginTop:14}}>
          <strong>NOTE</strong> Bulk rollout is intentionally heavier than per-pipeline upgrade — staged env rollout + verification gates + rollback. This is the "platform team" tool; per-pipeline upgrade is the "product team" tool.
        </div>
      </div>
    </div>
  );
};

// ============ B7. PIPELINES LIST — drift overview ============
const ArtBridgeDriftOverview = () => {
  return (
    <div className="br-scene">
      <div className="br-scene-inner">
        <div className="flex items-center gap-3">
          <h1 className="br-title" style={{margin:0}}>Pipelines</h1>
          <span className="chip chip-muted">24 total</span>
          <span className="chip chip-positive"><Icon name="check" size={10}/> 18 up to date</span>
          <span className="chip chip-warn"><Icon name="warn" size={10}/> 6 with drift</span>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost btn-sm">Filter</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" size={12}/> Create pipeline</button>
        </div>

        {/* Tabs */}
        <div style={{display:'flex', gap:0, borderBottom:'1px solid var(--color-gray-dark-800)', margin:'18px 0 14px'}}>
          {[
            ["All","24"],
            ["Running","19"],
            ["Paused","3"],
            ["Drafts","2"],
            ["Drift","6"],
          ].map(([t,c],i)=>(
            <div key={i} style={{
              padding:'10px 14px',
              fontSize:12,
              cursor:'pointer',
              color: t==="Drift" ? 'var(--color-yellow-400)' : (t==="All" ? 'var(--color-foreground-neutral)' : 'var(--color-gray-dark-500)'),
              fontWeight: t==="All" ? 600 : 400,
              borderBottom: t==="All" ? '2px solid var(--color-orange-300)' : '2px solid transparent',
              marginBottom:'-1px',
              display:'flex', alignItems:'center', gap:6
            }}>
              {t==="Drift" && <Icon name="warn" size={10}/>}
              {t} <span style={{fontSize:10, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>{c}</span>
            </div>
          ))}
        </div>

        {/* Drift banner */}
        <div className="br-canvas-banner" style={{marginBottom:14}}>
          <div className="icon"><Icon name="drift" size={14}/></div>
          <div style={{flex:1}}>
            <div><strong>6 pipelines have library updates available.</strong> Group by library item to review the blast radius and roll out in one go.</div>
          </div>
          <button className="btn btn-ghost btn-sm">Group by library item</button>
          <button className="btn btn-secondary btn-sm">Review all drift</button>
        </div>

        {/* Group by library item */}
        <div className="br-card">
          <h4><Icon name="schema" size={14}/> OrderEvents <BRVersionPill v="v5" latest/>
            <span style={{flex:1}}/>
            <span className="chip chip-muted">5 pipelines on v4 · 1 on v3</span>
            <button className="btn btn-secondary btn-sm" style={{marginLeft:8}}><CIcon name="rocket" size={11}/> Roll out v5…</button>
          </h4>
          <BRUsedByTable rows={[
            { name:"prod-orders-to-analytics",    env:"prod",    owner:"commerce-team", pinned:"v4", latest:"v5", drift:true, status:"running" },
            { name:"prod-orders-eu-analytics",    env:"prod",    owner:"commerce-team", pinned:"v4", latest:"v5", drift:true, status:"running" },
            { name:"prod-payments-dedup",         env:"prod",    owner:"payments-team", pinned:"v4", latest:"v5", drift:true, status:"running" },
            { name:"staging-orders-to-analytics", env:"staging", owner:"commerce-team", pinned:"v4", latest:"v5", drift:true, status:"running" },
            { name:"staging-fraud-enrichment",    env:"staging", owner:"risk-team",     pinned:"v4", latest:"v5", drift:true, status:"paused"  },
            { name:"dev-orders-debug-vincent",    env:"dev",     owner:"vincent.co",    pinned:"v3", latest:"v5", drift:true, status:"running" },
          ]}/>
        </div>

        <div className="br-card">
          <h4><Icon name="dedup" size={14}/> orders-dedup <BRVersionPill v="v2" latest/>
            <span style={{flex:1}}/>
            <span className="chip chip-muted">2 pipelines on v1</span>
            <button className="btn btn-secondary btn-sm" style={{marginLeft:8}}><CIcon name="rocket" size={11}/> Roll out v2…</button>
          </h4>
          <BRUsedByTable rows={[
            { name:"prod-orders-to-analytics",    env:"prod",    owner:"commerce-team", pinned:"v1", latest:"v2", drift:true, driftBreaking:false, status:"running" },
            { name:"prod-orders-eu-analytics",    env:"prod",    owner:"commerce-team", pinned:"v1", latest:"v2", drift:true, driftBreaking:false, status:"running" },
          ]}/>
        </div>

        <div className="annot" style={{marginTop:14}}>
          <strong>NOTE</strong> The Drift tab is grouped by <em>library item</em>, not by pipeline. This answers the org-level question ("what rolled-out changes haven't landed yet?") in a way the per-pipeline view can't. Per-pipeline drift surfaces elsewhere (B3, B4).
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  ArtBridgeUpgrade, ArtBridgeBulkRollout, ArtBridgeDriftOverview,
});
