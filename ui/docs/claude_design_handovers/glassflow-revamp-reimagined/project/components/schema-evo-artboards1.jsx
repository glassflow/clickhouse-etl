// Schema Evolution artboards — part 1 of 2 (artboards 1, 2, 3)
// T-06 · Phase B Recovery surface

const { useState: seUseState } = React;

// =====================================================================
// LOCAL PRIMITIVES
// =====================================================================

const SECrumbs = ({ scope }) => (
  <div className="se-crumbs">
    <Icon name="library" size={12}/>
    <a>Library</a>
    <Icon name="chevR" size={10}/>
    <a>Schemas</a>
    <Icon name="chevR" size={10}/>
    <a>orders.events</a>
    <Icon name="chevR" size={10}/>
    <strong>Evolution</strong>
    {scope && (<><span style={{opacity:0.4}}>·</span><span style={{color:'var(--color-gray-dark-500)'}}>{scope}</span></>)}
  </div>
);

const SETitleRow = ({ title, meta, right }) => (
  <div className="se-titlerow">
    <h1>{title}</h1>
    {meta && <span className="meta">{meta}</span>}
    <div className="spacer"/>
    {right}
  </div>
);

const SEStepBar = ({ active }) => {
  const steps = [
    { id: 'review', n: 1, label: 'Review change' },
    { id: 'impact', n: 2, label: 'Impact analysis' },
    { id: 'plan',   n: 3, label: 'Migration plan' },
    { id: 'cutover',n: 4, label: 'Cutover' },
    { id: 'verify', n: 5, label: 'Verify' },
  ];
  const aIdx = steps.findIndex(s => s.id === active);
  return (
    <div className="se-steps">
      {steps.map((s, i) => (
        <div key={s.id} className={`se-step ${i===aIdx?'is-active':''} ${i<aIdx?'is-done':''}`}>
          <span className="num">{i<aIdx ? '✓' : s.n}</span>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
};

const SEModeToggle = ({ mode = 'express' }) => (
  <div className="se-mode">
    <label className={mode==='express'?'is-on':''}><span className="dot"/>Express · AI-led</label>
    <label className={mode==='manual'?'is-on':''}><span className="dot"/>Manual</label>
  </div>
);

const SEBtn = ({ kind = 'secondary', children, icon, danger, dim }) => (
  <button className={`btn btn-${kind} ${danger?'btn-danger-ghost':''}`} style={{opacity: dim?0.6:1, fontSize: 12}}>
    {icon && <Icon name={icon} size={12}/>}
    {children}
  </button>
);

const SEBreakBadge = ({ kind = 'bk', children }) => (
  <span className={`se-break-badge ${kind}`}>{children}</span>
);

const SESummaryChips = ({ items }) => (
  <div className="se-summary-chips">
    {items.map((c,i) => (
      <span key={i} className={`se-summary-chip ${c.tone||''}`}>
        <span className="num">{c.n}</span> {c.label}
      </span>
    ))}
  </div>
);

const SEStat = ({ label, value, unit, tone, delta, deltaTone }) => (
  <div className="se-stat">
    <div className="lbl">{label}</div>
    <div className={`val ${tone||''}`}>{value}{unit && <span className="unit">{unit}</span>}</div>
    {delta && <div className={`delta ${deltaTone||'flat'}`}>{delta}</div>}
  </div>
);

const SEAiSidebar = ({ messages, footer = "ask anything · enter to send" }) => (
  <div className="se-ai" style={{height:'100%'}}>
    <div className="se-ai-head">
      <div className="badge">AI</div>
      <h4>Migration assistant</h4>
      <span className="right">claude · haiku</span>
    </div>
    <div style={{flex:1, overflow:'auto'}}>
      {messages.map((m,i) => (
        <div key={i} className={`se-ai-msg ${m.who}`}>
          <div className="who">{m.who === 'ai' ? '◇ Assistant' : '◆ You'}</div>
          <div className="body">{m.body}</div>
          {m.actions && (
            <div className="actions">
              {m.actions.map((a, j) => <SEBtn key={j} kind={a.kind||'secondary'}>{a.label}</SEBtn>)}
            </div>
          )}
        </div>
      ))}
    </div>
    <div className="se-ai-input">
      <Icon name="sparkles" size={12} color="var(--color-orange-300)"/>
      <span>{footer}</span>
      <span style={{flex:1}}/>
      <span style={{opacity:0.6}}>↵</span>
    </div>
  </div>
);

Object.assign(window, {
  SECrumbs, SETitleRow, SEStepBar, SEModeToggle, SEBtn,
  SEBreakBadge, SESummaryChips, SEStat, SEAiSidebar
});

// =====================================================================
// ARTBOARD 1 · Entry hub
// "Schema change detected" — shows where this surface gets entered
// =====================================================================

const ArtSEHub = () => (
  <div className="se-page">
    <AppShell activeNav="library">
      <div className="se-inner">
        <SECrumbs/>
        <SETitleRow
          title="Schema change detected"
          meta="orders.events · v3 → v4 · proposed"
          right={<>
            <SEBtn kind="secondary" icon="x">Dismiss</SEBtn>
            <SEBtn kind="primary" icon="play">Start migration</SEBtn>
          </>}
        />
        <p className="se-sub">
          A new schema version was registered upstream. GlassFlow has analysed the change and surfaces this hub
          whenever a schema edit could break a live pipeline. From here you can review the diff, see what breaks,
          and let the migration assistant draft a safe roll-out plan.
        </p>

        {/* Hero alert */}
        <div className="se-hero">
          <div>
            <div className="lead">
              <span className="badge">3 breaking · 1 warning</span>
              <SESummaryChips items={[
                { n: 3, label: 'breaking', tone: 'bk' },
                { n: 1, label: 'narrowing', tone: 'warn' },
                { n: 2, label: 'safe', tone: 'safe' },
              ]}/>
            </div>
            <h2>orders.events <span style={{color:'var(--color-gray-dark-500)', fontWeight:400}}>· v3 → v4</span></h2>
            <p className="body">
              4 fields changed across <strong style={{color:'var(--color-foreground-neutral)'}}>7 pipelines</strong>.
              The change adds <em style={{color:'var(--color-green-500)', fontStyle:'normal'}}>region</em> as required,
              renames <em style={{color:'var(--color-yellow-400)', fontStyle:'normal'}}>user_id → customer_id</em>,
              and tightens <em style={{color:'var(--color-yellow-400)', fontStyle:'normal'}}>amount</em> from string to decimal(12,2).
            </p>
            <div className="ai-line">
              <strong>◇ Assistant</strong> — Without migration, ~78% of in-flight events will land in the DLQ.
              I can draft a 4-step plan that adds <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-foreground-neutral)'}}>region</code> with a default,
              dual-writes <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-foreground-neutral)'}}>customer_id</code> alongside the old field for 24h,
              and rolls forward with a 10% canary. Estimated rollout: <strong>~38 min</strong>.
            </div>
          </div>
          <div className="actions">
            <SEModeToggle mode="express"/>
            <SEBtn kind="primary" icon="sparkles">Draft plan</SEBtn>
            <SEBtn kind="secondary">Review diff first</SEBtn>
            <span style={{fontSize:11, color:'var(--color-gray-dark-500)', textAlign:'right'}}>or skim Bridge to see linkage</span>
          </div>
        </div>

        {/* Entry sources */}
        <h3 style={{margin:'14px 0 12px', fontSize:13, fontWeight:500, color:'var(--color-gray-dark-100)', textTransform:'uppercase', letterSpacing:'0.06em'}}>
          How users land here
        </h3>
        <div className="se-entries">
          <div className="se-entry is-active">
            <div className="head">
              <Icon name="warning" size={14} color="var(--color-orange-300)"/>
              <span className="src">From DLQ</span>
            </div>
            <h4>Failed messages clustered to schema mismatch</h4>
            <p>
              When the DLQ inspector spots that a cluster's root cause is a schema field change, it links the
              user here with the offending fields pre-selected.
            </p>
            <div className="foot">
              <span>2,194 messages · cluster #C-21</span>
              <Icon name="chevR" size={10}/>
            </div>
          </div>
          <div className="se-entry">
            <div className="head">
              <Icon name="bell" size={14} color="var(--color-yellow-400)"/>
              <span className="src">Proactive alert</span>
            </div>
            <h4>Inbox notification: breaking change registered</h4>
            <p>
              Bridge watches the schema registry. When a producer registers a new version that diffs against any
              live pinned version, an inbox card appears within seconds.
            </p>
            <div className="foot" style={{color:'var(--color-yellow-400)'}}>
              <span>Pre-emptive · no failures yet</span>
              <Icon name="chevR" size={10}/>
            </div>
          </div>
          <div className="se-entry">
            <div className="head">
              <Icon name="library" size={14} color="var(--color-blue-500)"/>
              <span className="src">From Library</span>
            </div>
            <h4>Author registers a new version manually</h4>
            <p>
              From the schema's detail page, "Register new version" dry-runs a diff and offers to launch this
              flow in dry-run mode before publishing.
            </p>
            <div className="foot" style={{color:'var(--color-blue-500)'}}>
              <span>Pre-publish · dry-run only</span>
              <Icon name="chevR" size={10}/>
            </div>
          </div>
        </div>

        {/* Quick context: who's affected */}
        <div className="se-grid">
          <div className="se-card tight">
            <div className="se-card-head">
              <h3>Affected pipelines</h3>
              <span className="meta">7 of 23 use this schema</span>
              <div style={{flex:1}}/>
              <a style={{fontSize:11, color:'var(--color-orange-300)', cursor:'pointer'}}>Open in Bridge →</a>
            </div>
            <div className="br-blast">
              <div className="br-blast-rows">
                {[
                  { n: 'orders-enrich-checkout', o: 'team:checkout', sev: 'breaking', why: 'reads renamed user_id' },
                  { n: 'orders-fanout-fraud',     o: 'team:risk',     sev: 'breaking', why: 'reads removed legacy_total' },
                  { n: 'orders-to-warehouse',     o: 'team:data',     sev: 'breaking', why: 'CH sink schema mismatch on amount' },
                  { n: 'orders-metrics-1m',       o: 'team:platform', sev: 'narrow',   why: 'amount cast string→decimal narrows precision' },
                  { n: 'orders-archive',          o: 'team:platform', sev: 'safe',     why: 'passthrough — no field reads' },
                  { n: 'orders-audit-replay',     o: 'team:risk',     sev: 'safe',     why: 'consumes raw bytes only' },
                  { n: 'orders-dedup-1m',         o: 'team:platform', sev: 'safe',     why: 'keys on order_id, unaffected' },
                ].map((r,i) => (
                  <div key={i} className={`br-blast-row ${r.sev==='breaking'?'breaking':''}`}>
                    <span className={`br-pip-dot br-pip-${r.sev==='breaking'?'error': r.sev==='narrow'?'draft':'running'}`} style={{width:8, height:8, borderRadius:'50%'}}/>
                    <div>
                      <div className="br-blast-name">{r.n}</div>
                      <div className="br-blast-owner">{r.o}</div>
                    </div>
                    <span className={`chip ${r.sev==='breaking'?'chip-critical': r.sev==='narrow'?'chip-warning':'chip-positive'}`} style={{fontSize:10}}>
                      {r.sev}
                    </span>
                    <div className="br-blast-effect" style={{gridColumn:'span 2'}}>{r.why}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="se-card">
            <div className="se-card-head" style={{padding:0, borderBottom:'none', marginBottom:12}}>
              <h3>Why now?</h3>
            </div>
            <p style={{margin:'0 0 10px', fontSize:12.5, color:'var(--color-gray-dark-100)', lineHeight:1.6}}>
              The producer service <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-orange-300)'}}>checkout-api</code> registered <strong style={{color:'var(--color-foreground-neutral)'}}>v4</strong> at <strong style={{color:'var(--color-foreground-neutral)'}}>14:21 UTC</strong>.
              Pinned consumers stay on v3 until you migrate.
            </p>
            <div style={{padding:'10px 12px', background:'#050507', borderRadius:8, border:'1px solid var(--color-gray-dark-800)', fontFamily:'JetBrains Mono, monospace', fontSize:11.5, color:'var(--color-gray-dark-100)', lineHeight:1.6}}>
              <div><span style={{color:'var(--color-gray-dark-500)'}}>registered_by</span> alex@checkout.team</div>
              <div><span style={{color:'var(--color-gray-dark-500)'}}>commit</span> <span style={{color:'var(--color-orange-300)'}}>a8c14e2</span></div>
              <div><span style={{color:'var(--color-gray-dark-500)'}}>message</span> "add region for fraud routing"</div>
              <div><span style={{color:'var(--color-gray-dark-500)'}}>compatible</span> <span style={{color:'var(--color-red-500)'}}>NO</span> <span style={{color:'var(--color-gray-dark-500)'}}>(BACKWARD-incompat)</span></div>
            </div>
            <div style={{marginTop:14, fontSize:11.5, color:'var(--color-gray-dark-500)', lineHeight:1.6}}>
              GlassFlow runs schema linting on registration but does not auto-block;
              the producer team can ship a breaking change, and it's your job (and ours) to migrate consumers safely.
            </div>
          </div>
        </div>

        <Annot>
          T-06 entry hub. Three legitimate ways in (DLQ, inbox alert, Library author).
          Hero summarises change in one sentence, AI line names the migration shape so users can decide
          before clicking deeper. Affected-pipelines list is the same Bridge primitive used elsewhere.
        </Annot>
      </div>
    </AppShell>
  </div>
);

// =====================================================================
// ARTBOARD 2 · Diff viewer (side-by-side)
// =====================================================================

const ArtSEDiff = () => (
  <div className="se-page">
    <AppShell activeNav="library">
      <div className="se-inner">
        <SECrumbs scope="diff"/>
        <SETitleRow
          title="Review change"
          meta="orders.events · v3 → v4"
          right={<>
            <SEBtn kind="secondary" icon="copy">Copy diff</SEBtn>
            <SEBtn kind="secondary">Cancel</SEBtn>
            <SEBtn kind="primary" icon="chevR">Continue to impact</SEBtn>
          </>}
        />
        <SEStepBar active="review"/>

        <div className="se-stats">
          <SEStat label="Fields added" value="1" tone="green"/>
          <SEStat label="Fields renamed" value="1" tone="orange"/>
          <SEStat label="Type changes" value="1" tone="orange"/>
          <SEStat label="Fields removed" value="1" tone="red"/>
        </div>

        <div className="se-grid" style={{gridTemplateColumns:'1.7fr 1fr'}}>
          {/* Left: diff */}
          <div className="se-card tight">
            <div className="se-card-head">
              <h3>Field-by-field diff</h3>
              <span style={{flex:1}}/>
              <span className="chip" style={{fontSize:10, padding:'2px 8px', background:'var(--color-gray-dark-800)', color:'var(--color-gray-dark-100)'}}>protobuf</span>
              <span className="meta">orders.events</span>
            </div>
            <div className="se-diff-wrap">
              <div className="se-diff-side before">
                <div className="header">
                  v <span className="v">v3</span>
                  <span className="right">live · pinned by 7 pipelines</span>
                </div>
                <div className="se-fields">
                  <div className="se-field">
                    <span className="gut"> </span>
                    <span><span className="name">order_id</span> <span className="type">string</span></span>
                    <span className="req">required</span>
                  </div>
                  <div className="se-field is-rename">
                    <span className="gut">~</span>
                    <span><span className="name">user_id</span> <span className="type">string</span></span>
                    <span className="req">required</span>
                  </div>
                  <div className="se-field is-typechange">
                    <span className="gut">~</span>
                    <span><span className="name">amount</span> <span className="type"><s>string</s></span></span>
                    <span className="req">required</span>
                  </div>
                  <div className="se-field">
                    <span className="gut"> </span>
                    <span><span className="name">currency</span> <span className="type">string(3)</span></span>
                    <span className="req">required</span>
                  </div>
                  <div className="se-field is-remove">
                    <span className="gut">−</span>
                    <span><span className="name">legacy_total</span> <span className="type">string</span></span>
                    <span className="req">optional</span>
                  </div>
                  <div className="se-field">
                    <span className="gut"> </span>
                    <span><span className="name">created_at</span> <span className="type">timestamp</span></span>
                    <span className="req">required</span>
                  </div>
                </div>
              </div>
              <div className="se-diff-side after">
                <div className="header">
                  v <span className="v">v4</span>
                  <span className="right">proposed · 14:21 UTC</span>
                </div>
                <div className="se-fields">
                  <div className="se-field">
                    <span className="gut"> </span>
                    <span><span className="name">order_id</span> <span className="type">string</span></span>
                    <span className="req">required</span>
                  </div>
                  <div className="se-field is-rename">
                    <span className="gut">~</span>
                    <span><span className="name">customer_id</span> <span className="type">string</span> <SEBreakBadge kind="bk">renamed from user_id</SEBreakBadge></span>
                    <span className="req">required</span>
                  </div>
                  <div className="se-field is-typechange">
                    <span className="gut">~</span>
                    <span><span className="name">amount</span> <span className="type"><b>decimal(12,2)</b></span> <SEBreakBadge kind="warn">narrows</SEBreakBadge></span>
                    <span className="req">required</span>
                  </div>
                  <div className="se-field">
                    <span className="gut"> </span>
                    <span><span className="name">currency</span> <span className="type">string(3)</span></span>
                    <span className="req">required</span>
                  </div>
                  <div className="se-field is-add">
                    <span className="gut">+</span>
                    <span><span className="name">region</span> <span className="type">string</span> <SEBreakBadge kind="bk">required, no default</SEBreakBadge></span>
                    <span className="req">required</span>
                  </div>
                  <div className="se-field">
                    <span className="gut"> </span>
                    <span><span className="name">created_at</span> <span className="type">timestamp</span></span>
                    <span className="req">required</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sample data preview */}
            <div className="se-sample-tabs">
              <div className="se-sample-tab is-active">Live sample <span className="badge">5 events</span></div>
              <div className="se-sample-tab">As v4 <span className="badge">3 fail · 2 ok</span></div>
              <div className="se-sample-tab">After migration <span className="badge">5 ok</span></div>
            </div>
            <table className="se-sample-table">
              <thead>
                <tr>
                  <th>order_id</th>
                  <th>user_id → customer_id</th>
                  <th>amount</th>
                  <th>region</th>
                  <th>created_at</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ord_8a14e2</td>
                  <td className="bk">user_8214 (missing customer_id)</td>
                  <td className="bk">"42.50" (string)</td>
                  <td className="bk">— missing</td>
                  <td>14:18:02</td>
                </tr>
                <tr>
                  <td>ord_8a14e3</td>
                  <td className="bk">user_8215</td>
                  <td className="bk">"99.00"</td>
                  <td className="bk">—</td>
                  <td>14:18:05</td>
                </tr>
                <tr>
                  <td>ord_8a14e4</td>
                  <td className="fb">cust_8216 (already migrated by producer)</td>
                  <td className="fb">12.99 (decimal)</td>
                  <td className="fb">EU</td>
                  <td>14:18:07</td>
                </tr>
                <tr>
                  <td>ord_8a14e5</td>
                  <td className="bk">user_8217</td>
                  <td className="bk">"7.20"</td>
                  <td className="bk">—</td>
                  <td>14:18:09</td>
                </tr>
                <tr>
                  <td>ord_8a14e6</td>
                  <td className="fb">cust_8218</td>
                  <td className="fb">155.00</td>
                  <td className="fb">US</td>
                  <td>14:18:11</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right: AI commentary */}
          <SEAiSidebar messages={[
            {
              who: 'ai',
              body: <>
                Three changes in v4 are <strong>backward-incompatible</strong>:
                <ul style={{margin:'8px 0 6px 18px', padding:0, lineHeight:1.55}}>
                  <li><code>user_id → customer_id</code> — consumers reading <code>user_id</code> will see a missing field.</li>
                  <li><code>region</code> required with no default — events without it fail validation.</li>
                  <li><code>amount</code> string → decimal(12,2) — values that don't parse as decimals fail.</li>
                </ul>
                The renamed field is the most invasive — it shows up in <strong>5 of 7</strong> consuming pipelines.
              </>,
              actions: [
                { label: 'Draft plan', kind: 'primary' },
                { label: 'Suggest aliases' },
              ]
            },
            {
              who: 'user',
              body: <>Can we add a default <code>"unknown"</code> for region instead of asking the producer to fix it?</>
            },
            {
              who: 'ai',
              body: <>
                Yes — and that's the safer move because it lets us migrate consumers without coordinating with the producer team.
                Plan step 1 will add <code>region: string = "unknown"</code> as a transformer, step 2 will dual-write
                <code>customer_id</code> alongside <code>user_id</code>, and step 3 will cast <code>amount</code> defensively.
                <br/><br/>
                Producer can later make <code>region</code> required without breaking us.
              </>,
              actions: [
                { label: 'Use this approach', kind: 'primary' },
                { label: 'Show alternatives' },
              ]
            }
          ]}/>
        </div>

        <div className="se-footbar">
          <span className="help"><strong>Heads up</strong> · Continuing builds an impact map across all 7 affected pipelines.</span>
          <div className="grow"/>
          <SEBtn kind="secondary">Save as draft</SEBtn>
          <SEBtn kind="primary" icon="chevR">Continue to impact</SEBtn>
        </div>

        <Annot>
          Diff viewer. Side-by-side instead of unified — easier to scan when fields rename.
          Sample-data preview tabs (live / as-v4 / after-migration) ground the abstract diff in real failures.
          AI sidebar is conversational, not modal — questions feel cheap.
        </Annot>
      </div>
    </AppShell>
  </div>
);

// =====================================================================
// ARTBOARD 3 · Compatibility analyzer (3-col blast radius)
// =====================================================================

const ArtSEImpact = () => (
  <div className="se-page">
    <AppShell activeNav="library">
      <div className="se-inner">
        <SECrumbs scope="impact"/>
        <SETitleRow
          title="Impact analysis"
          meta="7 pipelines · 3 sinks · 4 owning teams"
          right={<>
            <SEBtn kind="secondary" icon="bell">Notify owners</SEBtn>
            <SEBtn kind="secondary">Back to diff</SEBtn>
            <SEBtn kind="primary" icon="sparkles">Draft migration plan</SEBtn>
          </>}
        />
        <SEStepBar active="impact"/>

        <div className="se-stats">
          <SEStat label="Pipelines using v3" value="7"/>
          <SEStat label="Will break" value="3" tone="red" delta="if cut over now" deltaTone="down"/>
          <SEStat label="Need migration" value="2" tone="orange" delta="auto-fixable" deltaTone="flat"/>
          <SEStat label="Safe" value="2" tone="green"/>
        </div>

        <div className="se-compat">
          <div className="se-compat-col safe">
            <div className="head">
              <span className="dot"/>
              <span className="label">Safe</span>
              <span className="count">2</span>
            </div>
            <div className="body">
              <div className="se-compat-row">
                <div className="name"><span className="pip-dot" style={{background:'var(--color-green-500)'}}/>orders-archive</div>
                <div className="reason">Passthrough — writes raw bytes to S3, doesn't read field values.</div>
                <div className="meta">team:platform · v3 · pinned</div>
              </div>
              <div className="se-compat-row">
                <div className="name"><span className="pip-dot" style={{background:'var(--color-green-500)'}}/>orders-audit-replay</div>
                <div className="reason">Consumer reads <span className="mono">order_id</span> + <span className="mono">created_at</span> only — both unchanged.</div>
                <div className="meta">team:risk · v3 · pinned</div>
              </div>
              <div className="se-compat-row">
                <div className="name"><span className="pip-dot" style={{background:'var(--color-green-500)'}}/>orders-dedup-1m</div>
                <div className="reason">Keys on <span className="mono">order_id</span>; remaining fields opaque.</div>
                <div className="meta">team:platform · v3 · pinned</div>
              </div>
              <div className="se-compat-row" style={{padding:'14px 16px', color:'var(--color-gray-dark-500)', fontSize:11.5}}>
                These can stay on v3 indefinitely. No action needed.
              </div>
            </div>
          </div>

          <div className="se-compat-col needs">
            <div className="head">
              <span className="dot"/>
              <span className="label">Needs migration</span>
              <span className="count">2</span>
            </div>
            <div className="body">
              <div className="se-compat-row">
                <div className="name"><span className="pip-dot" style={{background:'var(--color-yellow-400)'}}/>orders-metrics-1m</div>
                <div className="reason">Reads <span className="mono">amount</span> as string; type tightens to decimal(12,2). Parse rate drops to <span className="mono">99.4%</span>.</div>
                <div className="meta">team:platform · auto-fixable · cast transformer</div>
              </div>
              <div className="se-compat-row">
                <div className="name"><span className="pip-dot" style={{background:'var(--color-yellow-400)'}}/>orders-fanout-fraud</div>
                <div className="reason">Routes on <span className="mono">user_id</span> (renamed). Auto-fix: dual-read with alias.</div>
                <div className="meta">team:risk · auto-fixable · alias transform</div>
              </div>
              <div className="se-compat-row" style={{padding:'14px 16px', color:'var(--color-yellow-400)', fontSize:11.5}}>
                AI can patch both with a transformer. Owner approval required.
              </div>
            </div>
          </div>

          <div className="se-compat-col broken">
            <div className="head">
              <span className="dot"/>
              <span className="label">Will break</span>
              <span className="count">3</span>
            </div>
            <div className="body">
              <div className="se-compat-row">
                <div className="name"><span className="pip-dot" style={{background:'var(--color-red-500)'}}/>orders-enrich-checkout</div>
                <div className="reason">
                  Joins on <span className="mono">user_id</span> against a profile table. Blocking — needs schema change in the consumer service before alias works.
                </div>
                <div className="meta">team:checkout · blocked · code change required</div>
              </div>
              <div className="se-compat-row">
                <div className="name"><span className="pip-dot" style={{background:'var(--color-red-500)'}}/>orders-to-warehouse</div>
                <div className="reason">
                  ClickHouse target table has <span className="mono">amount String</span>. Sink fails on type mismatch — schema migration needed at sink.
                </div>
                <div className="meta">team:data · blocked · CH table ALTER required</div>
              </div>
              <div className="se-compat-row">
                <div className="name"><span className="pip-dot" style={{background:'var(--color-red-500)'}}/>orders-fanout-fraud</div>
                <div className="reason">
                  Reads removed <span className="mono">legacy_total</span> for fallback compute. No sub for missing field.
                </div>
                <div className="meta">team:risk · blocked · field deprecated</div>
              </div>
              <div className="se-compat-row" style={{padding:'14px 16px', color:'var(--color-red-500)', fontSize:11.5}}>
                3 owners notified. Migration cannot complete until they ack.
              </div>
            </div>
          </div>
        </div>

        <div className="se-grid" style={{gridTemplateColumns:'1.5fr 1fr', marginTop:18}}>
          <div className="se-card">
            <div className="se-card-head" style={{padding:0, borderBottom:'none', marginBottom:10}}>
              <h3>Owner outreach · queued</h3>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {[
                { team:'team:checkout', who:'alex@checkout.team', what:'orders-enrich-checkout', need:'consumer code change to read customer_id' },
                { team:'team:data',     who:'mira@data.team',      what:'orders-to-warehouse',     need:'ALTER TABLE orders SET amount Decimal(12,2)' },
                { team:'team:risk',     who:'pat@risk.team',       what:'orders-fanout-fraud',     need:'remove fallback on legacy_total' },
              ].map((o, i) => (
                <div key={i} style={{display:'grid', gridTemplateColumns:'1fr auto', gap:14, padding:'10px 12px', background:'#050507', border:'1px solid var(--color-gray-dark-800)', borderRadius:8}}>
                  <div>
                    <div style={{fontSize:12, color:'var(--color-foreground-neutral)', fontWeight:500, fontFamily:'JetBrains Mono, monospace'}}>{o.who}</div>
                    <div style={{fontSize:11, color:'var(--color-gray-dark-500)', marginTop:2}}>{o.team} · pipeline <span style={{color:'var(--color-gray-dark-100)'}}>{o.what}</span></div>
                    <div style={{fontSize:11.5, color:'var(--color-gray-dark-100)', marginTop:6, lineHeight:1.5}}>{o.need}</div>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end'}}>
                    <span className="se-step-status queued"><span className="dot"/>not sent</span>
                    <SEBtn kind="secondary">Edit message</SEBtn>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, fontSize:11.5, color:'var(--color-gray-dark-500)', lineHeight:1.55}}>
              Owners get a templated Slack DM linking back to this exact migration. Replies surface in Inbox.
            </div>
          </div>

          <SEAiSidebar messages={[
            {
              who: 'ai',
              body: <>
                Of the 3 blocking pipelines, <strong>orders-enrich-checkout</strong> is the critical-path one (fronts the
                checkout SLO). Suggest we don't proceed until <code>alex@checkout.team</code> confirms the consumer ships
                the rename.
                <br/><br/>
                The other two are non-customer-facing and can be parked behind the migration with a fallback to v3 for
                another 48h.
              </>,
              actions: [
                { label: 'Park non-critical pipelines', kind: 'primary' },
                { label: 'Pause until all 3 ack' },
              ]
            }
          ]} footer="ask: who owns this? what if alex says no?"/>
        </div>

        <Annot>
          Impact analysis is the gate. Three-column split (Safe / Needs migration / Will break) is the most-honest
          surface to communicate consequences. Owner-outreach panel makes "send a Slack" first-class — most schema
          migrations stall on coordination, not technology.
        </Annot>
      </div>
    </AppShell>
  </div>
);

Object.assign(window, { ArtSEHub, ArtSEDiff, ArtSEImpact });
