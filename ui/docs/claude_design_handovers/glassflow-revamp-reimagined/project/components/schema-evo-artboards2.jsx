// Schema Evolution artboards — part 2 of 2 (artboards 4, 5, 6)

// =====================================================================
// ARTBOARD 4 · Migration plan (Express, AI-led)
// =====================================================================

const ArtSEPlan = () => (
  <div className="se-page">
    <AppShell activeNav="library">
      <div className="se-inner">
        <SECrumbs scope="plan"/>
        <SETitleRow
          title="Migration plan"
          meta="Express · AI-drafted · 4 steps · ~38 min"
          right={<>
            <SEModeToggle mode="express"/>
            <SEBtn kind="secondary" icon="copy">Export YAML</SEBtn>
            <SEBtn kind="primary" icon="play">Start cutover</SEBtn>
          </>}
        />
        <SEStepBar active="plan"/>

        <div className="se-grid" style={{gridTemplateColumns:'1.7fr 1fr'}}>
          <div>
            <div className="se-steplist">
              <div className="se-steplist-row is-done">
                <div className="num">1</div>
                <div className="body">
                  <h5>Add <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-orange-300)'}}>region</code> with default <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-green-500)'}}>"unknown"</code> via transformer</h5>
                  <p>
                    Inserts a transform stage at the v3→v4 boundary so consumers receive the new required field
                    without producer coordination.
                  </p>
                  <div className="why">
                    <strong>Why first?</strong> Adding a synthesised field is non-destructive and idempotent — failure
                    here is recoverable by removing the transform.
                  </div>
                  <div className="cmd">
                    <span className="k">stage</span>: transform.add_field<br/>
                    <span className="k">field</span>: region<br/>
                    <span className="k">type</span>: string<br/>
                    <span className="k">default</span>: <span className="v">"unknown"</span>
                  </div>
                </div>
                <div className="actions">
                  <span className="se-step-status done"><span className="dot"/>applied 14:43</span>
                  <span className="stmeta">staging · 2.1k events</span>
                  <SEBtn kind="secondary">View diff</SEBtn>
                </div>
              </div>

              <div className="se-steplist-row is-active">
                <div className="num">2</div>
                <div className="body">
                  <h5>Dual-write <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-orange-300)'}}>customer_id</code> alongside <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-orange-300)'}}>user_id</code></h5>
                  <p>
                    Keep the old field populated for 24h. Consumers can rename at their own pace; once all consumers
                    read <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-foreground-neutral)'}}>customer_id</code>, step 4 removes the alias.
                  </p>
                  <div className="why">
                    <strong>Bridge sees</strong> 5 consumers still reference <code>user_id</code>. Alias keeps them
                    working without code changes.
                  </div>
                  <div className="cmd">
                    <span className="k">stage</span>: transform.alias<br/>
                    <span className="k">from</span>: customer_id <span className="k">→</span> <span className="v">user_id</span><br/>
                    <span className="k">ttl</span>: <span className="v">24h</span>
                  </div>
                </div>
                <div className="actions">
                  <span className="se-step-status run"><span className="dot"/>applying</span>
                  <span className="stmeta">staging · 14:51</span>
                  <SEBtn kind="secondary" dim>Pause</SEBtn>
                </div>
              </div>

              <div className="se-steplist-row">
                <div className="num">3</div>
                <div className="body">
                  <h5>Defensive cast: <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-orange-300)'}}>amount</code> → decimal(12,2) with <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-yellow-400)'}}>parse_or_dlq</code></h5>
                  <p>
                    Convert string values that parse cleanly; route the rest to DLQ with a reason code so they can be
                    triaged by the existing DLQ flow.
                  </p>
                  <div className="why">
                    <strong>Sample shows</strong> 99.4% of recent values parse without loss. The 0.6% that don't are
                    legitimate edge cases (commas, currency symbols) worth manual review.
                  </div>
                  <div className="cmd">
                    <span className="k">stage</span>: transform.cast<br/>
                    <span className="k">field</span>: amount<br/>
                    <span className="k">to</span>: decimal(12,2)<br/>
                    <span className="k">on_fail</span>: <span className="v">dlq</span>
                  </div>
                </div>
                <div className="actions">
                  <span className="se-step-status queued"><span className="dot"/>queued</span>
                  <span className="stmeta">awaits step 2</span>
                  <SEBtn kind="secondary" dim>Edit</SEBtn>
                </div>
              </div>

              <div className="se-steplist-row">
                <div className="num">4</div>
                <div className="body">
                  <h5>Promote v4 to live · canary 10% → 100%</h5>
                  <p>
                    Roll forward in 5 stages (10 / 25 / 50 / 75 / 100%) with auto-pause if the success rate dips below
                    99% for two consecutive minutes. Old v3 path remains warm for fast rollback during the entire window.
                  </p>
                  <div className="why">
                    <strong>Rollback safety</strong> · v3 stays mounted for 24h. Single click reverts traffic without
                    data loss; in-flight v4 events drain into the dual-write fallback.
                  </div>
                  <div className="cmd">
                    <span className="k">stage</span>: cutover.canary<br/>
                    <span className="k">steps</span>: 10, 25, 50, 75, 100<br/>
                    <span className="k">guard</span>: success_rate &gt; <span className="v">99%</span> for <span className="v">2m</span><br/>
                    <span className="k">rollback_window</span>: <span className="v">24h</span>
                  </div>
                </div>
                <div className="actions">
                  <span className="se-step-status queued"><span className="dot"/>queued</span>
                  <span className="stmeta">awaits steps 1–3</span>
                  <SEBtn kind="secondary" dim>Edit</SEBtn>
                </div>
              </div>
            </div>

            <div className="se-footbar">
              <span className="help"><strong>Dry-run available</strong> · Stage steps 1–3 against staging events without affecting prod traffic.</span>
              <div className="grow"/>
              <SEBtn kind="secondary" icon="play">Dry-run all</SEBtn>
              <SEBtn kind="primary" icon="play">Start cutover</SEBtn>
            </div>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="se-card">
              <div className="se-card-head" style={{padding:0, borderBottom:'none', marginBottom:10}}>
                <h3>Plan summary</h3>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:8, fontSize:12, color:'var(--color-gray-dark-100)', lineHeight:1.55}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{color:'var(--color-gray-dark-500)'}}>Affected pipelines</span>
                  <span style={{fontFamily:'JetBrains Mono, monospace'}}>5 of 7</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{color:'var(--color-gray-dark-500)'}}>Owner approvals</span>
                  <span style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-green-500)'}}>3 / 3 ✓</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{color:'var(--color-gray-dark-500)'}}>Estimated duration</span>
                  <span style={{fontFamily:'JetBrains Mono, monospace'}}>~38 min</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{color:'var(--color-gray-dark-500)'}}>Rollback window</span>
                  <span style={{fontFamily:'JetBrains Mono, monospace'}}>24h</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{color:'var(--color-gray-dark-500)'}}>DLQ budget</span>
                  <span style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-yellow-400)'}}>≤ 0.6%</span>
                </div>
              </div>
            </div>

            <SEAiSidebar messages={[
              {
                who: 'ai',
                body: <>
                  Step 2 is in flight — 71% applied to staging traffic so far. No errors. ETA ~3 min.
                  Step 3's defensive cast will be queued automatically once step 2 verifies clean.
                </>
              },
              {
                who: 'user',
                body: <>What happens to events that fail step 3's cast?</>
              },
              {
                who: 'ai',
                body: <>
                  They route to <code>dlq.amount_parse_failed</code> with the original string preserved.
                  The DLQ inspector groups them; you can replay after fix or mark as known-bad. Default
                  budget is 1% — beyond that the cutover auto-pauses.
                </>,
                actions: [
                  { label: 'Tighten budget to 0.5%' },
                  { label: 'View sample failures' },
                ]
              }
            ]} footer="ask the assistant about any step"/>
          </div>
        </div>

        <Annot>
          Plan steps each carry: a one-line claim, a "why first?" justification, the YAML/cmd block we'll execute,
          and live status. Express mode lets AI draft + execute; Manual mode (toggle top-right) hides the why-blocks
          and forces step-by-step approval.
        </Annot>
      </div>
    </AppShell>
  </div>
);

// =====================================================================
// ARTBOARD 5 · Cutover in progress (dual-write live)
// =====================================================================

const ArtSECutover = () => (
  <div className="se-page">
    <AppShell activeNav="library">
      <div className="se-inner">
        <SECrumbs scope="cutover"/>
        <SETitleRow
          title="Cutover · canary stage"
          meta="orders.events · v3 → v4 · 25% on v4"
          right={<>
            <SEBtn kind="secondary" icon="refresh">Hold at 25%</SEBtn>
            <SEBtn kind="danger-ghost" icon="x">Roll back to v3</SEBtn>
            <SEBtn kind="primary" icon="play">Advance to 50%</SEBtn>
          </>}
        />
        <SEStepBar active="cutover"/>

        <div className="se-stats">
          <SEStat label="Throughput" value="9,840" unit="msg/s" delta="+1.2%" deltaTone="up"/>
          <SEStat label="Success rate (v4)" value="99.78" unit="%" tone="green" delta="+0.12 vs v3" deltaTone="up"/>
          <SEStat label="DLQ rate" value="0.21" unit="%" tone="orange" delta="below 1% budget" deltaTone="flat"/>
          <SEStat label="Time in stage" value="08:12" tone="orange" delta="auto-advance in 1:48" deltaTone="flat"/>
        </div>

        <div className="se-grid" style={{gridTemplateColumns:'1.6fr 1fr'}}>
          <div>
            <div className="se-card" style={{marginBottom:14}}>
              <div className="se-card-head" style={{padding:0, borderBottom:'none', marginBottom:14}}>
                <h3>Traffic split</h3>
                <span style={{flex:1}}/>
                <span style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-gray-dark-500)'}}>auto-canary · stage 2 of 5</span>
              </div>
              <div className="se-dual">
                <div className="se-dual-side old">
                  <div className="lbl">v3 · old</div>
                  <div className="ver">v3</div>
                  <div className="pct">75<span style={{fontSize:18, color:'var(--color-gray-dark-500)'}}>%</span></div>
                  <div className="bar"><i style={{width:'75%'}}/></div>
                  <div className="stat">7,380 msg/s · 99.66% ok · 0 DLQ</div>
                </div>
                <div className="se-dual-divider">
                  <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
                    <path d="M2 10 H 24 M18 4 L 26 10 L 18 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="se-dual-side new">
                  <div className="lbl">v4 · new</div>
                  <div className="ver">v4</div>
                  <div className="pct">25<span style={{fontSize:18, color:'var(--color-gray-dark-500)'}}>%</span></div>
                  <div className="bar"><i style={{width:'25%'}}/></div>
                  <div className="stat">2,460 msg/s · 99.78% ok · 4 DLQ</div>
                </div>
              </div>
              <div className="se-traffic-slider" style={{'--p':'25%'}}>
                <span style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-gray-dark-500)', minWidth:30}}>v3</span>
                <div className="track" style={{position:'relative'}}>
                  <div className="knob" style={{left:'25%'}}/>
                </div>
                <span style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-gray-dark-500)', minWidth:30, textAlign:'right'}}>v4</span>
              </div>
              <div className="se-traffic-slider .ticks" style={{display:'flex', justifyContent:'space-between', marginTop:10, fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--color-gray-dark-500)'}}>
                <span>0%</span><span>10%</span><span style={{color:'var(--color-orange-300)'}}>● 25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>

            <div className="se-card tight">
              <div className="se-card-head">
                <h3>Live cutover log</h3>
                <span style={{flex:1}}/>
                <span style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, color:'var(--color-green-500)', display:'inline-flex', alignItems:'center', gap:6}}>
                  <span style={{width:6, height:6, borderRadius:'50%', background:'var(--color-green-500)'}}/>streaming
                </span>
              </div>
              <div className="se-card-body" style={{padding:0}}>
                <div className="se-log" style={{borderRadius:0, border:0, maxHeight:'unset', padding:'12px 16px'}}>
                  <div><span className="ts">14:51:02</span> <span className="lvl-info">[plan]</span> <span className="msg">step 2 (alias customer_id↔user_id) applied to staging</span></div>
                  <div><span className="ts">14:51:11</span> <span className="lvl-ok">[ok]</span> <span className="msg">staging tail: 2,148 events · 0 alias errors · proceeding</span></div>
                  <div><span className="ts">14:51:33</span> <span className="lvl-info">[cutover]</span> <span className="msg">canary stage 1 (10%) opened on v4</span></div>
                  <div><span className="ts">14:53:01</span> <span className="lvl-ok">[guard]</span> <span className="msg">success_rate=99.81% &gt; threshold 99% (2m window) — clean</span></div>
                  <div><span className="ts">14:54:18</span> <span className="lvl-info">[cutover]</span> <span className="msg">advancing to stage 2 (25%)</span></div>
                  <div><span className="ts">14:55:42</span> <span className="lvl-warn">[dlq]</span> <span className="msg">3 events failed amount cast: "$42.50", "12,99", "" — routed to dlq.amount_parse_failed</span></div>
                  <div><span className="ts">14:56:09</span> <span className="lvl-ok">[guard]</span> <span className="msg">dlq_rate=0.21% &lt; budget 1% — within tolerance</span></div>
                  <div><span className="ts">14:58:30</span> <span className="lvl-info">[bridge]</span> <span className="msg">orders-metrics-1m repinned to v4 · was v3</span></div>
                  <div><span className="ts">14:59:12</span> <span className="lvl-ok">[guard]</span> <span className="msg">consumer_lag stable at 1.2s · no fanout</span></div>
                  <div><span className="ts">15:00:00</span> <span className="lvl-info">[cutover]</span> <span className="msg">stage 2 timer · 1:48 to auto-advance to 50%</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="se-card">
              <div className="se-card-head" style={{padding:0, borderBottom:'none', marginBottom:10}}>
                <h3>Rollback safety</h3>
              </div>
              <div style={{padding:'12px 14px', background:'color-mix(in srgb, var(--color-green-500) 6%, transparent)', border:'1px solid color-mix(in srgb, var(--color-green-500) 25%, transparent)', borderRadius:8, fontSize:12, color:'var(--color-gray-dark-100)', lineHeight:1.6}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                  <Icon name="check" size={14} color="var(--color-green-500)"/>
                  <strong style={{color:'var(--color-green-500)', fontWeight:600}}>v3 fallback warm</strong>
                </div>
                One-click revert. Traffic flips back in &lt;5s; in-flight v4 events drain through the dual-write
                alias for up to 24h with no data loss.
              </div>
              <div style={{marginTop:12, fontSize:11.5, color:'var(--color-gray-dark-500)', lineHeight:1.55}}>
                Rollback window expires <strong style={{color:'var(--color-foreground-neutral)'}}>tomorrow 14:51 UTC</strong>.
                After that, v3 is unmounted and rollback requires a full re-pin from Bridge.
              </div>
              <div style={{marginTop:12, display:'flex', gap:8}}>
                <SEBtn kind="danger-ghost" icon="refresh">Roll back now</SEBtn>
                <SEBtn kind="secondary">Extend window</SEBtn>
              </div>
            </div>

            <SEAiSidebar messages={[
              {
                who: 'ai',
                body: <>
                  Things look healthy. Three early DLQ events — all <code>amount</code> parse failures with currency
                  symbols and a comma decimal — match what we predicted from the sample. None of them are blocking
                  the canary advance.
                  <br/><br/>
                  Recommend advancing to 50% on schedule.
                </>,
                actions: [
                  { label: 'Advance to 50%', kind: 'primary' },
                  { label: 'Hold and inspect DLQ' },
                ]
              }
            ]} footer="ask: anything looking risky?"/>
          </div>
        </div>

        <Annot>
          Cutover surface. Big dual-write monitor above the fold, live log below. Rollback button is always visible
          in the title row AND in the sidebar — a destructive escape hatch should never require scrolling.
          Auto-canary is the default; user can pause/advance manually at any stage gate.
        </Annot>
      </div>
    </AppShell>
  </div>
);

// =====================================================================
// ARTBOARD 6 · Post-cutover · verify clean
// =====================================================================

const ArtSEVerify = () => (
  <div className="se-page">
    <AppShell activeNav="library">
      <div className="se-inner">
        <SECrumbs scope="verify"/>
        <SETitleRow
          title="Migration complete"
          meta="orders.events · v4 live · 100% traffic · 41m 22s"
          right={<>
            <SEBtn kind="secondary" icon="copy">Export report</SEBtn>
            <SEBtn kind="secondary">Schedule v3 unmount</SEBtn>
            <SEBtn kind="primary" icon="check">Mark complete</SEBtn>
          </>}
        />
        <SEStepBar active="verify"/>

        <div className="se-done-banner">
          <div className="ico">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12 L 10 17 L 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2>v4 is live for all 7 pipelines</h2>
            <p>
              Cutover finished at <strong>15:32 UTC</strong>. DLQ from the migration drained to <strong>0.18%</strong>
              (within budget). All consumer pipelines repinned cleanly; v3 stays warm for 24h as a rollback window.
            </p>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:6, fontSize:11.5, color:'var(--color-gray-dark-500)', textAlign:'right'}}>
            <span>Rollback window expires</span>
            <span style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-foreground-neutral)', fontSize:13}}>tomorrow 15:32 UTC</span>
          </div>
        </div>

        <div className="se-stats">
          <SEStat label="Total duration" value="41:22" unit="m:s" tone="green"/>
          <SEStat label="DLQ from migration" value="184" unit="evts" tone="orange" delta="0.18% · &lt; 1% budget" deltaTone="flat"/>
          <SEStat label="Pipelines repinned" value="7 / 7" tone="green" delta="3 owner-acked" deltaTone="up"/>
          <SEStat label="Drift detected" value="0" tone="green" delta="bridge clean" deltaTone="flat"/>
        </div>

        <div className="se-grid" style={{gridTemplateColumns:'1.5fr 1fr'}}>
          <div className="se-card tight">
            <div className="se-card-head">
              <h3>Pipelines now on v4</h3>
              <span style={{flex:1}}/>
              <span style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>last 41 min</span>
            </div>
            <div className="br-blast">
              <div className="br-blast-rows">
                {[
                  { n:'orders-enrich-checkout', o:'team:checkout', why:'reads customer_id · alias removed · 100% v4', sev:'ok' },
                  { n:'orders-fanout-fraud',     o:'team:risk',     why:'consumer code shipped · legacy_total fallback removed', sev:'ok' },
                  { n:'orders-to-warehouse',     o:'team:data',     why:'CH ALTER applied · amount Decimal(12,2) live', sev:'ok' },
                  { n:'orders-metrics-1m',       o:'team:platform', why:'auto-fix transformer applied · 99.6% parse', sev:'ok' },
                  { n:'orders-archive',          o:'team:platform', why:'passthrough · auto-repin', sev:'ok' },
                  { n:'orders-audit-replay',     o:'team:risk',     why:'auto-repin', sev:'ok' },
                  { n:'orders-dedup-1m',         o:'team:platform', why:'auto-repin', sev:'ok' },
                ].map((r, i) => (
                  <div key={i} className="br-blast-row">
                    <span className="br-pip-dot br-pip-running" style={{width:8, height:8, borderRadius:'50%'}}/>
                    <div>
                      <div className="br-blast-name">{r.n}</div>
                      <div className="br-blast-owner">{r.o}</div>
                    </div>
                    <span className="chip chip-positive" style={{fontSize:10}}>v4</span>
                    <div className="br-blast-effect" style={{gridColumn:'span 2'}}>{r.why}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="se-card">
              <div className="se-card-head" style={{padding:0, borderBottom:'none', marginBottom:10}}>
                <h3>What's left to do</h3>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {[
                  { label: 'Triage 184 DLQ events from amount parse failures', sub: 'amount values with currency symbols / commas', cta: 'Open DLQ' },
                  { label: 'Schedule v3 unmount in 24h', sub: 'rollback window auto-expires; you can extend if needed', cta: 'Confirm' },
                  { label: 'Update consumer docs to reflect customer_id', sub: 'Bridge has flagged 2 docs pages still referencing user_id', cta: 'Open Bridge' },
                ].map((t, i) => (
                  <div key={i} style={{padding:'10px 12px', background:'#050507', border:'1px solid var(--color-gray-dark-800)', borderRadius:8}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{width:18, height:18, borderRadius:4, border:'1px solid var(--color-gray-dark-500)', flexShrink:0}}/>
                      <div style={{flex:1, fontSize:12, color:'var(--color-foreground-neutral)', fontWeight:500}}>{t.label}</div>
                      <SEBtn kind="secondary">{t.cta}</SEBtn>
                    </div>
                    <div style={{marginLeft:28, fontSize:11, color:'var(--color-gray-dark-500)', marginTop:4, lineHeight:1.5}}>{t.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="se-card">
              <div className="se-card-head" style={{padding:0, borderBottom:'none', marginBottom:10}}>
                <h3>AI · final summary</h3>
              </div>
              <div style={{fontSize:12.5, color:'var(--color-gray-dark-100)', lineHeight:1.6}}>
                Migration ran <strong style={{color:'var(--color-foreground-neutral)'}}>3 minutes faster</strong> than the
                ~38 min estimate, no rollbacks, no SLO breach, and DLQ stayed below budget the entire time.
                Step 3's defensive cast caught the predicted 0.6% edge cases — they're queued for triage in DLQ
                cluster <code style={{fontFamily:'JetBrains Mono, monospace', color:'var(--color-orange-300)'}}>#C-31</code>.
                <br/><br/>
                Saved this migration shape as a template — <strong style={{color:'var(--color-foreground-neutral)'}}>"rename + add-required + type-narrow"</strong> —
                so the next similar diff can re-use it with one click.
              </div>
              <div style={{marginTop:12, display:'flex', gap:6, flexWrap:'wrap'}}>
                <SEBtn kind="secondary" icon="copy">View full report</SEBtn>
                <SEBtn kind="secondary">Save as template</SEBtn>
              </div>
            </div>
          </div>
        </div>

        <Annot>
          Verify surface closes the loop. Big green banner answers "is it done?" instantly; below the fold is what
          remains (DLQ triage, rollback window, doc updates) so the migration doesn't quietly leave loose ends.
          Saving the migration as a template is how recurring patterns become 1-click flows over time.
        </Annot>
      </div>
    </AppShell>
  </div>
);

Object.assign(window, { ArtSEPlan, ArtSECutover, ArtSEVerify });
