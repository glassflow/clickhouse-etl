// Library detail artboards — T-08 Dedup, T-09 Filter, T-10 Join, T-11 Templates
// Reuses bridge primitives (BRVersionTimeline, BRUsedByTable, BRVersionPill, BRCountChip)

// ============ L1. DEDUP CONFIG DETAIL ============
const ArtLibDedupDetail = () => {
  return (
    <div className="br-scene">
      <div className="br-scene-inner">
        <div className="br-crumbs">
          <Icon name="library" size={12}/>
          <a>Library</a> <CIcon name="chevR" size={10}/>
          <a>Dedup configs</a> <CIcon name="chevR" size={10}/>
          <span style={{color:'var(--color-foreground-neutral)'}}>orders-dedup</span>
        </div>
        <div className="flex items-center gap-3" style={{marginTop:8}}>
          <h1 className="br-title" style={{margin:0}}>orders-dedup</h1>
          <BRVersionPill v="v2" latest/>
          <BRVersionPill v="v1" current/>
          <BRCountChip n={4}/>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost btn-sm"><Icon name="clone" size={12}/> Clone</button>
          <button className="btn btn-ghost btn-sm"><Icon name="edit" size={12}/> Edit</button>
          <button className="btn btn-secondary btn-sm"><Icon name="pipelines" size={12}/> Roll out v2…</button>
        </div>
        <p className="br-subtitle">
          Reusable dedup configuration. <strong style={{color:'var(--color-foreground-neutral)'}}>v2</strong> changed the window from 5m → 10m to catch slow-arriving duplicates from the EU broker. Pipelines stay pinned to v1 until upgraded.
        </p>

        <div style={{display:'grid', gridTemplateColumns:'1.25fr 1fr', gap:14}}>
          {/* LEFT — config + window viz */}
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="br-card">
              <h4><Icon name="dedup" size={14}/> Configuration · v2 (latest)</h4>
              <dl className="lb-kv">
                <dt>Key field</dt>
                <dd><span className="chip chip-muted mono">order_id</span> <span className="desc">unique per order; idempotency key from upstream</span></dd>

                <dt>Secondary key</dt>
                <dd><span className="chip chip-muted mono">tenant_id</span> <span className="desc">isolates tenants — same order_id across tenants is fine</span></dd>

                <dt>Window</dt>
                <dd>10 minutes <span className="desc">tumbling, event-time</span></dd>

                <dt>On duplicate</dt>
                <dd>keep first <span className="desc">drop later events</span></dd>

                <dt>Late events</dt>
                <dd>compare against window <span className="desc">events older than 10m skip dedup, pass through</span></dd>

                <dt>State backend</dt>
                <dd>nats-kv <span className="desc">survives restarts</span></dd>
              </dl>
            </div>

            <div className="br-card">
              <h4><Icon name="info" size={14}/> Window behaviour
                <span className="chip chip-muted" style={{marginLeft:'auto'}}>last 60s sample</span>
              </h4>
              <div className="lb-window-viz">
                <div style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>10-minute dedup window with 12 sample events. Duplicates within window are dropped.</div>
                <div className="lb-window-track">
                  <div className="lb-window-shade" style={{left:'15%', right:'5%'}}/>
                  {/* event marks */}
                  {[
                    {x:8,  type:'ok',  lbl:'ord_842'},
                    {x:18, type:'ok',  lbl:'ord_843'},
                    {x:24, type:'dup', lbl:'ord_842 ✕'},
                    {x:32, type:'ok',  lbl:'ord_844'},
                    {x:41, type:'dup', lbl:'ord_843 ✕'},
                    {x:50, type:'ok',  lbl:'ord_845'},
                    {x:58, type:'ok',  lbl:'ord_846'},
                    {x:68, type:'dup', lbl:'ord_845 ✕'},
                    {x:78, type:'ok',  lbl:'ord_847'},
                    {x:88, type:'ok',  lbl:'ord_848'},
                  ].map((m,i)=>(
                    <div key={i} className={`lb-window-mark ${m.type==='dup'?'dup':''}`} style={{left:`${m.x}%`}}>
                      {i % 2 === 0 && <span className="lbl">{m.lbl}</span>}
                    </div>
                  ))}
                </div>
                <div className="lb-window-axis"><span>t-60s</span><span>t-40s</span><span>t-20s</span><span>now</span></div>
                <div style={{marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, fontSize:11}}>
                  <div>
                    <div style={{color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontSize:9.5, fontWeight:600}}>Total events</div>
                    <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:18, color:'var(--color-foreground-neutral)', marginTop:2}}>12</div>
                  </div>
                  <div>
                    <div style={{color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontSize:9.5, fontWeight:600}}>Passed through</div>
                    <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:18, color:'var(--color-green-500)', marginTop:2}}>9</div>
                  </div>
                  <div>
                    <div style={{color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontSize:9.5, fontWeight:600}}>Dropped (dup)</div>
                    <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:18, color:'var(--color-red-500)', marginTop:2}}>3</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="br-card">
              <h4><Icon name="schema" size={14}/> YAML preview</h4>
              <div className="lb-yaml">
{`dedup:
  `}<span className="k">name</span>{`: `}<span className="s">"orders-dedup"</span>{`
  `}<span className="k">version</span>{`: `}<span className="n">2</span>{`
  `}<span className="k">key_fields</span>{`:
    - order_id
    - tenant_id
  `}<span className="k">window</span>{`:
    `}<span className="k">duration</span>{`: `}<span className="s">10m</span>{`
    `}<span className="k">type</span>{`: tumbling
    `}<span className="k">time_attribute</span>{`: event_time
  `}<span className="k">on_duplicate</span>{`: keep_first
  `}<span className="k">state_backend</span>{`: nats-kv
  `}<span className="c"># Late events older than window pass through unchecked</span>{`
  `}<span className="k">late_event_policy</span>{`: pass_through`}
              </div>
            </div>
          </div>

          {/* RIGHT — version timeline + used-by */}
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="br-card">
              <h4><Icon name="history" size={14}/> Version history</h4>
              <BRVersionTimeline
                current="v1"
                items={[
                  { v:"v2", latest:true, when:"3 days ago", author:"vincent.co",
                    msg:"Widened window 5m → 10m to catch slow EU broker duplicates.",
                    diff:"~ window.duration: 5m → 10m",
                    usedBy: 0 },
                  { v:"v1", when:"Jan 22", author:"maya.li",
                    msg:"Initial config — order_id keyed, 5m window.",
                    diff:"+ key_fields: [order_id, tenant_id]\n+ window: 5m tumbling\n+ on_duplicate: keep_first",
                    usedBy: 4 },
                ]}
              />
            </div>

            <div className="br-card">
              <h4><Icon name="pipelines" size={14}/> Used by 4 pipelines</h4>
              <BRUsedByTable rows={[
                { name:"prod-orders-to-analytics", env:"prod",    owner:"commerce-team", pinned:"v1", latest:"v2", drift:true,  status:"running" },
                { name:"prod-orders-eu-analytics", env:"prod",    owner:"commerce-team", pinned:"v1", latest:"v2", drift:true,  status:"running" },
                { name:"staging-orders-to-analytics", env:"staging", owner:"commerce-team", pinned:"v1", latest:"v2", drift:true, status:"running" },
                { name:"dev-orders-debug-vincent", env:"dev",     owner:"vincent.co",    pinned:"v2", latest:"v2", drift:false, status:"running" },
              ]}/>
            </div>

            <div className="annot">
              <strong>NOTE</strong> Same shape as Schema detail (B2). The window-behaviour viz is dedup-specific — a small visualisation answers "is the window doing what I think?" without opening Logs. Reusable for any pinned, versioned library asset: list → detail → version timeline → used-by → edit.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ L2. FILTER DETAIL — rule builder + live preview ============
const ArtLibFilterDetail = () => {
  return (
    <div className="br-scene">
      <div className="br-scene-inner">
        <div className="br-crumbs">
          <Icon name="library" size={12}/>
          <a>Library</a> <CIcon name="chevR" size={10}/>
          <a>Filters</a> <CIcon name="chevR" size={10}/>
          <span style={{color:'var(--color-foreground-neutral)'}}>high-value-orders</span>
        </div>
        <div className="flex items-center gap-3" style={{marginTop:8}}>
          <h1 className="br-title" style={{margin:0}}>high-value-orders</h1>
          <BRVersionPill v="v3" latest current/>
          <BRCountChip n={2}/>
          <span className="chip chip-positive"><Icon name="check" size={10}/> all pipelines on latest</span>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost btn-sm"><Icon name="clone" size={12}/> Clone</button>
          <button className="btn btn-secondary btn-sm"><Icon name="edit" size={12}/> Edit rules…</button>
        </div>
        <p className="br-subtitle">
          Named filter — keeps high-value orders bound for the analytics sink. Saved filters get pinned versions and live in the canvas as a single node, instead of an inline expression buried in YAML.
        </p>

        <div style={{display:'grid', gridTemplateColumns:'1.35fr 1fr', gap:14}}>
          {/* LEFT — rules + match stats + samples */}
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="br-card">
              <h4><Icon name="filter" size={14}/> Rules · v3
                <span className="chip chip-muted" style={{marginLeft:'auto'}}>4 conditions · 1 group</span>
              </h4>
              <div className="lb-rules">
                <div className="lb-rule">
                  <div className="conj">where</div>
                  <div className="field">
                    <span>currency</span>
                    <span className="ftype">str</span>
                  </div>
                  <div className="op">equals</div>
                  <div className="val">"USD"</div>
                  <div className="more"><Icon name="more" size={14}/></div>
                </div>
                <div className="lb-rule">
                  <div className="conj and">and</div>
                  <div className="field">
                    <span>status</span>
                    <span className="ftype">str</span>
                  </div>
                  <div className="op">in</div>
                  <div className="val">["paid", "fulfilled"]</div>
                  <div className="more"><Icon name="more" size={14}/></div>
                </div>
                <div className="lb-rule lb-rule-group">
                  <div className="conj and">and</div>
                  <div className="group-open">(</div>
                  <div className="op">group</div>
                  <div className="val" style={{color:'var(--color-gray-dark-500)'}}>match any of:</div>
                  <div className="more"><Icon name="more" size={14}/></div>
                </div>
                <div className="lb-rule lb-rule-group" style={{paddingLeft:36}}>
                  <div className="conj">or</div>
                  <div className="field">
                    <span>unit_price_cents × quantity</span>
                    <span className="ftype">expr</span>
                  </div>
                  <div className="op">≥</div>
                  <div className="val">500000</div>
                  <div className="more"><Icon name="more" size={14}/></div>
                </div>
                <div className="lb-rule lb-rule-group" style={{paddingLeft:36}}>
                  <div className="conj">or</div>
                  <div className="field">
                    <span>tags</span>
                    <span className="ftype">arr</span>
                  </div>
                  <div className="op">contains</div>
                  <div className="val">"vip"</div>
                  <div className="more"><Icon name="more" size={14}/></div>
                </div>
                <div className="lb-rule-add">
                  <Icon name="plus" size={11}/>
                  <a>Add condition</a>
                  <span style={{color:'var(--color-gray-dark-700)'}}>·</span>
                  <a>Add group</a>
                </div>
              </div>
            </div>

            <div className="br-card">
              <h4><Icon name="info" size={14}/> Live preview
                <span className="chip chip-muted" style={{marginLeft:'auto'}}>against last 1k events from kafka-prod-eu / orders.placed</span>
              </h4>
              <div className="lb-match-stat">
                <div className="col">
                  <div className="num">1,000</div>
                  <div className="lbl">Sampled</div>
                </div>
                <div className="div"/>
                <div className="col">
                  <div className="num green">187</div>
                  <div className="lbl">Match (18.7%)</div>
                </div>
                <div className="div"/>
                <div className="col">
                  <div className="num gray">813</div>
                  <div className="lbl">Dropped</div>
                </div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12}}>
                <div>
                  <div style={{fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--color-green-500)', fontWeight:600, marginBottom:6}}>Sample matches</div>
                  <div className="lb-events">
                    <div className="lb-event match">
                      <div className="mk"/>
                      <div>{`{ `}<span className="e-key">order_id</span>{`: `}<span className="e-val">"ord_8821"</span>{`, `}<span className="e-key">currency</span>{`: "USD", `}<span className="e-key">status</span>{`: "paid", `}<span className="e-key">total</span>{`: 612000, `}<span className="e-key">tags</span>{`: ["vip","corp"] }`}</div>
                    </div>
                    <div className="lb-event match">
                      <div className="mk"/>
                      <div>{`{ `}<span className="e-key">order_id</span>{`: "ord_8804", `}<span className="e-key">currency</span>{`: "USD", `}<span className="e-key">status</span>{`: "fulfilled", `}<span className="e-key">total</span>{`: 549900, `}<span className="e-key">tags</span>{`: [] }`}</div>
                    </div>
                    <div className="lb-event match">
                      <div className="mk"/>
                      <div>{`{ `}<span className="e-key">order_id</span>{`: "ord_8779", `}<span className="e-key">currency</span>{`: "USD", `}<span className="e-key">status</span>{`: "paid", `}<span className="e-key">total</span>{`: 24500, `}<span className="e-key">tags</span>{`: ["vip"] }`}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--color-gray-dark-500)', fontWeight:600, marginBottom:6}}>Sample dropped</div>
                  <div className="lb-events">
                    <div className="lb-event drop">
                      <div className="mk"/>
                      <div>{`{ order_id: "ord_8820", currency: "EUR", status: "paid", total: 700000 }  `}<span style={{color:'var(--color-orange-300)'}}>currency ≠ USD</span></div>
                    </div>
                    <div className="lb-event drop">
                      <div className="mk"/>
                      <div>{`{ order_id: "ord_8819", currency: "USD", status: "pending", total: 89000 }  `}<span style={{color:'var(--color-orange-300)'}}>status not in [paid, fulfilled]</span></div>
                    </div>
                    <div className="lb-event drop">
                      <div className="mk"/>
                      <div>{`{ order_id: "ord_8815", currency: "USD", status: "paid", total: 4200, tags: [] }  `}<span style={{color:'var(--color-orange-300)'}}>price × qty &lt; 500000 and no vip tag</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — version timeline + used-by */}
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="br-card">
              <h4><Icon name="history" size={14}/> Version history</h4>
              <BRVersionTimeline
                current="v3"
                items={[
                  { v:"v3", latest:true, when:"6 days ago", author:"maya.li",
                    msg:"Added VIP/corp tag short-circuit so loyal customers always pass through.",
                    diff:"+ OR group: total ≥ 500k OR tags contains 'vip'",
                    usedBy: 2 },
                  { v:"v2", when:"Mar 14", author:"vincent.co",
                    msg:"Tightened to fulfilled/paid only — was including pending.",
                    diff:"~ status: in [paid, pending, fulfilled] → in [paid, fulfilled]",
                    usedBy: 0 },
                  { v:"v1", when:"Feb 2", author:"vincent.co",
                    msg:"Initial — USD only, total ≥ $5k.",
                    diff:"+ currency = USD\n+ total ≥ 500000",
                    usedBy: 0 },
                ]}
              />
            </div>

            <div className="br-card">
              <h4><Icon name="pipelines" size={14}/> Used by 2 pipelines</h4>
              <BRUsedByTable rows={[
                { name:"prod-orders-to-analytics", env:"prod",    owner:"commerce-team", pinned:"v3", latest:"v3", drift:false, status:"running" },
                { name:"staging-orders-to-analytics", env:"staging", owner:"commerce-team", pinned:"v3", latest:"v3", drift:false, status:"running" },
              ]}/>
            </div>

            <div className="annot">
              <strong>RULE BUILDER</strong> Compiles to a single boolean expression at deploy. Group rows are nested visually but flat in YAML — designers don't have to count parens. Edit mode (not shown) makes every row inline-editable; Add condition / Add group lives at the bottom.
            </div>

            <div className="annot">
              <strong>WHY NAMED FILTERS?</strong> Inline filter expressions inside YAML are invisible from the library — they don't show "used by", can't be versioned, and can't be diffed across pipelines. Promoting a filter to a library asset means each business rule is one editable thing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ L3. JOIN DETAIL — temporal join builder ============
const ArtLibJoinDetail = () => {
  return (
    <div className="br-scene">
      <div className="br-scene-inner">
        <div className="br-crumbs">
          <Icon name="library" size={12}/>
          <a>Library</a> <CIcon name="chevR" size={10}/>
          <a>Joins</a> <CIcon name="chevR" size={10}/>
          <span style={{color:'var(--color-foreground-neutral)'}}>orders-with-customer</span>
        </div>
        <div className="flex items-center gap-3" style={{marginTop:8}}>
          <h1 className="br-title" style={{margin:0}}>orders-with-customer</h1>
          <BRVersionPill v="v2" latest/>
          <BRVersionPill v="v1" current/>
          <BRCountChip n={3}/>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost btn-sm"><Icon name="clone" size={12}/> Clone</button>
          <button className="btn btn-secondary btn-sm"><Icon name="pipelines" size={12}/> Roll out v2…</button>
        </div>
        <p className="br-subtitle">
          Temporal join — enriches each order with customer profile data within a 30-minute window. <strong style={{color:'var(--color-foreground-neutral)'}}>v2</strong> widened the window from 15m → 30m to handle late-arriving customer updates from the CRM stream.
        </p>

        <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:14}}>
          {/* LEFT — join builder + window + output */}
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="br-card">
              <h4><Icon name="link" size={14}/> Join definition · v2</h4>
              <div className="lb-join-canvas">
                <div className="lb-join-row">
                  <div className="lb-stream left">
                    <div className="role">Left · primary stream</div>
                    <div className="name">orders</div>
                    <div className="topic">kafka-prod-eu / orders.placed.v2 · OrderEvents v5</div>
                    <div style={{display:'flex', flexDirection:'column', gap:6}}>
                      <div className="key-row is-join">
                        <span className="kn">customer_id</span>
                        <span className="kt">string</span>
                        <span className="chip chip-warn" style={{marginLeft:'auto', fontSize:9}}>JOIN KEY</span>
                      </div>
                      <div className="key-row">
                        <span className="kn">order_id</span><span className="kt">string</span>
                      </div>
                      <div className="key-row">
                        <span className="kn">total_cents</span><span className="kt">uint64</span>
                      </div>
                    </div>
                  </div>

                  <div className="lb-join-pivot">
                    <div className="lb-join-glyph">⋈</div>
                    <div className="lbl">temporal join</div>
                    <div style={{fontSize:10, color:'var(--color-gray-250)', fontFamily:'JetBrains Mono, monospace', marginTop:2}}>LEFT</div>
                  </div>

                  <div className="lb-stream right">
                    <div className="role">Right · enrichment stream</div>
                    <div className="name">customers</div>
                    <div className="topic">kafka-prod-eu / customers.changes · CustomerProfile v3</div>
                    <div style={{display:'flex', flexDirection:'column', gap:6}}>
                      <div className="key-row is-join">
                        <span className="kn">id</span>
                        <span className="kt">string</span>
                        <span className="chip chip-warn" style={{marginLeft:'auto', fontSize:9}}>JOIN KEY</span>
                      </div>
                      <div className="key-row">
                        <span className="kn">tier</span><span className="kt">string</span>
                      </div>
                      <div className="key-row">
                        <span className="kn">country</span><span className="kt">string</span>
                      </div>
                      <div className="key-row">
                        <span className="kn">crm_updated_at</span><span className="kt">timestamp</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lb-join-window">
                  <div className="field">
                    <label>Window type</label>
                    <div className="v">interval</div>
                    <div className="hint">match by event-time proximity</div>
                  </div>
                  <div className="field">
                    <label>Window size</label>
                    <div className="v">30 minutes</div>
                    <div className="hint">order can match a customer update up to 30m before</div>
                  </div>
                  <div className="field">
                    <label>On no match</label>
                    <div className="v">left outer (emit null right)</div>
                    <div className="hint">orders are never dropped; missing customer is acceptable</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="br-card">
              <h4><Icon name="schema" size={14}/> Output schema · OrderWithCustomer
                <span className="chip chip-muted" style={{marginLeft:'auto'}}>9 fields</span>
              </h4>
              <div className="lb-output-fields">
                <div className="of-row">
                  <div className="src left"/>
                  <div className="of-name">order_id</div>
                  <div className="of-type">string</div>
                  <div className="of-tag">left</div>
                </div>
                <div className="of-row">
                  <div className="src left"/>
                  <div className="of-name">total_cents</div>
                  <div className="of-type">uint64</div>
                  <div className="of-tag">left</div>
                </div>
                <div className="of-row">
                  <div className="src left"/>
                  <div className="of-name">currency</div>
                  <div className="of-type">string</div>
                  <div className="of-tag">left</div>
                </div>
                <div className="of-row">
                  <div className="src both"/>
                  <div className="of-name">customer_id</div>
                  <div className="of-type">string</div>
                  <div className="of-tag">join key</div>
                </div>
                <div className="of-row">
                  <div className="src right"/>
                  <div className="of-name">customer_tier</div>
                  <div className="of-type">string · nullable</div>
                  <div className="of-tag">right</div>
                </div>
                <div className="of-row">
                  <div className="src right"/>
                  <div className="of-name">customer_country</div>
                  <div className="of-type">string · nullable</div>
                  <div className="of-tag">right</div>
                </div>
                <div className="of-row">
                  <div className="src right"/>
                  <div className="of-name">customer_lifetime_value</div>
                  <div className="of-type">uint64 · nullable</div>
                  <div className="of-tag">right</div>
                </div>
                <div className="of-row">
                  <div className="src left"/>
                  <div className="of-name">event_time</div>
                  <div className="of-type">timestamp</div>
                  <div className="of-tag">left</div>
                </div>
                <div className="of-row">
                  <div className="src both"/>
                  <div className="of-name">_join_lag_ms</div>
                  <div className="of-type">int64</div>
                  <div className="of-tag">computed</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — versions + used-by + a stat */}
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="br-card">
              <h4><Icon name="info" size={14}/> Last hour
                <span className="chip chip-muted" style={{marginLeft:'auto'}}>across all 3 pipelines</span>
              </h4>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                <div style={{padding:'12px 14px', background:'#08080b', border:'1px solid var(--color-gray-dark-800)', borderRadius:8}}>
                  <div style={{fontSize:9.5, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--color-gray-dark-500)', fontWeight:600}}>Match rate</div>
                  <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:22, color:'var(--color-green-500)', marginTop:4}}>97.4%</div>
                  <div style={{fontSize:11, color:'var(--color-gray-dark-500)', marginTop:2}}>↑ 4.1pp since v2</div>
                </div>
                <div style={{padding:'12px 14px', background:'#08080b', border:'1px solid var(--color-gray-dark-800)', borderRadius:8}}>
                  <div style={{fontSize:9.5, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--color-gray-dark-500)', fontWeight:600}}>p95 join lag</div>
                  <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:22, color:'var(--color-foreground-neutral)', marginTop:4}}>4.2 min</div>
                  <div style={{fontSize:11, color:'var(--color-gray-dark-500)', marginTop:2}}>well under 30m window</div>
                </div>
              </div>
            </div>

            <div className="br-card">
              <h4><Icon name="history" size={14}/> Version history</h4>
              <BRVersionTimeline
                current="v1"
                items={[
                  { v:"v2", latest:true, when:"5 days ago", author:"maya.li",
                    msg:"Widened window 15m → 30m. CRM updates were arriving slow on Mondays.",
                    diff:"~ window.size: 15m → 30m",
                    usedBy: 0 },
                  { v:"v1", when:"Feb 28", author:"vincent.co",
                    msg:"Initial join: orders ⋈ customers on customer_id, 15m interval.",
                    diff:"+ left: orders\n+ right: customers\n+ key: customer_id\n+ window: 15m interval, left outer",
                    usedBy: 3 },
                ]}
              />
            </div>

            <div className="br-card">
              <h4><Icon name="pipelines" size={14}/> Used by 3 pipelines</h4>
              <BRUsedByTable rows={[
                { name:"prod-orders-to-analytics", env:"prod",    owner:"commerce-team", pinned:"v1", latest:"v2", drift:true,  status:"running" },
                { name:"prod-marketing-attribution", env:"prod",    owner:"growth-team",   pinned:"v1", latest:"v2", drift:true,  status:"running" },
                { name:"staging-orders-eu-analytics", env:"staging", owner:"commerce-team", pinned:"v1", latest:"v2", drift:true,  status:"running" },
              ]}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ L4. TEMPLATES INDEX — browse and clone ============
const ArtLibTemplates = () => {
  return (
    <div className="br-scene">
      <div className="br-scene-inner">
        <div className="br-crumbs">
          <Icon name="library" size={12}/>
          <a>Library</a> <CIcon name="chevR" size={10}/>
          <span style={{color:'var(--color-foreground-neutral)'}}>Templates</span>
        </div>
        <div className="flex items-center gap-3" style={{marginTop:8}}>
          <h1 className="br-title" style={{margin:0}}>Templates</h1>
          <span className="chip chip-muted">14 templates</span>
          <div style={{flex:1}}/>
          <div style={{position:'relative'}}>
            <Icon name="search" size={12} color="var(--color-gray-dark-500)"/>
            <input className="input" placeholder="Search templates…" style={{paddingLeft:28, width:260}}/>
            <div style={{position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none'}}><Icon name="search" size={12} color="var(--color-gray-dark-500)"/></div>
          </div>
          <button className="btn btn-secondary btn-sm"><Icon name="plus" size={12}/> New template…</button>
        </div>
        <p className="br-subtitle">
          Browse-and-clone surface for common patterns. Pick a template and "Use" jumps you into a draft pipeline pre-wired with placeholder connections — finish by mapping your topics &amp; tables. Replaces the blank canvas as the default starting point for new users.
        </p>

        <div style={{display:'grid', gridTemplateColumns:'220px 1fr', gap:18, marginTop:6}}>
          {/* Filters rail */}
          <div className="lb-filters" style={{height:'fit-content'}}>
            <h6>Use case</h6>
            <div className="lb-filter-item is-active"><div className="cb"><Icon name="check" size={9} color="#000"/></div><span>All</span><span className="count">14</span></div>
            <div className="lb-filter-item"><div className="cb"/><span>CDC → Warehouse</span><span className="count">4</span></div>
            <div className="lb-filter-item"><div className="cb"/><span>Dedup &amp; clean</span><span className="count">3</span></div>
            <div className="lb-filter-item"><div className="cb"/><span>Enrichment / join</span><span className="count">3</span></div>
            <div className="lb-filter-item"><div className="cb"/><span>Real-time analytics</span><span className="count">2</span></div>
            <div className="lb-filter-item"><div className="cb"/><span>Observability</span><span className="count">2</span></div>

            <h6>Source</h6>
            <div className="lb-filter-item"><div className="cb"/><span>Kafka</span><span className="count">10</span></div>
            <div className="lb-filter-item"><div className="cb"/><span>Postgres CDC</span><span className="count">3</span></div>
            <div className="lb-filter-item"><div className="cb"/><span>OTLP</span><span className="count">2</span></div>

            <h6>Sink</h6>
            <div className="lb-filter-item"><div className="cb"/><span>ClickHouse</span><span className="count">9</span></div>
            <div className="lb-filter-item"><div className="cb"/><span>Iceberg</span><span className="count">3</span></div>
            <div className="lb-filter-item"><div className="cb"/><span>Postgres</span><span className="count">2</span></div>
          </div>

          {/* Grid */}
          <div>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
              <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--color-orange-300)', fontFamily:'JetBrains Mono, monospace', fontWeight:600}}>Featured</div>
              <div style={{flex:1, height:1, background:'var(--color-gray-dark-800)'}}/>
            </div>

            <div className="lb-tpl-grid">
              <div className="lb-tpl-card featured">
                <div className="topo">
                  <div className="node"><Icon name="kafka" size={11}/> kafka</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="dedup" size={11}/> dedup</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="ch" size={11}/> ch</div>
                </div>
                <div className="ttags">
                  <span className="ttag tier">Most used</span>
                  <span className="ttag">CDC → Warehouse</span>
                </div>
                <h5>Kafka → Dedup → ClickHouse</h5>
                <p>The canonical "I have duplicate orders in Kafka, send them clean to my warehouse" pipeline. Pre-wired with order_id dedup over a 5-minute window.</p>
                <div className="meta">
                  <span className="stat"><Icon name="clone" size={10}/> <strong>2,103</strong> uses</span>
                  <span className="stat"><Icon name="info" size={10}/> 3 fields to map</span>
                </div>
              </div>

              <div className="lb-tpl-card featured">
                <div className="topo">
                  <div className="node"><Icon name="kafka" size={11}/> orders</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="link" size={11}/> ⋈</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="ch" size={11}/> ch</div>
                </div>
                <div className="ttags">
                  <span className="ttag tier">Featured</span>
                  <span className="ttag">Enrichment</span>
                </div>
                <h5>Two-stream temporal join</h5>
                <p>Enrich a primary stream (orders) with a slow-changing dimension stream (customers). Configurable window and outer-join behaviour.</p>
                <div className="meta">
                  <span className="stat"><Icon name="clone" size={10}/> <strong>871</strong> uses</span>
                  <span className="stat"><Icon name="info" size={10}/> 4 fields to map</span>
                </div>
              </div>

              <div className="lb-tpl-card featured">
                <div className="topo">
                  <div className="node"><Icon name="kafka" size={11}/> pg-cdc</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="filter" size={11}/> filter</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="ch" size={11}/> ch</div>
                </div>
                <div className="ttags">
                  <span className="ttag tier">New</span>
                  <span className="ttag">CDC → Warehouse</span>
                </div>
                <h5>Postgres CDC → ClickHouse mirror</h5>
                <p>Mirror selected Postgres tables into ClickHouse with insert/update/delete handling and soft-delete support.</p>
                <div className="meta">
                  <span className="stat"><Icon name="clone" size={10}/> <strong>344</strong> uses</span>
                  <span className="stat"><Icon name="info" size={10}/> 2 fields to map</span>
                </div>
              </div>
            </div>

            <div style={{display:'flex', alignItems:'center', gap:10, margin:'24px 0 12px'}}>
              <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', fontWeight:600}}>All templates</div>
              <div style={{flex:1, height:1, background:'var(--color-gray-dark-800)'}}/>
              <div style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>Sort: most used</div>
            </div>

            <div className="lb-tpl-grid">
              <div className="lb-tpl-card">
                <div className="topo">
                  <div className="node"><Icon name="kafka" size={11}/> kafka</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="transform" size={11}/> redact</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="ch" size={11}/> ch</div>
                </div>
                <div className="ttags"><span className="ttag">PII</span></div>
                <h5>PII redaction pipeline</h5>
                <p>Hash or drop configured fields (email, ssn, card) before they leave the boundary.</p>
                <div className="meta">
                  <span className="stat"><Icon name="clone" size={10}/> <strong>312</strong> uses</span>
                </div>
              </div>

              <div className="lb-tpl-card">
                <div className="topo">
                  <div className="node"><Icon name="otlp" size={11}/> otlp</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="filter" size={11}/> sample</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="ch" size={11}/> traces</div>
                </div>
                <div className="ttags"><span className="ttag">Observability</span></div>
                <h5>OTLP traces → ClickHouse</h5>
                <p>Tail-sample and store traces with ClickHouse's traces schema. Drops idle spans by default.</p>
                <div className="meta">
                  <span className="stat"><Icon name="clone" size={10}/> <strong>198</strong> uses</span>
                </div>
              </div>

              <div className="lb-tpl-card">
                <div className="topo">
                  <div className="node"><Icon name="kafka" size={11}/> kafka</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="dedup" size={11}/> dedup</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="link" size={11}/> ⋈</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="ch" size={11}/> ch</div>
                </div>
                <div className="ttags"><span className="ttag">Real-time</span></div>
                <h5>Dedup + enrich + sink</h5>
                <p>Three-stage pattern for analytics: clean duplicates, join with a dim stream, write to a wide table.</p>
                <div className="meta">
                  <span className="stat"><Icon name="clone" size={10}/> <strong>156</strong> uses</span>
                </div>
              </div>

              <div className="lb-tpl-card">
                <div className="topo">
                  <div className="node"><Icon name="kafka" size={11}/> events</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="filter" size={11}/> route</div>
                  <div className="arrow"/>
                  <div className="node" style={{background:'#1a1a22'}}>3 sinks</div>
                </div>
                <div className="ttags"><span className="ttag">Routing</span></div>
                <h5>Fan-out by event type</h5>
                <p>Route a single source stream to N sinks based on event_type. One pipeline replaces three.</p>
                <div className="meta">
                  <span className="stat"><Icon name="clone" size={10}/> <strong>91</strong> uses</span>
                </div>
              </div>

              <div className="lb-tpl-card">
                <div className="topo">
                  <div className="node"><Icon name="kafka" size={11}/> kafka</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="transform" size={11}/> sql</div>
                  <div className="arrow"/>
                  <div className="node">iceberg</div>
                </div>
                <div className="ttags"><span className="ttag">Lakehouse</span></div>
                <h5>Kafka → Iceberg with SQL transforms</h5>
                <p>Land raw events into Iceberg with column-level SQL transforms; partition by hour automatically.</p>
                <div className="meta">
                  <span className="stat"><Icon name="clone" size={10}/> <strong>67</strong> uses</span>
                </div>
              </div>

              <div className="lb-tpl-card">
                <div className="topo">
                  <div className="node"><Icon name="kafka" size={11}/> dlq</div>
                  <div className="arrow"/>
                  <div className="node"><Icon name="filter" size={11}/> classify</div>
                  <div className="arrow"/>
                  <div className="node">alerts</div>
                </div>
                <div className="ttags"><span className="ttag">Ops</span></div>
                <h5>DLQ → classifier → alerts</h5>
                <p>Watch a DLQ topic, classify by error pattern, page on critical, file the rest.</p>
                <div className="meta">
                  <span className="stat"><Icon name="clone" size={10}/> <strong>48</strong> uses</span>
                </div>
              </div>
            </div>

            <div className="annot" style={{marginTop:18}}>
              <strong>USE FLOW</strong> Click a card → preview-of-config opens in a side panel (not shown) → "Use template" creates a draft pipeline with the topology pre-wired and placeholder connections. The draft is named &lt;template&gt;-draft-&lt;suffix&gt; and lands in Create's draft state. Hands off cleanly to T-12 Review-generated-config before deploy.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  ArtLibDedupDetail, ArtLibFilterDetail, ArtLibJoinDetail, ArtLibTemplates,
});
