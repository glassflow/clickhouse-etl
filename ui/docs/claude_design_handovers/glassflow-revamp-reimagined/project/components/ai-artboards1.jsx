// AI artboards 1-4: entry tiles, empty chat, mid-conversation, completed handoff

// ============ AI1. ENTRY POINT — Create modal with 3 tiles ============
const ArtAIEntry = () => (
  <div style={{position:'relative', width:'100%', height:'100%', background:'#05050a', display:'grid', placeItems:'center', padding: 40}}>
    {/* Dimmed app background */}
    <div style={{position:'absolute', inset:0, background:'#05050a', opacity:0.4}}/>

    {/* Modal */}
    <div style={{
      position:'relative', width: 980,
      background:'#0c0c12', border:'1px solid var(--color-gray-dark-700)', borderRadius:16,
      boxShadow:'0 30px 80px rgba(0,0,0,0.7)', overflow:'hidden'
    }}>
      <div style={{padding:'22px 28px', borderBottom:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:14}}>
        <div style={{width:36, height:36, borderRadius:10, background:'var(--color-orange-alpha-10)', border:'1px solid var(--color-orange-alpha-20)', color:'var(--color-orange-300)', display:'grid', placeItems:'center'}}>
          <Icon name="plus" size={18}/>
        </div>
        <div>
          <h2 style={{margin:0, fontFamily:'var(--font-family-title)', fontSize:17, fontWeight:600, color:'var(--color-foreground-neutral)'}}>Create a pipeline</h2>
          <p style={{margin:'2px 0 0', fontSize:12, color:'var(--color-gray-dark-500)'}}>Start from scratch or resume a draft below</p>
        </div>
        <div style={{flex:1}}/>
        <button style={{background:'transparent', border:0, color:'var(--color-gray-dark-500)', cursor:'pointer', padding:8}}><Icon name="x" size={14}/></button>
      </div>

      <div style={{padding: 28}}>
        <div className="ai-entry-grid">
          <div className="ai-entry-tile ai">
            <div className="icon-box"><CIcon name="ai" size={22}/></div>
            <h4>Ask AI <span className="badge-recommended">recommended</span></h4>
            <p>Describe what you want in plain English. AI asks questions if needed, uses your library, and builds the pipeline for you.</p>
            <div className="eg">"Dedupe EU orders on order_id, enrich with customer country, write to ClickHouse analytics.orders"</div>
          </div>
          <div className="ai-entry-tile">
            <div className="icon-box"><Icon name="pipelines" size={22}/></div>
            <h4>Wizard</h4>
            <p>Step-by-step form. Best when you know exactly what you want and have all connection details ready.</p>
            <div className="eg">Kafka → Schema → Dedup → Filter → Sink (5 steps)</div>
          </div>
          <div className="ai-entry-tile">
            <div className="icon-box" style={{background:'#17171c', borderColor:'var(--color-gray-dark-700)', color:'var(--color-gray-dark-100)'}}><Icon name="edit" size={22}/></div>
            <h4>Canvas</h4>
            <p>Visual builder. Drag library components, connect them, configure each stage. Best for complex topologies (joins, branches).</p>
            <div className="eg">Two-topic joins · custom processor order · visual debugging</div>
          </div>
        </div>

        <div style={{marginTop: 20, borderTop:'1px dashed var(--color-gray-dark-800)', paddingTop:18}}>
          <div style={{fontSize:11, color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:10}}>Resume draft · 2</div>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            <div style={{display:'grid', gridTemplateColumns:'20px 1fr auto auto', gap:12, alignItems:'center', padding:'10px 14px', background:'#0e0e13', border:'1px solid var(--color-gray-dark-800)', borderRadius:8, cursor:'pointer'}}>
              <CIcon name="ai" size={13} color="#b794ff"/>
              <div>
                <div style={{fontSize:12.5, fontWeight:500, color:'var(--color-foreground-neutral)'}}>EU orders + revenue enrichment</div>
                <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', marginTop:2}}>AI chat · 4 messages · 2 min ago</div>
              </div>
              <span className="chip chip-muted">ai draft</span>
              <button className="btn btn-ghost btn-sm">Resume</button>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'20px 1fr auto auto', gap:12, alignItems:'center', padding:'10px 14px', background:'#0e0e13', border:'1px solid var(--color-gray-dark-800)', borderRadius:8, cursor:'pointer'}}>
              <Icon name="edit" size={13}/>
              <div>
                <div style={{fontSize:12.5, fontWeight:500, color:'var(--color-foreground-neutral)'}}>Untitled canvas</div>
                <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', marginTop:2}}>Canvas · 2 stages · yesterday</div>
              </div>
              <span className="chip chip-muted">canvas draft</span>
              <button className="btn btn-ghost btn-sm">Resume</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ============ AI2. EMPTY CHAT — first message ============
const ArtAIEmpty = () => (
  <div className="ai-stage">
    <div className="ai-chat wide" style={{flex:'1 1 auto', maxWidth: 820, margin:'0 auto'}}>
      <AIChatHead
        sub="new conversation · haiku-4.5"
        actions={<>
          <button className="btn btn-ghost btn-sm"><Icon name="history" size={12}/> History</button>
          <button className="btn btn-ghost btn-sm"><Icon name="x" size={12}/> Close</button>
        </>}
      />
      <div className="ai-chat-body" style={{display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', gap:20}}>
        <div style={{width:72, height:72, borderRadius:18, background:'linear-gradient(180deg, rgba(183,148,255,0.15), rgba(136,96,255,0.06))', border:'1px dashed rgba(183,148,255,0.3)', color:'#b794ff', display:'grid', placeItems:'center'}}>
          <CIcon name="ai" size={30}/>
        </div>
        <div style={{textAlign:'center', maxWidth: 520}}>
          <h3 style={{margin:0, fontFamily:'var(--font-family-title)', fontSize:19, fontWeight:600, color:'var(--color-foreground-neutral)'}}>What should this pipeline do?</h3>
          <p style={{margin:'8px 0 0', fontSize:13, color:'var(--color-gray-250)', lineHeight:1.6}}>
            Describe your source, the processing you need, and where it lands. I'll ask questions, use your library when I can, and build the config for you.
          </p>
        </div>

        <div style={{width:'100%', maxWidth: 560, marginTop:4}}>
          <AIComposer
            placeholder="e.g. 'Read orders from Kafka, dedupe on order_id, only keep EU shipments, write to ClickHouse'"
            suggestions={[
              "Dedupe order events and write to ClickHouse",
              "Join sessions with users from two topics",
              "Filter EU traffic from OTLP and store in CH",
              "Mask PII before sending to analytics",
              "Import from a PRD or ticket",
            ]}
          />
        </div>

        <div style={{marginTop: 12, fontSize: 11, color:'var(--color-gray-dark-500)', display:'flex', alignItems:'center', gap:8}}>
          <Icon name="info" size={10}/>
          <span>AI uses your <span className="mono" style={{color:'var(--color-orange-300)'}}>Library</span> to propose existing connections and schemas. Nothing is deployed until you review.</span>
        </div>
      </div>
    </div>
  </div>
);

// ============ AI3. MID-CONVERSATION — chat + live preview ============
const ArtAIMidChat = () => (
  <div className="ai-stage">
    {/* Left: chat */}
    <div className="ai-chat">
      <AIChatHead
        title="EU orders + revenue to ClickHouse"
        sub="4 messages · building · haiku-4.5"
        actions={<button className="btn btn-ghost btn-sm"><Icon name="more" size={12}/></button>}
      />
      <div className="ai-chat-body">
        <AIMsgUser time="just now">
          I want to read from Kafka orders, dedupe them, keep only EU shipments, and write to ClickHouse analytics. Can you figure out the details?
        </AIMsgUser>

        <AIMsgAI time="just now · 1.8s" thinking="Scanning library · 2 matches found">
          Got it. I found matches in your library — let me confirm a few details.
          <div style={{marginTop:10, fontSize:12.5, color:'var(--color-gray-250)', lineHeight:1.6}}>
            <strong>What I'm assuming:</strong>
            <ul style={{margin:'6px 0 0', paddingLeft:18}}>
              <li><AILibChip icon="kafka" name="kafka-prod-eu"/> as the source <AIBecause>you said "Kafka orders", prod cluster</AIBecause></li>
              <li>Topic <span className="mono">orders.placed.v2</span> with schema <AILibChip icon="schema" name="OrderEvents v5"/></li>
              <li>Dedup on <span className="mono">order_id</span> over 5 minutes <AIBecause>typical for order streams</AIBecause></li>
              <li><AILibChip icon="ch" name="ch-analytics-prod"/> sink, table <span className="mono">analytics.orders_eu</span> (new)</li>
            </ul>
          </div>
        </AIMsgAI>

        <AIMsgAI time="just now">
          One ambiguity — <strong>"EU shipments"</strong> can mean a few things:
          <AIPickCard
            title="Which one do you mean?"
            opts={[
              { icon:"filter", title:"shipping_country in EU27 list",      sub:"27 countries — strict EU member states", selected:true, badge:"pick this" },
              { icon:"filter", title:"customer.country in EU27 list",      sub:"based on billing address, not shipping",  badge:"alternate" },
              { icon:"filter", title:"region == 'EU' (custom field)",      sub:"if you have a region field you populate", badge:"alternate" },
            ]}
          />
          <div style={{marginTop:10, fontSize:12.5, color:'var(--color-gray-250)'}}>
            I'll use EU27 shipping country unless you say otherwise. Pick one or just tell me in the chat.
          </div>
        </AIMsgAI>

        <AIMsgUser time="now">
          Use shipping_country. Also add a revenue_cents field <span className="mono" style={{color:'var(--color-foreground-neutral)'}}>unit_price_cents × quantity</span> before the sink.
        </AIMsgUser>

        <AIMsgAI thinking="Adding transform · checking schema compat">
          Added a transform stage. Preview updated on the right — new field <span className="mono">revenue_cents: uint64</span> after the filter, before the sink.
        </AIMsgAI>
      </div>

      <AIComposer
        value="Looks right. What's the dedup window? Also show me the raw config."
        suggestions={[
          "Change window to 1 minute",
          "Drop the transform",
          "Show raw config",
          "Deploy now",
        ]}
      />
    </div>

    {/* Right: live preview */}
    <div className="ai-preview">
      <div className="ai-preview-head">
        <h3><Icon name="pipelines" size={13}/> Live preview</h3>
        <div className="ai-preview-tabs">
          <button className="ai-preview-tab is-active">Canvas</button>
          <button className="ai-preview-tab">Summary</button>
          <button className="ai-preview-tab">Raw config</button>
        </div>
        <div style={{flex:1}}/>
        <span className="chip chip-muted"><CIcon name="ai" size={10} color="#b794ff"/> ai draft · not deployed</span>
      </div>

      <div className="ai-preview-body">
        <div style={{position:'absolute', inset:'24px 16px 90px', display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div className="pc-row" style={{transform:'scale(0.82)', transformOrigin:'center', gap:0}}>
            <PCNode type="source" saved aiPlaced
              title="kafka-prod-eu"
              sub="orders.placed.v2"
              body={<span className="pc-schema-chip">OrderEvents v5</span>}
            />
            <PCEdge/>
            <PCNode type="dedup" aiPlaced
              title="Dedup on order_id"
              sub="5-minute window"
              badge="inline"
            />
            <PCEdge/>
            <PCNode type="filter" aiPlaced
              title="EU shipments only"
              sub="shipping_country in EU27"
              badge="inline"
            />
            <PCEdge/>
            <PCNode type="transform" aiPlaced
              title="+ revenue_cents"
              sub="unit_price_cents × quantity"
              badge="inline"
              selected
            />
            <PCEdge/>
            <PCNode type="sink" saved aiPlaced
              title="ch-analytics-prod"
              sub="analytics.orders_eu (new table)"
            />
          </div>
        </div>

        <AISummaryBar
          stats={[
            { icon:"pipelines", k:"stages", v:"5" },
            { icon:"library",   k:"library items", v:"3 reused · 2 inline" },
            { icon:"schema",    k:"schema", v:"OrderEvents v5 pinned" },
          ]}
          actions={<>
            <button className="btn btn-ghost btn-sm"><Icon name="edit" size={12}/> Edit in canvas</button>
            <button className="btn btn-secondary btn-sm"><CIcon name="save" size={12}/> Save as draft</button>
            <button className="btn btn-primary btn-sm" disabled title="Answer the open question first"><CIcon name="rocket" size={12}/> Deploy</button>
          </>}
        />
      </div>
    </div>
  </div>
);

// ============ AI4. COMPLETED — handoff to canvas / deploy ============
const ArtAIComplete = () => (
  <div className="ai-stage">
    <div className="ai-chat">
      <AIChatHead
        title="EU orders + revenue to ClickHouse"
        sub="ready to deploy · 7 messages"
        actions={<button className="btn btn-ghost btn-sm"><Icon name="more" size={12}/></button>}
      />
      <div className="ai-chat-body">
        <AIMsgAI time="1m ago">
          Done — here's what I built:
          <ul style={{margin:'8px 0 0', paddingLeft:18, fontSize:12.5, color:'var(--color-gray-250)', lineHeight:1.7}}>
            <li>Source: <AILibChip icon="kafka" name="kafka-prod-eu"/> on <span className="mono">orders.placed.v2</span></li>
            <li>Dedup: <span className="mono">order_id</span>, 5m window <AIBecause>default you confirmed</AIBecause></li>
            <li>Filter: <span className="mono">shipping_country in EU27</span></li>
            <li>Transform: <span className="mono">+ revenue_cents</span> computed field</li>
            <li>Sink: <AILibChip icon="ch" name="ch-analytics-prod"/> → <span className="mono">analytics.orders_eu</span></li>
          </ul>
        </AIMsgAI>

        <AIMsgAI>
          <div style={{background:'#0e0e12', border:'1px solid var(--color-gray-dark-800)', borderRadius:10, padding:12, marginTop:2}}>
            <div style={{fontSize:11, color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:8}}>Pre-flight checks</div>
            <div style={{display:'flex', flexDirection:'column', gap:4, fontSize:12}}>
              <div style={{display:'flex', gap:8, alignItems:'center', color:'var(--color-green-500)'}}><Icon name="check" size={11}/> Kafka reachable · 12ms</div>
              <div style={{display:'flex', gap:8, alignItems:'center', color:'var(--color-green-500)'}}><Icon name="check" size={11}/> ClickHouse reachable · 180ms p95</div>
              <div style={{display:'flex', gap:8, alignItems:'center', color:'var(--color-green-500)'}}><Icon name="check" size={11}/> Schema → CH mapping · 16/16 fields</div>
              <div style={{display:'flex', gap:8, alignItems:'center', color:'var(--color-green-500)'}}><Icon name="check" size={11}/> No consumer-group conflict</div>
            </div>
          </div>
          <div style={{marginTop:12, fontSize:12.5, color:'var(--color-gray-250)'}}>
            Ready to deploy. You can deploy straight from here, open in canvas to tweak, or keep chatting to refine.
          </div>
        </AIMsgAI>

        <AIMsgUser>Deploy it to staging first.</AIMsgUser>

        <AIMsgAI thinking="Preparing staging deploy">
          I'll mark this as a <strong>staging</strong> pipeline (name prefix <span className="mono">staging-</span>) and point the sink at <span className="mono">analytics_staging.orders_eu</span>. Ready when you are — confirm below, or keep talking.
        </AIMsgAI>
      </div>

      <AIComposer
        value="Also set replicas to 1 for staging. Then go."
        suggestions={[
          "Deploy to staging",
          "Open in canvas instead",
          "Save as draft",
        ]}
      />
    </div>

    <div className="ai-preview">
      <div className="ai-preview-head">
        <h3><Icon name="pipelines" size={13}/> Live preview</h3>
        <div className="ai-preview-tabs">
          <button className="ai-preview-tab">Canvas</button>
          <button className="ai-preview-tab is-active">Summary</button>
          <button className="ai-preview-tab">Raw config</button>
        </div>
        <div style={{flex:1}}/>
        <span className="chip chip-positive"><Icon name="check" size={10}/> ready</span>
      </div>

      <div className="ai-preview-body" style={{padding:'22px 28px', overflow:'auto'}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
          <h4 style={{margin:0, fontFamily:'var(--font-family-title)', fontSize:16, fontWeight:600, color:'var(--color-foreground-neutral)'}}>staging-eu-orders-to-analytics</h4>
          <span className="chip chip-muted">staging</span>
          <span className="chip chip-muted">5 stages</span>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {[
            { icon:"kafka",     name:"kafka-prod-eu",    lib:true,  sub:"topic: orders.placed.v2 · consumer-group: glassflow-staging-eu-orders · schema: OrderEvents v5", why:"Only prod Kafka cluster matching 'orders'" },
            { icon:"dedup",     name:"Dedup",            lib:false, sub:"key: order_id · window: 5m · strategy: first", why:"5m = default for order streams you confirmed" },
            { icon:"filter",    name:"EU shipments",     lib:false, sub:"shipping_country in [AT, BE, BG, …, SE] (EU27)", why:"You chose shipping_country over billing.country" },
            { icon:"transform", name:"+ revenue_cents",  lib:false, sub:"revenue_cents = unit_price_cents × quantity", why:"Requested in message #4" },
            { icon:"ch",        name:"ch-analytics-prod",lib:true,  sub:"db: analytics_staging · table: orders_eu (will be created) · mode: append", why:"Staging deploy → staging db" },
          ].map((r,i)=>(
            <div key={i} style={{display:'grid', gridTemplateColumns:'32px 1fr auto', gap:12, alignItems:'flex-start', padding:'12px 14px', background:'#0e0e13', border:'1px solid var(--color-gray-dark-800)', borderRadius:10}}>
              <div style={{width:28, height:28, borderRadius:6, background:r.lib?'var(--color-orange-alpha-10)':'#17171c', border:r.lib?'1px solid var(--color-orange-alpha-20)':'1px solid var(--color-gray-dark-700)', color:r.lib?'var(--color-orange-300)':'var(--color-gray-dark-100)', display:'grid', placeItems:'center', marginTop:2}}>
                <Icon name={r.icon} size={13}/>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13, fontWeight:500, color:'var(--color-foreground-neutral)', display:'flex', alignItems:'center', gap:6}}>
                  {r.name}
                  {r.lib && <span className="chip chip-muted" style={{fontSize:9}}>from library</span>}
                </div>
                <div style={{fontSize:11, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', marginTop:3, lineHeight:1.5}}>{r.sub}</div>
                <div style={{marginTop:6}}><AIBecause>{r.why}</AIBecause></div>
              </div>
              <button className="btn btn-ghost btn-sm"><Icon name="edit" size={11}/> Change</button>
            </div>
          ))}
        </div>

        <div className="annot" style={{marginTop:16}}>
          <strong>NOTE</strong> Every AI decision has an inline <em>"because …"</em> attribution. Clicking "Change" on any row either jumps back into chat with that row pre-filled, or opens the canvas focused on that node — user choice.
        </div>
      </div>

      <div style={{padding:'14px 20px', borderTop:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:10, background:'#08080b'}}>
        <div style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>
          <Icon name="info" size={10}/> Conversation will be saved to the pipeline so you can continue here later.
        </div>
        <div style={{flex:1}}/>
        <button className="btn btn-ghost btn-sm"><Icon name="edit" size={12}/> Open in canvas</button>
        <button className="btn btn-secondary btn-sm"><CIcon name="save" size={12}/> Save as draft</button>
        <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy to staging</button>
      </div>
    </div>
  </div>
);

Object.assign(window, { ArtAIEntry, ArtAIEmpty, ArtAIMidChat, ArtAIComplete });
