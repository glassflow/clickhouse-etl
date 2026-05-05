// Overview artboards — one-pager covering sitemap, module map, wiring, journeys, out-of-scope modules

// =========================================================
// 1) SITEMAP — every route in the app, color-coded by status
// =========================================================
const ArtOverviewSitemap = () => (
  <div className="ov-page">
    <h1 className="ov-h1">App sitemap</h1>
    <p className="ov-sub">
      Every route planned in the redesigned GlassFlow, grouped by top-level module. Colors indicate where we stand: what exists today, what we're actively redesigning in this work-stream, what's net-new, what's out of scope but sketched so the nav holds together, and what lives in external tools.
    </p>

    <div className="ov-legend">
      <div className="item"><span className="dot exist"/> exists today</div>
      <div className="item"><span className="dot redesign"/> redesigning now</div>
      <div className="item"><span className="dot new"/> new surface</div>
      <div className="item"><span className="dot sketch"/> out of scope · sketched only</div>
      <div className="item"><span className="dot ext"/> external tool</div>
      <div className="item" style={{marginLeft:'auto'}}><span style={{fontSize:9, padding:'1px 5px', background:'rgba(136,96,255,0.15)', color:'#d2b8ff', borderRadius:3, fontWeight:600, letterSpacing:'0.06em'}}>P</span> primary nav</div>
      <div className="item"><span style={{fontSize:9, padding:'1px 5px', background:'var(--color-orange-alpha-10)', color:'var(--color-orange-300)', borderRadius:3, fontWeight:600, letterSpacing:'0.06em'}}>R</span> redesigned surface</div>
      <div className="item"><span style={{fontSize:9, padding:'1px 5px', background:'#18181f', color:'var(--color-gray-dark-500)', borderRadius:3, fontWeight:600, letterSpacing:'0.06em'}}>S</span> stub</div>
    </div>

    <div className="ov-sitemap">
      {/* HOME */}
      <div className="ov-branch">
        <div className="ov-branch-head"><span className="ic"><Icon name="dash" size={12}/></span>Home</div>
        <div className="ov-route is-sketch">/home <span className="q s">S</span></div>
        <div className="ov-sub-routes">
          <div className="ov-route is-sketch">recent pipelines</div>
          <div className="ov-route is-sketch">active incidents</div>
          <div className="ov-route is-sketch">onboarding card</div>
        </div>
      </div>

      {/* PIPELINES */}
      <div className="ov-branch">
        <div className="ov-branch-head"><span className="ic"><Icon name="pipelines" size={12}/></span>Pipelines</div>
        <div className="ov-route is-redesign">/pipelines <span className="q p">P</span></div>
        <div className="ov-sub-routes">
          <div className="ov-route is-redesign">?tab=all</div>
          <div className="ov-route is-redesign">?tab=running</div>
          <div className="ov-route is-redesign">?tab=drafts</div>
          <div className="ov-route is-new">?tab=drift <span className="q r">R</span></div>
        </div>
        <div className="ov-route is-redesign">/pipelines/create</div>
        <div className="ov-sub-routes">
          <div className="ov-route is-new">lane: Ask AI <span className="q r">R</span></div>
          <div className="ov-route is-redesign">lane: Wizard</div>
          <div className="ov-route is-new">lane: Canvas <span className="q r">R</span></div>
          <div className="ov-route is-exist">import config (JSON/YAML)</div>
        </div>
        <div className="ov-route is-redesign">/pipelines/:id</div>
        <div className="ov-sub-routes">
          <div className="ov-route is-redesign">monitor</div>
          <div className="ov-route is-new">canvas <span className="q r">R</span></div>
          <div className="ov-route is-new">library links <span className="q r">R</span></div>
          <div className="ov-route is-new">ai chat history <span className="q r">R</span></div>
          <div className="ov-route is-redesign">logs</div>
          <div className="ov-route is-redesign">metrics</div>
          <div className="ov-route is-redesign">dead letter queue</div>
          <div className="ov-route is-redesign">settings</div>
        </div>
      </div>

      {/* LIBRARY */}
      <div className="ov-branch is-new">
        <div className="ov-branch-head"><span className="ic"><Icon name="library" size={12}/></span>Library</div>
        <div className="ov-route is-new">/library <span className="q p">P</span></div>
        <div className="ov-sub-routes">
          <div className="ov-route is-new">connections</div>
          <div className="ov-route is-new">schemas</div>
          <div className="ov-route is-new">configs · dedup</div>
          <div className="ov-route is-new">configs · filters</div>
          <div className="ov-route is-new">configs · transforms</div>
          <div className="ov-route is-new">folders &amp; tags</div>
        </div>
        <div className="ov-route is-new">/library/:kind/:name</div>
        <div className="ov-sub-routes">
          <div className="ov-route is-new">details · used by</div>
          <div className="ov-route is-new">version history</div>
          <div className="ov-route is-new">roll out · v5 …</div>
          <div className="ov-route is-new">edit</div>
        </div>
      </div>

      {/* OBSERVABILITY */}
      <div className="ov-branch is-sketch">
        <div className="ov-branch-head"><span className="ic"><Icon name="history" size={12}/></span>Observability</div>
        <div className="ov-route is-sketch">/observability <span className="q s">S</span></div>
        <div className="ov-sub-routes">
          <div className="ov-route is-sketch">fleet metrics</div>
          <div className="ov-route is-sketch">logs explorer</div>
          <div className="ov-route is-sketch">dlq explorer</div>
          <div className="ov-route is-sketch">alerts &amp; rules</div>
          <div className="ov-route is-sketch">incidents</div>
        </div>
      </div>

      {/* SETTINGS */}
      <div className="ov-branch is-sketch">
        <div className="ov-branch-head"><span className="ic"><Icon name="dash" size={12}/></span>Workspace</div>
        <div className="ov-route is-sketch">/workspace <span className="q s">S</span></div>
        <div className="ov-sub-routes">
          <div className="ov-route is-sketch">general</div>
          <div className="ov-route is-sketch">team &amp; roles</div>
          <div className="ov-route is-sketch">environments</div>
          <div className="ov-route is-sketch">api keys</div>
          <div className="ov-route is-sketch">audit log</div>
          <div className="ov-route is-sketch">billing</div>
          <div className="ov-route is-sketch">usage</div>
        </div>
      </div>

      {/* ACCOUNT + HELP */}
      <div className="ov-branch is-sketch">
        <div className="ov-branch-head"><span className="ic"><Icon name="help" size={12}/></span>Account · Help</div>
        <div className="ov-route is-exist">/signin</div>
        <div className="ov-route is-exist">/signup</div>
        <div className="ov-route is-sketch">/invite/:token <span className="q s">S</span></div>
        <div className="ov-route is-sketch">/account</div>
        <div className="ov-sub-routes">
          <div className="ov-route is-sketch">profile · notifications</div>
          <div className="ov-route is-sketch">personal tokens</div>
        </div>
        <div className="ov-route is-ext">help center (docs) ↗</div>
        <div className="ov-route is-ext">status page ↗</div>
        <div className="ov-route is-ext">support slack ↗</div>
      </div>
    </div>

    <div className="annot" style={{marginTop:20}}>
      <strong>NOTE</strong> Primary nav is 4 items: <em>Pipelines · Library · Observability · Workspace</em>. Home is optional and low-priority. Create is an action button, not a nav item. Help lives in the avatar menu. Drift gets a dedicated sub-tab on Pipelines so it's findable even when there's no banner.
    </div>
  </div>
);

// =========================================================
// 2) MODULE MAP — each module as a card
// =========================================================
const ArtOverviewModules = () => {
  const Card = ({ icon, name, tag, tagClass, purpose, screens, owner, deps, cls }) => (
    <div className={`ov-module ${cls||''}`}>
      <div className="ov-mod-head">
        <div className="ic"><Icon name={icon} size={15}/></div>
        <h4>{name}</h4>
        <span className={`tag ${tagClass}`}>{tag}</span>
      </div>
      <p className="ov-mod-purpose">{purpose}</p>
      <div className="ov-mod-screens">{screens}</div>
      <div className="ov-mod-foot">
        <span>owner · {owner}</span>
        <div className="sep"/>
        <span>deps · {deps}</span>
      </div>
    </div>
  );

  return (
    <div className="ov-page" style={{paddingTop: 16}}>
      <h1 className="ov-h1">Modules</h1>
      <p className="ov-sub">
        What each module is for, which screens live inside it, and who owns it. Four primary modules drive the product; the rest support them.
      </p>

      <h2 className="ov-section-title">Primary <span className="count">· product core</span></h2>
      <p className="ov-section-sub">Where users spend their time. These are the modules this redesign touches directly.</p>
      <div className="ov-modules">
        <Card
          cls="is-redesign"
          icon="pipelines" name="Pipelines" tag="redesigning" tagClass="redesign"
          purpose="Running streams, drafts, drift. The answer to 'what is deployed right now?' and 'what needs attention?'"
          screens={<>
            <span className="k">/pipelines</span> · list, filters, drift tab<br/>
            <span className="k">/:id/monitor</span> · status, throughput, DLQ<br/>
            <span className="k">/:id/canvas</span> · visual topology<br/>
            <span className="k">/:id/library-links</span> · pinned vs live
          </>}
          owner="pipelines squad" deps="library · obs"
        />
        <Card
          cls="is-new"
          icon="library" name="Library" tag="new" tagClass="new"
          purpose="Schemas, connections, and configs as first-class reusable objects. Versioned where it matters, live where it matters."
          screens={<>
            <span className="k">/library</span> · browse, search, folders<br/>
            <span className="k">/library/schemas/:n</span> · versions, diff<br/>
            <span className="k">/library/connections/:n</span> · blast radius<br/>
            <span className="k">/library/configs/:kind/:n</span>
          </>}
          owner="platform squad" deps="pipelines"
        />
        <Card
          cls="is-redesign"
          icon="edit" name="Canvas" tag="redesigning" tagClass="redesign"
          purpose="Visual pipeline builder. Slot-based insertion, drag-from-library, modal inspectors. The 'expert' authoring lane."
          screens={<>
            <span className="k">create · Canvas lane</span><br/>
            <span className="k">/:id/canvas</span> · view &amp; edit<br/>
            modal inspector per stage<br/>
            deploy / save-as-draft bar
          </>}
          owner="pipelines squad" deps="library · ai"
        />
        <Card
          cls="is-new"
          icon="edit" name="AI assistant" tag="new" tagClass="new"
          purpose="Conversational lane for pipeline creation and (later) refinement. Uses Library. Produces a reviewable draft, never deploys silently."
          screens={<>
            <span className="k">create · Ask AI lane</span><br/>
            chat + live canvas preview<br/>
            attribution summary &amp; pre-flight<br/>
            chat history per pipeline
          </>}
          owner="ai squad" deps="library · canvas · pipelines"
        />
      </div>

      <h2 className="ov-section-title">Supporting <span className="count">· observability &amp; ops</span></h2>
      <p className="ov-section-sub">Not in this redesign round, but sketched so the IA lines up. Some stubs already exist in the current app.</p>
      <div className="ov-modules">
        <Card
          cls="is-sketch"
          icon="history" name="Observability" tag="sketched" tagClass="sketch"
          purpose="Fleet-wide view of what's happening across pipelines: throughput trends, error spikes, DLQ aggregate, alert rules."
          screens={<>
            fleet metrics dashboard<br/>
            logs explorer (all pipelines)<br/>
            dlq explorer &amp; replay<br/>
            alert rules &amp; incidents
          </>}
          owner="ops squad · later" deps="pipelines · external APM"
        />
        <Card
          cls="is-sketch"
          icon="dash" name="Workspace" tag="sketched" tagClass="sketch"
          purpose="Org-level: team members, environments (dev/staging/prod), API keys, audit log, billing."
          screens={<>
            team &amp; roles<br/>
            environments<br/>
            api keys &amp; personal tokens<br/>
            audit log · billing · usage
          </>}
          owner="platform squad · later" deps="auth"
        />
        <Card
          cls="is-sketch"
          icon="help" name="Account &amp; Auth" tag="exists · light polish" tagClass="exist"
          purpose="Sign in, sign up, invitations, profile, notifications. Largely inherited from the existing app."
          screens={<>
            signin · signup · invite<br/>
            profile · notifications<br/>
            avatar menu &amp; workspace switch
          </>}
          owner="platform squad" deps="—"
        />
      </div>

      <h2 className="ov-section-title">External <span className="count">· not in our app</span></h2>
      <p className="ov-section-sub">Links out to the things we don't build. Keeping them on the map so we don't accidentally try to absorb them.</p>
      <div className="ov-modules">
        <Card
          cls="is-ext"
          icon="info" name="Help center" tag="external" tagClass="ext"
          purpose="Docs, tutorials, examples. Lives in a separate docs site. We link to specific pages from empty states and error tooltips."
          screens={<>docs.glassflow.dev ↗<br/>examples gallery ↗<br/>changelog ↗</>}
          owner="dx · docs" deps="—"
        />
        <Card
          cls="is-ext"
          icon="warn" name="Status page" tag="external" tagClass="ext"
          purpose="Public service status. Linked from header when we detect a degraded state, and from support touchpoints."
          screens={<>status.glassflow.dev ↗</>}
          owner="ops" deps="—"
        />
        <Card
          cls="is-ext"
          icon="link" name="Support" tag="external" tagClass="ext"
          purpose="Contact surface: shared Slack for early-access customers, email for everyone else. Not a ticketing system in our app."
          screens={<>help menu → contact<br/>inline 'report a bug' from toasts</>}
          owner="support" deps="—"
        />
      </div>
    </div>
  );
};

// =========================================================
// 3) WIRING — how the 4 primary modules connect
// =========================================================
const ArtOverviewWiring = () => (
  <div className="ov-page" style={{paddingTop: 16}}>
    <h1 className="ov-h1">Cross-module wiring</h1>
    <p className="ov-sub">
      How Library, Canvas, AI, and Pipelines hand off to each other. The arrows name the exact hand-off — this is the connective tissue that makes the four modules feel like one product, not four.
    </p>

    <div className="ov-wire">
      {/* SVG arrows */}
      <svg className="ov-wire-svg" viewBox="0 0 1400 560" preserveAspectRatio="none">
        <defs>
          <marker id="ov-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#6a6a78"/>
          </marker>
          <marker id="ov-arr-orange" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#ff8a3d"/>
          </marker>
          <marker id="ov-arr-purple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#b794ff"/>
          </marker>
        </defs>

        {/* AI → Canvas (top) */}
        <path d="M 380 140 C 520 140, 540 200, 680 200" stroke="#b794ff" strokeWidth="1.3" fill="none" markerEnd="url(#ov-arr-purple)"/>
        <text x="470" y="155">fills canvas with draft</text>

        {/* AI → Library (reads) */}
        <path d="M 280 200 C 280 280, 280 300, 280 360" stroke="#b794ff" strokeWidth="1.3" fill="none" markerEnd="url(#ov-arr-purple)" strokeDasharray="3,3"/>
        <text x="295" y="300">reads · proposes items</text>

        {/* Canvas → Pipelines (deploy) */}
        <path d="M 900 230 C 1020 230, 1060 290, 1180 290" stroke="#ff8a3d" strokeWidth="1.5" fill="none" markerEnd="url(#ov-arr-orange)"/>
        <text x="1000" y="245">deploy · pin library snapshots</text>

        {/* Library → Canvas (drag) */}
        <path d="M 380 420 C 500 420, 560 260, 680 260" stroke="#ff8a3d" strokeWidth="1.3" fill="none" markerEnd="url(#ov-arr-orange)"/>
        <text x="460" y="358">drag into canvas</text>

        {/* Library → Pipelines (drift) */}
        <path d="M 380 440 C 700 440, 900 400, 1180 340" stroke="#ffd23f" strokeWidth="1.3" fill="none" markerEnd="url(#ov-arr)" strokeDasharray="4,4"/>
        <text x="760" y="430">drift signals · upgrade flow</text>

        {/* Pipelines → Canvas (open) */}
        <path d="M 1180 310 C 1060 310, 1020 270, 900 270" stroke="#6a6a78" strokeWidth="1.2" fill="none" markerEnd="url(#ov-arr)"/>
        <text x="980" y="285">'open in canvas' from detail</text>

        {/* Pipelines → AI (resume chat) */}
        <path d="M 1220 280 C 1220 200, 800 140, 380 120" stroke="#b794ff" strokeWidth="1" fill="none" markerEnd="url(#ov-arr-purple)" strokeDasharray="2,4"/>
        <text x="760" y="100">resume AI chat (per pipeline)</text>
      </svg>

      {/* Nodes */}
      <div className="ov-wire-node is-new" style={{top: 64, left: 160}}>
        <div className="head"><div className="ic"><Icon name="edit" size={13}/></div><h5>AI assistant</h5></div>
        <div className="body">
          conversational lane<br/>
          produces reviewable draft<br/>
          library-aware
        </div>
      </div>

      <div className="ov-wire-node is-redesign" style={{top: 204, left: 680}}>
        <div className="head"><div className="ic"><Icon name="edit" size={13}/></div><h5>Canvas</h5></div>
        <div className="body">
          visual builder<br/>
          slot insertion &amp; drag<br/>
          modal inspector · deploy
        </div>
      </div>

      <div className="ov-wire-node is-redesign" style={{top: 290, left: 1180}}>
        <div className="head"><div className="ic"><Icon name="pipelines" size={13}/></div><h5>Pipelines</h5></div>
        <div className="body">
          deployed runtime<br/>
          monitor · DLQ · logs<br/>
          library-links tab · drift
        </div>
      </div>

      <div className="ov-wire-node is-new" style={{top: 360, left: 160}}>
        <div className="head"><div className="ic"><Icon name="library" size={13}/></div><h5>Library</h5></div>
        <div className="body">
          connections · schemas · configs<br/>
          versioned &amp; live<br/>
          blast radius · used-by
        </div>
      </div>
    </div>

    <div className="ov-foot">
      <strong>Key handshakes</strong>
      &nbsp;· AI → Canvas — AI populates canvas nodes; user takes over visually any time
      &nbsp;· Canvas → Pipelines — deploy snapshots library items into the pipeline pin
      &nbsp;· Library ↛ Pipelines (dashed) — new library versions surface as <em>drift</em>, never auto-applied
      &nbsp;· Pipelines ← AI — the conversation is saved per-pipeline so the user can keep refining in chat
    </div>
  </div>
);

// =========================================================
// 4) JOURNEYS — 5 end-to-end flows
// =========================================================
const ArtOverviewJourneys = () => {
  const Step = ({ mod, modCls, title, sub }) => (
    <div className="ov-step">
      <div className={`ov-step-mod ${modCls}`}><span style={{width:6, height:6, borderRadius:99, background:'currentColor', display:'inline-block'}}/> {mod}</div>
      <div className="ov-step-title">{title}</div>
      <div className="ov-step-sub">{sub}</div>
    </div>
  );
  const Journey = ({ num, title, persona, steps, children }) => (
    <div className="ov-journey">
      <div className="ov-journey-head">
        <div className="num">{num}</div>
        <h4>{title}</h4>
        <span className="persona">{persona}</span>
      </div>
      <div className="ov-journey-steps" style={{"--steps": steps}}>{children}</div>
    </div>
  );

  return (
    <div className="ov-page" style={{paddingTop: 16}}>
      <h1 className="ov-h1">Key user journeys</h1>
      <p className="ov-sub">
        Five end-to-end flows, each one a strip of cards that names the module at every step. If any of these breaks at a seam, the redesign has failed — these are the smoke tests.
      </p>

      <Journey num="J1" title="First pipeline — AI lane" persona="developer · first-time user" steps={6}>
        <Step mod="pipelines" modCls="pipes" title="Click Create" sub="from empty Pipelines list"/>
        <Step mod="create" modCls="pipes" title="Pick Ask AI" sub="recommended tile"/>
        <Step mod="ai" modCls="ai" title="Describe pipeline" sub="'orders to CH, dedupe, EU only'"/>
        <Step mod="ai" modCls="ai" title="Answer 1–2 questions" sub="EU27 shipping vs billing · library pick"/>
        <Step mod="ai" modCls="ai" title="Review summary" sub="attribution · pre-flight checks"/>
        <Step mod="pipelines" modCls="pipes" title="Deploy to staging" sub="pinned snapshot · chat saved"/>
      </Journey>

      <Journey num="J2" title="Schema change — rolled out without breaking prod" persona="platform eng · week 3" steps={6}>
        <Step mod="library" modCls="library" title="Edit OrderEvents" sub="adds discount_code (optional)"/>
        <Step mod="library" modCls="library" title="Publish v5" sub="compatible with v4 · 5 pipelines pinned"/>
        <Step mod="library" modCls="library" title="Open 'Roll out v5…'" sub="from schema detail"/>
        <Step mod="bridge" modCls="bridge" title="Pick staged strategy" sub="dev → staging → prod · auto-rollback"/>
        <Step mod="bridge" modCls="bridge" title="Per-stage verify" sub="error rate &lt; 0.1% · auto-advance"/>
        <Step mod="pipelines" modCls="pipes" title="Drift tab clears" sub="all 5 on v5 · audit log entry"/>
      </Journey>

      <Journey num="J3" title="Rotate Kafka credentials — always-live, no pin" persona="platform eng · emergency" steps={5}>
        <Step mod="library" modCls="library" title="Open kafka-prod-eu" sub="used by 9 pipelines"/>
        <Step mod="library" modCls="library" title="Paste new password" sub="blast radius: 9 pipelines"/>
        <Step mod="library" modCls="library" title="Confirm change" sub="no type-to-confirm (not destructive)"/>
        <Step mod="pipelines" modCls="pipes" title="Reconnect on next event" sub="visible in monitor · ~3s"/>
        <Step mod="obs" modCls="obs" title="Watch error rate" sub="fleet dashboard · should stay flat"/>
      </Journey>

      <Journey num="J4" title="Debug dead letters" persona="product eng · monday morning" steps={6}>
        <Step mod="pipelines" modCls="pipes" title="Notice DLQ counter" sub="from pipelines list"/>
        <Step mod="pipelines" modCls="pipes" title="Open Monitor tab" sub="DLQ: 142 uncosumed"/>
        <Step mod="pipelines" modCls="pipes" title="Inspect samples" sub="'discount_code missing' · 120×"/>
        <Step mod="library" modCls="library" title="Check schema" sub="v4 vs producer's v5 · producer drifted"/>
        <Step mod="pipelines" modCls="pipes" title="Upgrade to v5" sub="one click from library-links tab"/>
        <Step mod="pipelines" modCls="pipes" title="Replay DLQ" sub="from monitor · new schema maps"/>
      </Journey>

      <Journey num="J5" title="Invite teammate · review their draft" persona="staff eng · onboarding colleague" steps={5}>
        <Step mod="workspace" modCls="ext" title="Invite by email" sub="workspace → team · sketched"/>
        <Step mod="ext" modCls="ext" title="Teammate accepts" sub="email → signup flow"/>
        <Step mod="ai" modCls="ai" title="Teammate drafts in AI" sub="saves as ai-draft"/>
        <Step mod="pipelines" modCls="pipes" title="Reviewer opens" sub="from drafts tab · sees chat + summary"/>
        <Step mod="canvas" modCls="canvas" title="Tweak &amp; deploy" sub="opens in canvas · tweaks window · deploys"/>
      </Journey>

      <div className="annot" style={{marginTop: 20}}>
        <strong>NOTE</strong> Every journey crosses at least two modules. J2 and J4 are the "bridge" tests — they validate that Library ↔ Pipelines drift flow actually holds up. J5 is the team/collab smoke test — it should work end-to-end even if most of Workspace is a stub.
      </div>
    </div>
  );
};

// =========================================================
// 5) OUT-OF-SCOPE — sketches of modules we didn't design
// =========================================================
const ArtOverviewOutOfScope = () => (
  <div className="ov-page" style={{paddingTop: 16}}>
    <h1 className="ov-h1">Out-of-scope modules · sketches</h1>
    <p className="ov-sub">
      These modules aren't part of this redesign round, but the nav, permissions, and data model assume they exist. These thumbnails are a placeholder contract — when each gets picked up, it should look something like this and land at the listed route.
    </p>

    <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16}}>
      {/* OBSERVABILITY */}
      <div className="ov-module is-sketch" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'14px 18px', borderBottom:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:28, height:28, borderRadius:6, background:'#14141a', border:'1px solid var(--color-gray-dark-700)', color:'var(--color-gray-dark-500)', display:'grid', placeItems:'center'}}><Icon name="history" size={14}/></div>
          <div>
            <div style={{fontFamily:'var(--font-family-title)', fontSize:13, fontWeight:600, color:'var(--color-foreground-neutral)'}}>Observability</div>
            <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--color-gray-dark-500)'}}>/observability</div>
          </div>
        </div>
        <div style={{padding:16, display:'flex', flexDirection:'column', gap:10}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            {["events/sec","error rate","lag p95","dlq rate"].map((k,i)=>(
              <div key={i} style={{padding:'8px 10px', background:'#0a0a0d', border:'1px dashed var(--color-gray-dark-700)', borderRadius:6}}>
                <div style={{fontSize:9, color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em'}}>{k}</div>
                <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:13, color:'var(--color-gray-dark-100)', marginTop:2}}>—</div>
                <svg viewBox="0 0 100 20" style={{marginTop:4, width:'100%', height:14}}>
                  <polyline points={`0,${10+i*2} 20,${8-i} 40,${14-i*2} 60,${6+i} 80,${12-i*2} 100,${8+i}`} fill="none" stroke="var(--color-gray-dark-500)" strokeWidth="1"/>
                </svg>
              </div>
            ))}
          </div>
          <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', lineHeight:1.55}}>
            fleet metrics · logs explorer<br/>
            dlq aggregate · alert rules
          </div>
          <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', padding:'8px 10px', background:'#0a0a0d', borderRadius:6, border:'1px dashed var(--color-gray-dark-700)'}}>
            Q: Does this wrap an external APM (Datadog/Grafana) or is it GlassFlow-native?
          </div>
        </div>
      </div>

      {/* WORKSPACE/TEAM */}
      <div className="ov-module is-sketch" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'14px 18px', borderBottom:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:28, height:28, borderRadius:6, background:'#14141a', border:'1px solid var(--color-gray-dark-700)', color:'var(--color-gray-dark-500)', display:'grid', placeItems:'center'}}><Icon name="dash" size={14}/></div>
          <div>
            <div style={{fontFamily:'var(--font-family-title)', fontSize:13, fontWeight:600, color:'var(--color-foreground-neutral)'}}>Workspace · Team</div>
            <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--color-gray-dark-500)'}}>/workspace/team</div>
          </div>
        </div>
        <div style={{padding:16, display:'flex', flexDirection:'column', gap:6}}>
          {[
            ["Vincent Co", "owner", "vincent.co@glassflow.dev"],
            ["Maya Li", "admin", "maya.li@glassflow.dev"],
            ["commerce-team", "team · 4 members", "—"],
            ["payments-team", "team · 2 members", "—"],
          ].map((r,i)=>(
            <div key={i} style={{display:'grid', gridTemplateColumns:'24px 1fr auto', gap:8, alignItems:'center', padding:'6px 8px', background:'#0a0a0d', border:'1px dashed var(--color-gray-dark-800)', borderRadius:6}}>
              <div style={{width:20, height:20, borderRadius:99, background:'#18181f', color:'var(--color-gray-dark-500)', display:'grid', placeItems:'center', fontSize:9, fontFamily:'JetBrains Mono, monospace'}}>{r[0].split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
              <div>
                <div style={{fontSize:11, color:'var(--color-foreground-neutral)', fontWeight:500}}>{r[0]}</div>
                <div style={{fontSize:10, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>{r[2]}</div>
              </div>
              <div style={{fontSize:10, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>{r[1]}</div>
            </div>
          ))}
          <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', padding:'8px 10px', background:'#0a0a0d', borderRadius:6, border:'1px dashed var(--color-gray-dark-700)', marginTop:4}}>
            Q: Are teams a hard ownership boundary or just filters? Impacts blast-radius display.
          </div>
        </div>
      </div>

      {/* ENVIRONMENTS */}
      <div className="ov-module is-sketch" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'14px 18px', borderBottom:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:28, height:28, borderRadius:6, background:'#14141a', border:'1px solid var(--color-gray-dark-700)', color:'var(--color-gray-dark-500)', display:'grid', placeItems:'center'}}><Icon name="dash" size={14}/></div>
          <div>
            <div style={{fontFamily:'var(--font-family-title)', fontSize:13, fontWeight:600, color:'var(--color-foreground-neutral)'}}>Environments</div>
            <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--color-gray-dark-500)'}}>/workspace/environments</div>
          </div>
        </div>
        <div style={{padding:16, display:'flex', flexDirection:'column', gap:6}}>
          {[
            ["dev", "6 pipelines", "free tier"],
            ["staging", "8 pipelines", "standard"],
            ["prod", "10 pipelines", "production"],
          ].map((r,i)=>(
            <div key={i} style={{display:'grid', gridTemplateColumns:'60px 1fr auto', gap:10, padding:'10px 12px', background:'#0a0a0d', border:'1px dashed var(--color-gray-dark-800)', borderRadius:6, alignItems:'center'}}>
              <div style={{fontSize:11, color:'var(--color-foreground-neutral)', fontFamily:'JetBrains Mono, monospace', fontWeight:600}}>{r[0]}</div>
              <div style={{fontSize:10, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>{r[1]}</div>
              <div style={{fontSize:10, color:'var(--color-gray-dark-500)'}}>{r[2]}</div>
            </div>
          ))}
          <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', padding:'8px 10px', background:'#0a0a0d', borderRadius:6, border:'1px dashed var(--color-gray-dark-700)', marginTop:4}}>
            Env tag appears on every pipeline already — but no route to manage them yet.
          </div>
        </div>
      </div>

      {/* BILLING */}
      <div className="ov-module is-sketch" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'14px 18px', borderBottom:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:28, height:28, borderRadius:6, background:'#14141a', border:'1px solid var(--color-gray-dark-700)', color:'var(--color-gray-dark-500)', display:'grid', placeItems:'center'}}><Icon name="dash" size={14}/></div>
          <div>
            <div style={{fontFamily:'var(--font-family-title)', fontSize:13, fontWeight:600, color:'var(--color-foreground-neutral)'}}>Billing · Usage</div>
            <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--color-gray-dark-500)'}}>/workspace/billing</div>
          </div>
        </div>
        <div style={{padding:16, display:'flex', flexDirection:'column', gap:10}}>
          <div style={{padding:'10px 12px', background:'#0a0a0d', border:'1px dashed var(--color-gray-dark-800)', borderRadius:6}}>
            <div style={{fontSize:9, color:'var(--color-gray-dark-500)', textTransform:'uppercase', letterSpacing:'0.06em'}}>this month · events processed</div>
            <div style={{fontSize:18, color:'var(--color-foreground-neutral)', fontFamily:'JetBrains Mono, monospace', fontWeight:600, marginTop:4}}>24.1M <span style={{fontSize:10, color:'var(--color-gray-dark-500)', fontWeight:400}}>/ 50M plan</span></div>
            <div style={{marginTop:8, height:5, background:'#14141a', borderRadius:3, overflow:'hidden'}}><div style={{width:'48%', height:'100%', background:'var(--color-gray-dark-500)'}}/></div>
          </div>
          <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', lineHeight:1.55}}>
            plan · invoices · payment method<br/>
            usage drill-down by pipeline
          </div>
          <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', padding:'8px 10px', background:'#0a0a0d', borderRadius:6, border:'1px dashed var(--color-gray-dark-700)'}}>
            Q: Usage unit — events, GB, or pipeline-hours? Not decided yet.
          </div>
        </div>
      </div>

      {/* API KEYS */}
      <div className="ov-module is-sketch" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'14px 18px', borderBottom:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:28, height:28, borderRadius:6, background:'#14141a', border:'1px solid var(--color-gray-dark-700)', color:'var(--color-gray-dark-500)', display:'grid', placeItems:'center'}}><Icon name="link" size={14}/></div>
          <div>
            <div style={{fontFamily:'var(--font-family-title)', fontSize:13, fontWeight:600, color:'var(--color-foreground-neutral)'}}>API keys</div>
            <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--color-gray-dark-500)'}}>/workspace/api-keys</div>
          </div>
        </div>
        <div style={{padding:16, display:'flex', flexDirection:'column', gap:6}}>
          {[
            ["ci-cd", "gf_sk_••••••••••••a4f1", "all"],
            ["terraform-prod", "gf_sk_••••••••••••7b20", "prod read/write"],
            ["readonly-monitoring", "gf_sk_••••••••••••c902", "read"],
          ].map((r,i)=>(
            <div key={i} style={{display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, padding:'8px 10px', background:'#0a0a0d', border:'1px dashed var(--color-gray-dark-800)', borderRadius:6, alignItems:'center'}}>
              <div style={{fontSize:11, color:'var(--color-foreground-neutral)', fontWeight:500}}>{r[0]}</div>
              <div style={{fontSize:10, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>{r[1]}</div>
              <div style={{fontSize:10, color:'var(--color-gray-dark-500)'}}>{r[2]}</div>
            </div>
          ))}
          <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', padding:'8px 10px', background:'#0a0a0d', borderRadius:6, border:'1px dashed var(--color-gray-dark-700)', marginTop:4}}>
            Personal tokens live on /account · workspace keys here.
          </div>
        </div>
      </div>

      {/* AUDIT LOG */}
      <div className="ov-module is-sketch" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'14px 18px', borderBottom:'1px solid var(--color-gray-dark-800)', display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:28, height:28, borderRadius:6, background:'#14141a', border:'1px solid var(--color-gray-dark-700)', color:'var(--color-gray-dark-500)', display:'grid', placeItems:'center'}}><Icon name="history" size={14}/></div>
          <div>
            <div style={{fontFamily:'var(--font-family-title)', fontSize:13, fontWeight:600, color:'var(--color-foreground-neutral)'}}>Audit log</div>
            <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--color-gray-dark-500)'}}>/workspace/audit</div>
          </div>
        </div>
        <div style={{padding:16, display:'flex', flexDirection:'column', gap:6}}>
          {[
            ["vincent.co", "deployed prod-orders-to-analytics", "11m ago"],
            ["maya.li", "published OrderEvents v5", "2h ago"],
            ["vincent.co", "rotated kafka-prod-eu creds", "yesterday"],
            ["ci-cd token", "upgraded 5 pipelines → OrderEvents v5", "yesterday"],
          ].map((r,i)=>(
            <div key={i} style={{display:'grid', gridTemplateColumns:'80px 1fr auto', gap:8, padding:'6px 8px', background:'#0a0a0d', border:'1px dashed var(--color-gray-dark-800)', borderRadius:6, alignItems:'center'}}>
              <div style={{fontSize:10, color:'var(--color-gray-dark-100)', fontFamily:'JetBrains Mono, monospace'}}>{r[0]}</div>
              <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)'}}>{r[1]}</div>
              <div style={{fontSize:9.5, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>{r[2]}</div>
            </div>
          ))}
          <div style={{fontSize:10.5, color:'var(--color-gray-dark-500)', padding:'8px 10px', background:'#0a0a0d', borderRadius:6, border:'1px dashed var(--color-gray-dark-700)', marginTop:4}}>
            Populated automatically by Library &amp; Pipelines actions — no code needed there.
          </div>
        </div>
      </div>
    </div>

    <div className="ov-foot">
      <strong>Commitment</strong> The redesign needs these modules to at least <em>exist as routes</em> so breadcrumbs and nav don't dead-end. None of them need full designs to ship what we're building now — but without them the product graph has holes.
    </div>
  </div>
);

Object.assign(window, {
  ArtOverviewSitemap, ArtOverviewModules, ArtOverviewWiring,
  ArtOverviewJourneys, ArtOverviewOutOfScope,
});
