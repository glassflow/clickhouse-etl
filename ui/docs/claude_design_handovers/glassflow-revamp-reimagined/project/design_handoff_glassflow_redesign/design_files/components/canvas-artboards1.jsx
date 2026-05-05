// Canvas artboards 1-4: hero variants, two-topic join, OTLP

// ============ C1. KAFKA→CH HERO — Variant A (compact) ============
const ArtCanvasHeroA = () => {
  return (
    <div className="pc-stage">
      <PCHeader
        name="prod-orders-to-analytics"
        nameId="draft · pipeline_id: prod-orders-analytics-h8z9a"
        actions={<>
          <button className="btn btn-ghost btn-sm"><CIcon name="save" size={12}/> Save draft</button>
          <button className="btn btn-secondary btn-sm">Validate</button>
          <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill"><Icon name="schema" size={12}/> schema flow: <strong>OrderEvents v4</strong></div>
            <div className="pc-pill"><Icon name="check" size={12} color="var(--color-green-500)"/> 0 errors · 0 warnings</div>
            <div style={{flex:1}}/>
            <PCZoom level="92%"/>
          </PCToolbar>

          <div className="pc-flow">
            <div className="pc-row">
              <PCNode type="source" saved
                title="kafka-prod-eu"
                sub="orders.placed.v2"
                body={<span className="pc-schema-chip"><Icon name="schema" size={10}/> OrderEvents v4</span>}
              />
              <PCEdge/>
              <PCSlot hint="+ stage"/>
              <PCEdge/>
              <PCNode type="dedup" saved
                title="orders-dedup"
                sub="order_id · 5m"
                body={<div className="pc-node-body">
                  <div className="kv"><span className="k">key</span><span className="v">order_id</span></div>
                  <div className="kv"><span className="k">window</span><span className="v">5 min</span></div>
                </div>}
              />
              <PCEdge/>
              <PCSlot hint="+ stage"/>
              <PCEdge/>
              <PCNode type="filter"
                title="High-value orders"
                sub="unit_price_cents × quantity ≥ 5000"
                badge="inline"
                body={<div className="pc-node-body">
                  <div className="kv"><span className="k">passes</span><span className="v">~ 42%</span></div>
                </div>}
              />
              <PCEdge/>
              <PCSlot hint="+ stage"/>
              <PCEdge/>
              <PCNode type="transform" selected
                title="Add revenue_cents"
                sub="+ revenue_cents = price × qty"
                badge="inline"
                body={<div className="pc-node-body">
                  <div className="kv"><span className="k">schema</span><span className="v">OrderEvents + 1</span></div>
                </div>}
              />
              <PCEdge/>
              <PCSlot hint="+ stage"/>
              <PCEdge/>
              <PCNode type="sink" saved
                title="ch-analytics-prod"
                sub="analytics.orders"
                body={<div className="pc-node-body">
                  <div className="kv"><span className="k">mode</span><span className="v">append</span></div>
                  <div className="kv"><span className="k">cols</span><span className="v">15 → 15</span></div>
                </div>}
              />
            </div>
          </div>

          <PCMinimap/>
          <PCDeployBar
            status="Valid · ready to deploy"
            mono="OrderEvents v4 · snapshot @ now"
            actions={<>
              <button className="btn btn-ghost btn-sm">Discard</button>
              <button className="btn btn-secondary btn-sm"><CIcon name="save" size={12}/> Save as draft</button>
              <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy pipeline</button>
            </>}
          />
        </div>
        <PCDock activeTab="all" items={[
          { label: "Recommended · matches current schema", rows: [
            { type:"filter", glyph:"filter", name:"EU shipments only", sub:"shipping_country in EU_LIST", compat:true },
            { type:"transform", glyph:"transform", name:"Mask PII", sub:"hash(customer_id, email)", compat:true },
          ]},
          { label: "Sinks", rows: [
            { type:"sink", glyph:"ch", name:"ch-billing-prod", sub:"billing.orders_enriched" },
            { type:"sink", glyph:"ch", name:"ch-growth-analytics", sub:"growth.order_attribution" },
          ]},
          { label: "Sources", rows: [
            { type:"source", glyph:"kafka", name:"kafka-staging-eu", sub:"SASL/SCRAM · 2 pipelines" },
          ]},
          { label: "Schemas", rows: [
            { type:"schema", glyph:"schema", name:"UserSignups", sub:"v2 · 9 fields" },
            { type:"schema", glyph:"schema", name:"BillingTransactions", sub:"v7 · 22 fields" },
          ]},
        ]}/>
      </div>
    </div>
  );
};

// ============ C2. KAFKA→CH HERO — Variant B (wider + I/O pills) ============
const ArtCanvasHeroB = () => {
  return (
    <div className="pc-stage pc-stage-sunken">
      <PCHeader
        name="prod-orders-to-analytics"
        nameId="draft · pipeline_id: prod-orders-analytics-h8z9a"
        actions={<>
          <button className="btn btn-ghost btn-sm"><CIcon name="save" size={12}/> Save draft</button>
          <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill"><Icon name="schema" size={12}/> <strong>OrderEvents v4</strong> · 14 fields</div>
            <div className="pc-pill"><Icon name="check" size={12} color="var(--color-green-500)"/> valid</div>
            <div style={{flex:1}}/>
            <PCZoom level="100%"/>
          </PCToolbar>

          <div className="pc-flow">
            <div className="pc-row">
              <PCNodeB type="source" saved
                title="kafka-prod-eu"
                sub="topic: orders.placed.v2"
                inLabel="—"
                outLabel="OrderEvents v4"
              />
              <PCEdge width={40}/>
              <PCSlot/>
              <PCEdge width={40}/>
              <PCNodeB type="dedup" saved
                title="orders-dedup"
                sub="key=order_id, window=5m"
                inLabel="OrderEvents v4"
                outLabel="OrderEvents v4"
              />
              <PCEdge width={40}/>
              <PCSlot/>
              <PCEdge width={40}/>
              <PCNodeB type="filter" badge="inline"
                title="High-value orders"
                sub="price × qty ≥ 5000"
                inLabel="OrderEvents v4"
                outLabel="OrderEvents v4"
              />
              <PCEdge width={40}/>
              <PCSlot/>
              <PCEdge width={40}/>
              <PCNodeB type="transform" badge="inline" selected
                title="Add revenue_cents"
                sub="+ derived field"
                inLabel="OrderEvents v4"
                outLabel="+ revenue_cents"
              />
              <PCEdge width={40}/>
              <PCNodeB type="sink" saved
                title="ch-analytics-prod"
                sub="table: analytics.orders"
                inLabel="15 fields"
                outLabel="append"
              />
            </div>
          </div>

          <PCMinimap/>
          <PCDeployBar
            status="Valid · ready to deploy"
            mono="schema pinned @ v4"
            actions={<>
              <button className="btn btn-ghost btn-sm">Discard</button>
              <button className="btn btn-secondary btn-sm"><CIcon name="save" size={12}/> Save draft</button>
              <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
            </>}
          />
        </div>
        <PCDock items={[
          { label: "Processors", rows: [
            { type:"filter", glyph:"filter", name:"EU shipments", sub:"shipping_country in EU", compat:true },
            { type:"filter", glyph:"filter", name:"Refund events", sub:"event_type=refund" },
            { type:"transform", glyph:"transform", name:"Mask PII", sub:"hash customer_id", compat:true },
            { type:"dedup", glyph:"dedup", name:"session-dedup", sub:"session_id · 10m" },
          ]},
          { label: "Saved pipelines · clone", rows: [
            { type:"schema", glyph:"schema", name:"orders-to-billing", sub:"template · 4 stages" },
          ]},
        ]}/>
      </div>
    </div>
  );
};

// ============ C3. TWO-TOPIC JOIN → CH ============
const ArtCanvasJoin = () => {
  return (
    <div className="pc-stage">
      <PCHeader
        name="orders-enriched-with-customers"
        nameId="draft · two-topic join pipeline"
        actions={<>
          <button className="btn btn-secondary btn-sm">Validate</button>
          <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill"><Icon name="schema" size={12}/> join output: <strong>OrderEnriched v1</strong></div>
            <div className="pc-pill"><Icon name="info" size={12}/> two-topic join · stream + lookup</div>
            <div style={{flex:1}}/>
            <PCZoom level="80%"/>
          </PCToolbar>

          <div className="pc-flow" style={{padding:'20px 0'}}>
            <div style={{display:'grid', gridTemplateColumns:'auto auto auto auto auto auto auto auto auto', gridTemplateRows:'auto auto auto', alignItems:'center', columnGap:0, rowGap:40}}>
              {/* Top branch — stream */}
              <div style={{gridColumn:'1 / 2', gridRow:'1 / 2'}}>
                <PCNode type="source" saved topLabel="STREAM · KAFKA"
                  title="kafka-prod-eu"
                  sub="orders.placed.v2"
                  body={<span className="pc-schema-chip">OrderEvents v4</span>}
                />
              </div>
              <div style={{gridColumn:'2 / 3', gridRow:'1 / 2', display:'flex', alignItems:'center'}}><PCEdge/></div>
              <div style={{gridColumn:'3 / 4', gridRow:'1 / 2'}}><PCSlot hint="+ pre-join"/></div>
              <div style={{gridColumn:'4 / 5', gridRow:'1 / 2', display:'flex', alignItems:'center'}}><PCEdge/></div>
              <div style={{gridColumn:'5 / 6', gridRow:'1 / 2'}}>
                <PCNode type="dedup" saved
                  title="dedup-orders"
                  sub="order_id · 5m"
                />
              </div>
              <div style={{gridColumn:'6 / 7', gridRow:'1 / 2', display:'flex', alignItems:'center'}}><PCEdge/></div>

              {/* JOIN node spans rows 1-2 */}
              <div style={{gridColumn:'7 / 8', gridRow:'1 / 3', display:'flex', alignItems:'center'}}>
                <PCNode type="join"
                  title="Join on customer_id"
                  sub="left stream · right lookup"
                  body={<div className="pc-node-body">
                    <div className="kv"><span className="k">window</span><span className="v">10 min</span></div>
                    <div className="kv"><span className="k">missing</span><span className="v">keep null</span></div>
                  </div>}
                />
              </div>

              {/* Bottom branch — lookup */}
              <div style={{gridColumn:'1 / 2', gridRow:'3 / 4'}}>
                <PCNode type="source" saved topLabel="LOOKUP · KAFKA"
                  title="kafka-prod-eu"
                  sub="customers.updates.v1"
                  body={<span className="pc-schema-chip">Customers v2</span>}
                />
              </div>
              <div style={{gridColumn:'2 / 3', gridRow:'3 / 4', display:'flex', alignItems:'center'}}><PCEdge/></div>
              <div style={{gridColumn:'3 / 4', gridRow:'3 / 4'}}><PCSlot hint="+ pre-join"/></div>
              <div style={{gridColumn:'4 / 5', gridRow:'3 / 4', display:'flex', alignItems:'center'}}><PCEdge/></div>
              <div style={{gridColumn:'5 / 6', gridRow:'3 / 4'}}>
                <PCNode type="transform"
                  title="Select fields"
                  sub="customer_id, tier, country"
                  badge="inline"
                />
              </div>
              <div style={{gridColumn:'6 / 7', gridRow:'3 / 4', display:'flex', alignItems:'center'}}><PCEdge/></div>

              {/* Post-join tail — spans rows 1-2 (centered at row 2) */}
              <div style={{gridColumn:'8 / 9', gridRow:'1 / 3', display:'flex', alignItems:'center'}}><PCEdge/></div>
              <div style={{gridColumn:'9 / 10', gridRow:'1 / 3', display:'flex', alignItems:'center'}}>
                <PCNode type="sink" saved
                  title="ch-analytics-prod"
                  sub="analytics.orders_enriched"
                  body={<div className="pc-node-body">
                    <div className="kv"><span className="k">mode</span><span className="v">append</span></div>
                  </div>}
                />
              </div>
            </div>
          </div>

          <PCDeployBar
            status="Valid · 2 sources joined"
            mono="output: OrderEnriched v1"
            actions={<>
              <button className="btn btn-ghost btn-sm">Discard</button>
              <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
            </>}
          />
        </div>
        <PCDock items={[
          { label: "Compatible with join output", rows: [
            { type:"filter", glyph:"filter", name:"VIP customers", sub:"tier in (gold, platinum)", compat:true },
            { type:"transform", glyph:"transform", name:"Region bucket", sub:"country → region", compat:true },
          ]},
          { label: "Schemas · lookup side", rows: [
            { type:"schema", glyph:"schema", name:"Customers", sub:"v2 · 12 fields" },
          ]},
        ]}/>
      </div>
    </div>
  );
};

// ============ C4. OTLP → CH ============
const ArtCanvasOtlp = () => {
  return (
    <div className="pc-stage">
      <PCHeader
        name="otel-logs-to-clickhouse"
        nameId="draft · OTLP → ClickHouse"
        actions={<>
          <button className="btn btn-secondary btn-sm">Validate</button>
          <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
        </>}
      />
      <div style={{display:'flex', flex:1, minHeight:0, position:'relative'}}>
        <PCRail active="pointer"/>
        <div style={{flex:1, position:'relative'}}>
          <PCToolbar>
            <div className="pc-pill"><Icon name="otlp" size={12}/> OTLP receiver · <strong>logs</strong></div>
            <div className="pc-pill"><Icon name="info" size={12}/> no dedup stage · OTLP events are unique by id</div>
            <div style={{flex:1}}/>
            <PCZoom level="95%"/>
          </PCToolbar>

          <div className="pc-flow">
            <div className="pc-row">
              <PCNode type="otlp" saved
                title="otlp-ingest-eu"
                sub="grpc://0.0.0.0:4317"
                body={<span className="pc-schema-chip">OtelLogs v1</span>}
              />
              <PCEdge/>
              <PCSlot hint="+ stage"/>
              <PCEdge/>
              <PCNode type="filter"
                title="Exclude health checks"
                sub="attrs.route ≠ /healthz"
                badge="inline"
              />
              <PCEdge/>
              <PCSlot hint="+ stage"/>
              <PCEdge/>
              <PCNode type="transform" selected
                title="Flatten resource attrs"
                sub="resource.* → top-level"
                badge="inline"
                body={<div className="pc-node-body">
                  <div className="kv"><span className="k">schema</span><span className="v">OtelLogs + 4</span></div>
                </div>}
              />
              <PCEdge/>
              <PCSlot hint="+ stage"/>
              <PCEdge/>
              <PCNode type="sink" saved
                title="ch-observability"
                sub="obs.otel_logs_flat"
                body={<div className="pc-node-body">
                  <div className="kv"><span className="k">cols</span><span className="v">18 → 18</span></div>
                </div>}
              />
            </div>
          </div>

          <PCDeployBar
            status="Valid · ready to deploy"
            mono="OtelLogs v1"
            actions={<>
              <button className="btn btn-ghost btn-sm">Discard</button>
              <button className="btn btn-primary btn-sm"><CIcon name="rocket" size={12}/> Deploy</button>
            </>}
          />
        </div>
        <PCDock items={[
          { label: "Compatible with OtelLogs v1", rows: [
            { type:"filter", glyph:"filter", name:"Error-level only", sub:"severity_text = ERROR", compat:true },
            { type:"transform", glyph:"transform", name:"Parse body JSON", sub:"body → fields", compat:true },
          ]},
          { label: "Sinks", rows: [
            { type:"sink", glyph:"ch", name:"ch-observability", sub:"obs.otel_logs_flat" },
          ]},
        ]}/>
      </div>
    </div>
  );
};

Object.assign(window, { ArtCanvasHeroA, ArtCanvasHeroB, ArtCanvasJoin, ArtCanvasOtlp });
