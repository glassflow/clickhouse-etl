// DLQ Replay artboards 3-6: Inspector, Confirm, In-Progress, Results
// Depends on DLQ* primitives in dlq-artboards1.jsx.

const { useState: _u } = React;

// =====================================================================
// ARTBOARD 3 — Inspector / detail view
// =====================================================================
const ArtDLQInspector = () => {
  return (
    <div className="dlq-page" data-screen-label="DLQ Inspector · message detail">
      <div className="dlq-inner">
        <DLQCrumbs pipeline="user-events-enrich"/>
        <DLQTitleRow
          title="Dead-letter queue"
          meta="2,743 messages · message detail open"
          right={<>
            <button className="dlq-btn">Logs</button>
            <button className="dlq-btn">Open metrics</button>
          </>}
        />

        <div className="dlq-inspector">
          {/* LEFT: compact list */}
          <div className="left">
            <div className="listframe">
              <div className="dlq-list-head" style={{gridTemplateColumns:'28px 110px 70px 1fr 80px'}}>
                <span className="check"/>
                <span>received</span>
                <span>attempts</span>
                <span>summary</span>
                <span>error</span>
              </div>
              <div className="dlq-rows">
                {[
                  ['11:52:18.041','3/3','u_8a14e2'],
                  ['11:52:18.027','3/3','u_4f203a', true],
                  ['11:52:17.998','3/3','u_c91008'],
                  ['11:52:17.961','3/3','u_27aa1b'],
                  ['11:52:17.933','3/3','u_91ee05'],
                  ['11:52:17.910','3/3','u_6f4c12'],
                  ['11:52:17.887','2/3','u_2a8eef'],
                  ['11:52:17.852','3/3','u_5b119c'],
                  ['11:52:17.821','3/3','u_d0823f'],
                  ['11:52:17.799','3/3','u_a3119e'],
                  ['11:52:17.770','3/3','u_64812a'],
                  ['11:52:17.745','3/3','u_8a14e2'],
                ].map(([ts, att, k, active], i) => (
                  <div key={i} className={"dlq-row" + (active?' is-active':'')} style={{gridTemplateColumns:'28px 110px 70px 1fr 80px'}}>
                    <span className="check"/>
                    <span className="ts">{ts}</span>
                    <span className="attempts">{att}</span>
                    <span className="summary">
                      <span style={{color:'var(--color-gray-dark-500)'}}>user_id: </span>
                      <span className="key">{k}</span>
                    </span>
                    <span className="err">Timeout</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: inspector */}
          <div className="right">
            <div className="dlq-insp-head">
              <Icon name="warn" size={14} color="var(--color-red-500)"/>
              <span className="id">msg_evt_8a14e2_1700412738041</span>
              <span className="grow"/>
              <div className="nav">
                <button><Icon name="chevR" size={11} style={{transform:'rotate(180deg)'}}/></button>
                <span className="pos">2 / 2,194</span>
                <button><Icon name="chevR" size={11}/></button>
              </div>
              <button className="dlq-btn btn-quiet" style={{padding:'4px 6px'}}><Icon name="x" size={12}/></button>
            </div>

            <div className="dlq-insp-body">
              {/* AI diagnosis */}
              <div className="dlq-aidiag">
                <div className="h"><Icon name="sparkles" size={11}/>AI diagnosis</div>
                <h5>Connection-pool starvation, not bad data</h5>
                <p>
                  This message is structurally valid. The enrich step calls <code>postgres-users.findById(u_4f203a)</code> and times out after 5,000ms because the pool (<code>40/40</code>) has been saturated since 11:14. <strong>You can safely replay-as-is</strong> once the pool has capacity. We recommend pausing ingest for ~3 min, replaying with concurrency=10, then resuming.
                </p>
              </div>

              {/* error trace */}
              <div className="dlq-isec">
                <div className="head">Error<span className="rule"/><span className="meta">3 attempts · last 38m ago</span></div>
                <div className="dlq-trace">
                  <span className="err">EnrichmentTimeout</span>: timed out after 5000ms waiting for postgres connection{'\n'}
                  {'  at '}<span className="file">enrichers/user.go</span>:<span className="line">142</span>{'\n'}
                  {'  at '}<span className="file">pipeline/stage.go</span>:<span className="line">88</span>{'\n'}
                  {'  at '}<span className="file">runtime/exec.go</span>:<span className="line">214</span>{'\n'}
                  {'\n'}caused by: <span className="err">pool.ErrPoolExhausted</span>{'\n'}
                  {'  at '}<span className="file">pgx/pool.go</span>:<span className="line">312</span>{' (acquired=40 max=40 waiting=12)'}
                </div>
              </div>

              {/* payload */}
              <div className="dlq-isec">
                <div className="head">Payload<span className="rule"/><span className="meta">JSON · 1.2 KB</span></div>
                <div className="dlq-payload">
{`{
  `}<span className="key">"event_id"</span><span className="punct">:</span> <span className="str">"evt_8a14e2"</span><span className="punct">,</span>{`
  `}<span className="key">"event_type"</span><span className="punct">:</span> <span className="str">"page_view"</span><span className="punct">,</span>{`
  `}<span className="key">"user_id"</span><span className="punct">:</span> <span className="str bad">"u_4f203a"</span><span className="punct">,</span>{`
  `}<span className="key">"session_id"</span><span className="punct">:</span> <span className="str">"sess_91118ab"</span><span className="punct">,</span>{`
  `}<span className="key">"timestamp"</span><span className="punct">:</span> <span className="num">1700412738027</span><span className="punct">,</span>{`
  `}<span className="key">"properties"</span><span className="punct">:</span> <span className="punct">{`{`}</span>{`
    `}<span className="key">"path"</span><span className="punct">:</span> <span className="str">"/checkout/review"</span><span className="punct">,</span>{`
    `}<span className="key">"referrer"</span><span className="punct">:</span> <span className="str">"/cart"</span><span className="punct">,</span>{`
    `}<span className="key">"viewport"</span><span className="punct">:</span> <span className="punct">{`{`}</span> <span className="key">"w"</span><span className="punct">:</span> <span className="num">1440</span><span className="punct">, </span><span className="key">"h"</span><span className="punct">:</span> <span className="num">900</span> <span className="punct">{`}`}</span>{`
  `}<span className="punct">{`}`}</span>{`
`}<span className="punct">{`}`}</span>
                </div>
              </div>

              {/* headers */}
              <div className="dlq-isec">
                <div className="head">Headers &amp; routing<span className="rule"/></div>
                <dl className="dlq-kv">
                  <dt>source</dt><dd>kafka · user-events · partition 4 · offset 1182441</dd>
                  <dt>failed at</dt><dd>enrich.user_lookup (stage 2 of 4)</dd>
                  <dt>first received</dt><dd>2024-11-19 11:14:02 UTC <span style={{color:'var(--color-gray-dark-500)'}}>(38m 16s ago)</span></dd>
                  <dt>last attempt</dt><dd>2024-11-19 11:52:18 UTC</dd>
                  <dt>attempts</dt><dd>3 of 3 · backoff exhausted</dd>
                  <dt>trace_id</dt><dd>0x8a14e2b0c91008f6...</dd>
                  <dt>x-pipeline-version</dt><dd>v18 · 8c4ad21</dd>
                </dl>
              </div>

              {/* edit-before-replay placeholder */}
              <div className="dlq-isec">
                <div className="head">Replay options<span className="rule"/></div>
                <div className="dlq-summary">
                  <div className="row"><span className="lbl">target version</span><span className="val">v18 (current)</span></div>
                  <div className="row"><span className="lbl">target stage</span><span className="val">enrich.user_lookup</span></div>
                  <div className="row"><span className="lbl">on success</span><span className="val">remove from DLQ</span></div>
                  <div className="row"><span className="lbl">on failure</span><span className="val">return to DLQ, increment attempts</span></div>
                </div>
              </div>
            </div>

            <div className="dlq-insp-foot">
              <button className="dlq-btn btn-primary"><Icon name="reload" size={12}/>Replay this message</button>
              <button className="dlq-btn">Edit &amp; replay…</button>
              <button className="dlq-btn btn-quiet">Copy payload</button>
              <span className="grow"/>
              <button className="dlq-btn btn-danger"><Icon name="trash" size={12}/>Discard</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// ARTBOARD 4 — Confirm replay (modal)
// =====================================================================
const ArtDLQConfirm = () => {
  return (
    <div className="dlq-page" data-screen-label="DLQ Confirm · replay 2,194 modal" style={{minHeight: 980}}>
      <div className="dlq-inner" style={{filter:'blur(0.5px)', opacity:0.55}}>
        <DLQCrumbs pipeline="user-events-enrich"/>
        <DLQTitleRow
          title="Dead-letter queue"
          meta="2,743 messages · replay 2,194 selected"
        />
        <div className="dlq-toolbar">
          <div className="dlq-search"><Icon name="search" size={13} color="var(--color-gray-dark-500)"/><span style={{color:'var(--color-foreground-neutral)'}}>error: EnrichmentTimeout</span></div>
          <div className="grow"/>
        </div>
        <div className="dlq-listframe" style={{height: 360}}>
          <div className="dlq-bulkbar">
            <span className="num">2,194 selected</span>
            <span style={{color:'var(--color-gray-dark-500)'}}>· cluster: EnrichmentTimeout</span>
            <span className="grow"/>
            <button className="dlq-btn btn-primary">Replay as-is</button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <div className="dlq-modal-scrim">
        <div className="dlq-modal">
          <h3>Replay 2,194 messages?</h3>
          <p className="sub">From cluster <strong style={{color:'var(--color-foreground-neutral)'}}>EnrichmentTimeout</strong> on <code style={{fontFamily:'JetBrains Mono, monospace', fontSize:12, color:'var(--color-orange-300)'}}>user-events-enrich</code>. They will be resubmitted to the failed stage and reprocessed under the current pipeline version.</p>

          <div className="body">
            <div className="dlq-summary">
              <div className="row"><span className="lbl">selection</span><span className="val">2,194 messages</span></div>
              <div className="row"><span className="lbl">est. duration</span><span className="val">3m 40s @ 10 msg/s</span></div>
              <div className="row"><span className="lbl">target version</span><span className="val">v18 · 8c4ad21 (current)</span></div>
              <div className="row"><span className="lbl">target stage</span><span className="val">enrich.user_lookup</span></div>
              <div className="row"><span className="lbl">on success</span><span className="val">remove from DLQ</span></div>
              <div className="row"><span className="lbl">on failure</span><span className="val bad">return to DLQ (no infinite loop)</span></div>
            </div>

            <div className="dlq-field">
              <span className="label">Replay rate</span>
              <div className="input">
                <span style={{color:'var(--color-foreground-neutral)'}}>10</span>
                <span style={{color:'var(--color-gray-dark-500)'}}>msg / sec</span>
                <span className="grow"/>
                <span className="badge"><Icon name="sparkles" size={10}/> AI suggested</span>
              </div>
              <span className="help">AI suggested 10 msg/s based on current pool capacity. Going faster will likely re-trigger pool exhaustion.</span>
            </div>

            <div className="dlq-field">
              <span className="label">Target version</span>
              <div className="input">
                <span style={{color:'var(--color-foreground-neutral)'}}>v18 · 8c4ad21 (current)</span>
                <span className="grow"/>
                <Icon name="chevD" size={11} color="var(--color-gray-dark-500)"/>
              </div>
              <span className="help">Replay against an older version if the current one is the cause of failures. v17 is available for the next 6 days.</span>
            </div>

            <div className="dlq-warn">
              <Icon name="warn" size={14}/>
              <div>
                <strong>Heads up.</strong> The connection pool is currently saturated (40/40). Replaying now without raising pool size will likely fail again. <span style={{color:'var(--color-foreground-neutral)', textDecoration:'underline', cursor:'pointer'}}>Apply AI fix first?</span>
              </div>
            </div>

            <div className="dlq-check is-on">
              <span className="box"><Icon name="check" size={10}/></span>
              <span>Notify me in <strong style={{color:'var(--color-foreground-neutral)'}}>#data-platform</strong> when done</span>
            </div>
          </div>

          <div className="foot">
            <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace'}}>This action will be logged in the audit trail.</span>
            <span className="grow"/>
            <button className="dlq-btn btn-quiet">Cancel</button>
            <button className="dlq-btn">Run dry-run</button>
            <button className="dlq-btn btn-primary"><Icon name="reload" size={12}/>Replay 2,194</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// ARTBOARD 5 — Replay in progress
// =====================================================================
const ArtDLQProgress = () => {
  const pct = 62;
  return (
    <div className="dlq-page" data-screen-label="DLQ Progress · replay running">
      <div className="dlq-inner">
        <DLQCrumbs pipeline="user-events-enrich"/>
        <DLQTitleRow
          title="Replaying 2,194 messages"
          meta="started 2m 18s ago · est. 1m 22s remaining"
          right={<>
            <button className="dlq-btn">Pause</button>
            <button className="dlq-btn btn-danger">Abort</button>
          </>}
        />

        <div className="dlq-progress">
          <div className="head">
            <span className="pulse"/>
            <h2>Running… 1,360 / 2,194 processed</h2>
            <span className="grow"/>
            <span style={{fontFamily:'JetBrains Mono, monospace', fontSize:13, color:'var(--color-orange-300)', fontWeight:600}}>{pct}%</span>
          </div>

          <div className="bar">
            <div className="fill" style={{width: pct + '%'}}/>
            <div className="indeterminate"/>
          </div>

          <div className="stats">
            <div className="stat">
              <span className="lbl">processed</span>
              <span className="val">1,360</span>
            </div>
            <div className="stat">
              <span className="lbl">succeeded</span>
              <span className="val good">1,318 <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontWeight:500}}>96.9%</span></span>
            </div>
            <div className="stat">
              <span className="lbl">failed again</span>
              <span className="val bad">42 <span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontWeight:500}}>3.1%</span></span>
            </div>
            <div className="stat">
              <span className="lbl">throughput</span>
              <span className="val">9.8<span style={{fontSize:11, color:'var(--color-gray-dark-500)', fontWeight:500, marginLeft:4}}>msg/s</span></span>
            </div>
          </div>

          {/* Live log */}
          <div className="live">
            <div className="ln"><span className="ts">11:54:42.812</span><span className="ok">✓</span><span>replayed evt_a3119e → enrich.user_lookup OK (124ms)</span></div>
            <div className="ln"><span className="ts">11:54:42.798</span><span className="ok">✓</span><span>replayed evt_64812a → enrich.user_lookup OK (98ms)</span></div>
            <div className="ln"><span className="ts">11:54:42.781</span><span className="ok">✓</span><span>replayed evt_d0823f → enrich.user_lookup OK (112ms)</span></div>
            <div className="ln"><span className="ts">11:54:42.766</span><span className="er">✗</span><span>replayed evt_5b119c → enrich.user_lookup <span style={{color:'var(--color-red-500)'}}>EnrichmentTimeout</span> · returned to DLQ</span></div>
            <div className="ln"><span className="ts">11:54:42.751</span><span className="ok">✓</span><span>replayed evt_2a8eef → enrich.user_lookup OK (89ms)</span></div>
            <div className="ln"><span className="ts">11:54:42.737</span><span className="ok">✓</span><span>replayed evt_91ee05 → enrich.user_lookup OK (107ms)</span></div>
            <div className="ln"><span className="ts">11:54:42.722</span><span className="ok">✓</span><span>replayed evt_27aa1b → enrich.user_lookup OK (94ms)</span></div>
            <div className="ln"><span className="ts">11:54:42.708</span><span className="ok">✓</span><span>replayed evt_c91008 → enrich.user_lookup OK (118ms)</span></div>
          </div>
        </div>

        {/* secondary: continuing surface visibility */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:18}}>
          <div className="dlq-nextcard">
            <h3>Pool health while replaying</h3>
            <div style={{display:'flex', alignItems:'flex-end', gap:14}}>
              <div style={{flex:1}}>
                <div style={{display:'flex', alignItems:'center', gap:8, fontSize:11, color:'var(--color-gray-dark-500)', fontFamily:'JetBrains Mono, monospace', marginBottom:4}}>
                  postgres-users · acquired / max
                </div>
                <div style={{height: 6, background:'var(--color-gray-dark-800)', borderRadius:4, overflow:'hidden', position:'relative'}}>
                  <div style={{position:'absolute', inset:0, width:'72%', background:'var(--color-yellow-400)', borderRadius:4}}/>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', marginTop:4, fontSize:11, fontFamily:'JetBrains Mono, monospace', color:'var(--color-gray-dark-500)'}}>
                  <span>58 / 80</span>
                  <span style={{color:'var(--color-yellow-400)'}}>↗ stable</span>
                </div>
              </div>
            </div>
            <p style={{margin:'10px 0 0', fontSize:11.5, color:'var(--color-gray-dark-500)', lineHeight:1.5}}>Pool was raised to 80 before replay started; still has 22 free connections.</p>
          </div>
          <div className="dlq-nextcard">
            <h3>Audit trail (this replay)</h3>
            <div className="step"><span className="ix">1</span><div className="body"><strong>11:52:30</strong> · ana.kim raised <code style={{fontFamily:'JetBrains Mono, monospace', fontSize:11}}>postgres-users.pool_max</code> to 80</div></div>
            <div className="step"><span className="ix">2</span><div className="body"><strong>11:54:24</strong> · ana.kim started replay of 2,194 messages @ 10/s (target v18)</div></div>
            <div className="step"><span className="ix">3</span><div className="body" style={{color:'var(--color-gray-dark-500)'}}>Replay ID <code style={{fontFamily:'JetBrains Mono, monospace', fontSize:11}}>rpl_8c4ad21_2194</code> · in progress</div></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// ARTBOARD 6 — Replay results / post-mortem
// =====================================================================
const ArtDLQResults = () => {
  return (
    <div className="dlq-page" data-screen-label="DLQ Results · post-replay summary">
      <div className="dlq-inner">
        <DLQCrumbs pipeline="user-events-enrich"/>
        <DLQTitleRow
          title="Replay complete — partial success"
          meta="rpl_8c4ad21_2194 · finished 14s ago · ana.kim"
          right={<>
            <button className="dlq-btn">Export report</button>
            <button className="dlq-btn">Share link</button>
          </>}
        />

        <div className="dlq-results">
          <div className="left">
            <div className="dlq-result-head is-partial">
              <div className="ic"><Icon name="warn" size={20}/></div>
              <div className="body">
                <h2>2,098 of 2,194 succeeded · 96 returned to DLQ</h2>
                <div className="meta">duration 3m 47s · throughput 9.7 msg/s · target v18 · 8c4ad21</div>
              </div>
            </div>

            <div className="dlq-breakdown">
              <h3>Outcome breakdown</h3>
              <div className="row">
                <span className="lbl"><span className="dot" style={{background:'var(--color-green-500)'}}/>Succeeded</span>
                <div className="bar"><div className="fill" style={{width:'95.6%', background:'var(--color-green-500)'}}/></div>
                <span className="num">2,098</span>
              </div>
              <div className="row">
                <span className="lbl"><span className="dot" style={{background:'var(--color-red-500)'}}/>Failed again</span>
                <div className="bar"><div className="fill" style={{width:'4.4%', background:'var(--color-red-500)'}}/></div>
                <span className="num">96</span>
              </div>
              <div className="row">
                <span className="lbl"><span className="dot" style={{background:'var(--color-gray-dark-500)'}}/>Aborted</span>
                <div className="bar"><div className="fill" style={{width:'0%', background:'var(--color-gray-dark-500)'}}/></div>
                <span className="num">0</span>
              </div>
            </div>

            {/* Failure breakdown — clusters */}
            <div className="dlq-fail-cluster">
              <div className="h">
                <Icon name="warn" size={13} color="var(--color-red-500)"/>
                <h4>SchemaValidation · user_id missing</h4>
                <span className="grow"/>
                <span className="num">82</span>
              </div>
              <p>
                These messages have <code>user_id: null</code>. They predate the v18 deploy that made <code>user_id</code> required. Replaying against v18 will <strong>never</strong> succeed — replay against <code>v17</code>, edit the payload to inject a synthetic <code>user_id</code>, or discard them.
              </p>
              <div className="actions">
                <button className="dlq-btn btn-primary">Replay against v17</button>
                <button className="dlq-btn">Edit &amp; replay…</button>
                <button className="dlq-btn btn-danger"><Icon name="trash" size={12}/>Discard 82</button>
              </div>
            </div>

            <div className="dlq-fail-cluster">
              <div className="h">
                <Icon name="warn" size={13} color="var(--color-red-500)"/>
                <h4>EnrichmentTimeout · still timing out</h4>
                <span className="grow"/>
                <span className="num">14</span>
              </div>
              <p>
                Pool was healthy during replay (peak 58/80) — these 14 messages had specific user records that took &gt;5s to fetch. Likely missing indexes on <code>user_traits.user_id</code>. Investigate before re-replaying.
              </p>
              <div className="actions">
                <button className="dlq-btn"><Icon name="sparkles" size={12}/>Investigate with AI</button>
                <button className="dlq-btn">Open metrics</button>
                <button className="dlq-btn btn-quiet">Keep in DLQ</button>
              </div>
            </div>
          </div>

          {/* RIGHT: timeline + next steps */}
          <div className="right">
            <div className="dlq-nextcard">
              <h3>What just happened</h3>
              <div className="step"><span className="ix" style={{color:'var(--color-green-500)', borderColor:'color-mix(in srgb, var(--color-green-500) 40%, transparent)'}}><Icon name="check" size={11}/></span><div className="body">Pool raised <code style={{fontFamily:'JetBrains Mono, monospace', fontSize:11}}>40 → 80</code> (ana.kim, 11:52:30)</div></div>
              <div className="step"><span className="ix" style={{color:'var(--color-green-500)', borderColor:'color-mix(in srgb, var(--color-green-500) 40%, transparent)'}}><Icon name="check" size={11}/></span><div className="body">Replay started · 2,194 msgs · 10/s</div></div>
              <div className="step"><span className="ix" style={{color:'var(--color-green-500)', borderColor:'color-mix(in srgb, var(--color-green-500) 40%, transparent)'}}><Icon name="check" size={11}/></span><div className="body"><strong>2,098 succeeded</strong> · returned to source topic, removed from DLQ</div></div>
              <div className="step"><span className="ix" style={{color:'var(--color-yellow-400)', borderColor:'color-mix(in srgb, var(--color-yellow-400) 40%, transparent)'}}>!</span><div className="body"><strong>96 returned to DLQ</strong> · split into 2 clusters (left)</div></div>
            </div>

            <div className="dlq-nextcard">
              <h3>Suggested next steps <span style={{color:'var(--color-orange-300)', fontWeight:600, fontSize:10, marginLeft:6, padding:'2px 6px', background:'color-mix(in srgb, var(--color-orange-300) 12%, transparent)', borderRadius:4, textTransform:'uppercase', letterSpacing:'0.06em'}}><Icon name="sparkles" size={9}/> AI</span></h3>
              <div className="step"><span className="ix">1</span><div className="body"><strong>Replay 82 messages against v17</strong> — restores them without code change. Estimated 8s.</div></div>
              <div className="step"><span className="ix">2</span><div className="body"><strong>Open ticket for missing index</strong> on <code style={{fontFamily:'JetBrains Mono, monospace', fontSize:11}}>user_traits.user_id</code> — root cause for the remaining 14.</div></div>
              <div className="step"><span className="ix">3</span><div className="body">Pool capacity was the right call — keep <code style={{fontFamily:'JetBrains Mono, monospace', fontSize:11}}>pool_max=80</code> as the new default. Save to library?</div></div>
            </div>

            <div className="dlq-nextcard" style={{padding:'14px 18px'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                <Icon name="check" size={14} color="var(--color-green-500)"/>
                <strong style={{fontSize:12.5, color:'var(--color-foreground-neutral)'}}>Pipeline back to healthy</strong>
              </div>
              <div style={{fontSize:11.5, color:'var(--color-gray-dark-500)', lineHeight:1.5}}>
                Throughput recovered to 1,247 msg/s · lag p95 down to 41ms · DLQ inflow stopped at 11:54:30.
              </div>
              <button className="dlq-btn" style={{marginTop:10, width:'100%'}}>Open pipeline overview</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  ArtDLQInspector, ArtDLQConfirm, ArtDLQProgress, ArtDLQResults,
});
