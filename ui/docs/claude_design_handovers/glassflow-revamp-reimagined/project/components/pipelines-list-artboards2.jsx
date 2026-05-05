// Pipeline list refresh (T-21) — artboards 4-5
// 4: saved-view editor + bulk-action bar (multi-select)
// 5: empty state (first-run)

// =====================================================================
// ARTBOARD 4 · Saved-view editor + bulk-action bar
// =====================================================================

const ArtPLBulk = () => {
  const selectedIds = ['p4','p5','p6','p7','p9','p13'];
  return (
    <div className="pl-page" style={{position:'relative'}}>
      <AppShell activeNav="pipelines">
        <div className="pl-inner" style={{paddingRight:380+28}}>
          <PLTitleRow title="Pipelines" count="142" right={<>
            <button className="btn btn-secondary" style={{fontSize:12}}>Import</button>
            <button className="btn btn-primary" style={{fontSize:12}}>Create pipeline</button>
          </>}/>
          <PLViews active="all"/>
          <PLToolbar
            search='owner:jin@'
            filters={[
              { k:'Owner:', v:'jin@glassflow.dev', on:true },
              { k:'Status:', v:'running', on:true },
            ]}
            density="table"
          />

          <div className="pl-table-wrap">
            <table className="pl-table">
              <PLTableHead sort="status"/>
              <tbody>
                {PIPELINE_DATA.slice(0, 13).map(p => (
                  <PLRow key={p.id} p={p} selected={selectedIds.includes(p.id)}/>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bulk-action bar */}
          <div className="pl-bulkbar">
            <span className="ct">6 selected<span className="of">of 13 visible · 142 total</span></span>
            <span style={{fontSize:11.5, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>
              all owned by <span style={{color:'var(--color-foreground-neutral)'}}>jin@glassflow.dev</span>
            </span>
            <div className="actions">
              <button className="btn btn-secondary" style={{fontSize:11.5, padding:'6px 10px'}}>
                <Icon name="pause" size={11}/>Pause
              </button>
              <button className="btn btn-secondary" style={{fontSize:11.5, padding:'6px 10px'}}>
                <Icon name="tag" size={11}/>Add tag
              </button>
              <button className="btn btn-secondary" style={{fontSize:11.5, padding:'6px 10px'}}>
                <Icon name="user" size={11}/>Reassign owner
              </button>
              <button className="btn btn-secondary" style={{fontSize:11.5, padding:'6px 10px'}}>
                <Icon name="dlq" size={11}/>Drain DLQ
              </button>
              <button className="btn btn-secondary" style={{fontSize:11.5, padding:'6px 10px', borderColor:'color-mix(in srgb, var(--color-red-500) 30%, transparent)', color:'var(--color-red-500)'}}>
                <Icon name="trash" size={11}/>Delete…
              </button>
              <span style={{width:1, alignSelf:'stretch', background:'var(--color-gray-dark-800)', margin:'0 4px'}}/>
              <button className="btn btn-primary" style={{fontSize:11.5, padding:'6px 12px'}}>
                <Icon name="bookmark" size={11}/>Save as view
              </button>
            </div>
          </div>

          <Annot>
            T-21 bulk-action mode. The bulk bar shows what's homogeneous about the selection
            ("all owned by jin@") so destructive actions surface their blast radius. "Save as view"
            is the bridge to the drawer on the right.
          </Annot>
        </div>

        {/* Saved-view editor drawer */}
        <div className="pl-drawer">
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <Icon name="bookmark" size={14} color="var(--color-orange-300)"/>
            <h3 style={{flex:1}}>Save as view</h3>
            <span style={{color:'var(--color-gray-dark-500)', cursor:'pointer'}}>×</span>
          </div>
          <div className="sub">Pin this filter combination to your saved-views strip. Optionally share it with a team — they'll see it under their team header.</div>

          <div className="pl-field">
            <label>Name</label>
            <div className="input">platform · running · jin's pipelines</div>
          </div>

          <div className="pl-field">
            <label>Filters captured</label>
            <div className="preview-chips">
              <span className="pl-filter is-on">Owner:<span className="v">jin@</span></span>
              <span className="pl-filter is-on">Status:<span className="v">running</span></span>
              <span className="pl-filter">Sort:<span className="v">status ↓</span></span>
            </div>
          </div>

          <div className="pl-field">
            <label>Visibility</label>
            <div className="vis-row on">
              <Icon name="user" size={11} color="var(--color-orange-300)"/>
              <span className="lbl">Just me (private)</span>
              <span className="toggle"/>
            </div>
            <div className="vis-row">
              <Icon name="users" size={11} color="var(--color-gray-dark-500)"/>
              <span className="lbl">Share with <strong style={{color:'var(--color-foreground-neutral)'}}>team:platform</strong></span>
              <span className="toggle"/>
            </div>
            <div className="vis-row">
              <Icon name="building" size={11} color="var(--color-gray-dark-500)"/>
              <span className="lbl">Workspace-wide</span>
              <span className="toggle"/>
            </div>
          </div>

          <div className="pl-field">
            <label>Default for me</label>
            <div className="vis-row">
              <span className="lbl" style={{color:'var(--color-gray-dark-100)'}}>Open Pipelines on this view</span>
              <span className="toggle"/>
            </div>
          </div>

          <div className="pl-drawer-foot">
            <button className="btn btn-secondary" style={{fontSize:12, flex:1}}>Cancel</button>
            <button className="btn btn-primary" style={{fontSize:12, flex:2}}>
              <Icon name="bookmark" size={11}/>Save view
            </button>
          </div>
        </div>
      </AppShell>
    </div>
  );
};

// =====================================================================
// ARTBOARD 5 · Empty state (first-run)
// =====================================================================

const ArtPLEmpty = () => (
  <div className="pl-page">
    <AppShell activeNav="pipelines">
      <div className="pl-inner">
        <PLTitleRow title="Pipelines" count="0" right={<>
          <button className="btn btn-secondary" style={{fontSize:12}}>Import</button>
          <button className="btn btn-primary" style={{fontSize:12}}><Icon name="plus" size={12}/>Create pipeline</button>
        </>}/>

        <div style={{marginTop:24}}>
          <div className="pl-empty">
            <div className="glyph-stack">
              <div className="ic i1"><span className="glyph-mini gm-ingest" style={{width:26, height:26, fontSize:14, borderRadius:6, display:'grid', placeItems:'center', background:'rgba(0,140,255,0.12)', color:'var(--color-blue-500)', fontWeight:700, fontFamily:'JetBrains Mono, monospace'}}>I</span></div>
              <div className="ic c1 connector"/>
              <div className="ic i2"><span className="glyph-mini" style={{width:26, height:26, fontSize:14, borderRadius:6, display:'grid', placeItems:'center', background:'var(--color-orange-alpha-10)', color:'var(--color-orange-300)', fontWeight:700, fontFamily:'JetBrains Mono, monospace'}}>T</span></div>
              <div className="ic c2 connector"/>
              <div className="ic i3"><span className="glyph-mini" style={{width:26, height:26, fontSize:14, borderRadius:6, display:'grid', placeItems:'center', background:'rgba(0,140,255,0.12)', color:'var(--color-blue-500)', fontWeight:700, fontFamily:'JetBrains Mono, monospace'}}>S</span></div>
            </div>
            <h2>No pipelines yet</h2>
            <p>A pipeline takes a stream of events from somewhere (Kafka, a database CDC feed, an HTTP source) and lands it somewhere else — usually after a transform, dedup, filter, or join. Build your first one from scratch, import a Bridge config, or start from a template.</p>
            <div className="cta-row">
              <button className="btn btn-primary" style={{fontSize:13, padding:'9px 16px'}}>
                <Icon name="plus" size={12}/>Create from scratch
              </button>
              <button className="btn btn-secondary" style={{fontSize:13, padding:'9px 16px'}}>
                <Icon name="library" size={12}/>Import existing config
              </button>
              <button className="btn btn-secondary" style={{fontSize:13, padding:'9px 16px'}}>
                <Icon name="sparkles" size={12}/>Generate with AI
              </button>
            </div>

            <div className="quick">
              <div className="quick-card">
                <div className="h">
                  <span className="glyph-mini" style={{width:22, height:22, fontSize:11, borderRadius:5, display:'grid', placeItems:'center', background:'rgba(183,148,255,0.12)', color:'#b794ff', fontWeight:700, fontFamily:'JetBrains Mono, monospace'}}>D</span>
                  <h4>Kafka → ClickHouse with dedup</h4>
                </div>
                <p>Most-used template. Reads a Kafka topic, dedups on a key + window, lands in ClickHouse.</p>
              </div>
              <div className="quick-card">
                <div className="h">
                  <span className="glyph-mini" style={{width:22, height:22, fontSize:11, borderRadius:5, display:'grid', placeItems:'center', background:'rgba(255,200,80,0.12)', color:'var(--color-yellow-400)', fontWeight:700, fontFamily:'JetBrains Mono, monospace'}}>J</span>
                  <h4>Enrich events with a join</h4>
                </div>
                <p>Stream + lookup table → enriched stream. Good for orders × users, events × products.</p>
              </div>
              <div className="quick-card">
                <div className="h">
                  <span className="glyph-mini" style={{width:22, height:22, fontSize:11, borderRadius:5, display:'grid', placeItems:'center', background:'rgba(0,211,112,0.12)', color:'var(--color-green-500)', fontWeight:700, fontFamily:'JetBrains Mono, monospace'}}>F</span>
                  <h4>CDC → fanout topics</h4>
                </div>
                <p>Postgres logical replication → split into per-team topics with row-level filters.</p>
              </div>
            </div>
          </div>
        </div>

        <Annot>
          T-21 empty state. Pictograph teaches the I→T→S grammar visually before any UI words. Three CTAs map
          to the three real entry points (create, import, AI). Quick-start cards seed the most-used pipeline
          shapes — every one is a real Library template, not aspirational copy.
        </Annot>
      </div>
    </AppShell>
  </div>
);

Object.assign(window, { ArtPLBulk, ArtPLEmpty });
