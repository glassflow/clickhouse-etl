// Canvas primitives: node renderers (variant A + B), edges, slots, library dock

// ============ ICONS (extend the Icon set) ============
const CIcon = ({ name, size = 14, color = "currentColor", strokeWidth = 1.75 }) => {
  const s = { width: size, height: size, stroke: color, strokeWidth, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "zoom-in":  return (<svg viewBox="0 0 24 24" {...s}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>);
    case "zoom-out": return (<svg viewBox="0 0 24 24" {...s}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></svg>);
    case "fit":      return (<svg viewBox="0 0 24 24" {...s}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>);
    case "undo":     return (<svg viewBox="0 0 24 24" {...s}><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>);
    case "redo":     return (<svg viewBox="0 0 24 24" {...s}><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/></svg>);
    case "pointer":  return (<svg viewBox="0 0 24 24" {...s}><path d="m4 4 8 16 2.5-6.5L21 11z"/></svg>);
    case "hand":     return (<svg viewBox="0 0 24 24" {...s}><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V5a1.5 1.5 0 0 1 3 0v5M13 10V6.5a1.5 1.5 0 0 1 3 0V12M7 11v6a5 5 0 0 0 5 5h1a5 5 0 0 0 5-5v-5.5a1.5 1.5 0 0 0-3 0"/></svg>);
    case "grip":     return (<svg viewBox="0 0 24 24" fill={color} stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>);
    case "ai":       return (<svg viewBox="0 0 24 24" {...s}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/><circle cx="12" cy="12" r="3"/></svg>);
    case "rocket":   return (<svg viewBox="0 0 24 24" {...s}><path d="M14 10 7 17l-3-3 7-7"/><path d="M14 10a6 6 0 0 0 6-6 6 6 0 0 0-6 6zM11 17l3 3M4 14 7 11"/></svg>);
    case "save":     return (<svg viewBox="0 0 24 24" {...s}><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h8V4M8 15h8"/></svg>);
    case "lock":     return (<svg viewBox="0 0 24 24" {...s}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>);
    default: return <Icon name={name} size={size} color={color}/>;
  }
};

// ============ TYPE META ============
const NODE_TYPE_META = {
  source:    { label: "SOURCE",    klass: "is-source",    icon: "kafka" },
  otlp:      { label: "SOURCE · OTLP", klass: "is-source", icon: "otlp" },
  schema:    { label: "SCHEMA",    klass: "is-processor", icon: "schema" },
  dedup:     { label: "DEDUP",     klass: "is-processor", icon: "dedup" },
  filter:    { label: "FILTER",    klass: "is-processor", icon: "filter" },
  transform: { label: "TRANSFORM", klass: "is-processor", icon: "transform" },
  join:      { label: "JOIN",      klass: "is-processor", icon: "dedup" },
  sink:      { label: "SINK",      klass: "is-sink",      icon: "ch" },
};

// ============ NODE VARIANT A (compact) ============
const PCNode = ({
  type, title, sub, saved, badge, warn, err, selected, aiPlaced, body, topLabel
}) => {
  const meta = NODE_TYPE_META[type] || NODE_TYPE_META.source;
  let cls = `pc-node ${meta.klass}`;
  if (warn) cls += " is-warn";
  if (err) cls += " is-err";
  if (selected) cls += " is-selected";
  if (aiPlaced) cls += " is-ai-placed";
  return (
    <div className={cls}>
      <div className="pc-node-head">
        <Icon name={meta.icon} size={12}/>
        <span>{topLabel || meta.label}</span>
        {aiPlaced ? <span className="pc-ai-chip" style={{marginLeft:'auto'}}>AI</span>
          : saved ? <span className="pc-badge-saved">saved</span>
          : badge ? <span className="pc-badge-inline">{badge}</span> : null}
      </div>
      <div className="pc-node-title">{title}</div>
      {sub && <div className="pc-node-sub">{sub}</div>}
      {body}
    </div>
  );
};

// ============ NODE VARIANT B (banner + I/O) ============
const PCNodeB = ({
  type, title, sub, saved, inLabel, outLabel, badge, warn, err, selected, aiPlaced, body
}) => {
  const meta = NODE_TYPE_META[type] || NODE_TYPE_META.source;
  let cls = `pc-node-b ${meta.klass}`;
  if (warn) cls += " is-warn";
  if (err) cls += " is-err";
  if (selected) cls += " is-selected";
  if (aiPlaced) cls += " is-ai-placed";
  return (
    <div className={cls}>
      <div className="pc-node-b-banner">
        <Icon name={meta.icon} size={12}/>
        <span>{meta.label}</span>
        {aiPlaced ? <span className="pc-ai-chip ml-auto">AI</span>
          : saved ? <span className="pc-badge-saved ml-auto">saved</span>
          : badge ? <span className="pc-badge-inline ml-auto">{badge}</span> : null}
      </div>
      <div className="pc-node-b-body">
        <div className="pc-node-b-title">{title}</div>
        {sub && <div className="pc-node-b-sub">{sub}</div>}
        {body}
        {(inLabel || outLabel) && (
          <div className="pc-io">
            <div className="io">
              <div className="lbl">in</div>
              <div className="val">{inLabel || "—"}</div>
            </div>
            <div className="io right">
              <div className="lbl">out</div>
              <div className="val">{outLabel || "—"}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============ EDGE with optional slot ============
const PCEdge = ({ width = 56 }) => <div className="pc-edge" style={{width}}/>;

const PCSlot = ({ open, dropTarget, picker, hint }) => (
  <div className="pc-slot" style={{margin:'0 10px'}}>
    <button className={`pc-slot-btn ${open?'is-open':''} ${dropTarget?'is-drop-target':''}`}>
      <Icon name="plus" size={14}/>
    </button>
    {hint && !open && <div className="pc-slot-hint">{hint}</div>}
    {open && picker}
  </div>
);

// Slot picker with compatible / incompatible stage options
const PCSlotPicker = ({ contextLabel, compatible, incompatible }) => (
  <div className="pc-slot-picker">
    <div className="pc-slot-picker-head">
      <h4>Insert stage</h4>
      <p>{contextLabel || "Only stages compatible with the surrounding schema can be inserted."}</p>
    </div>
    <div className="pc-slot-picker-body">
      {compatible.map((o, i) => (
        <div key={i} className="pc-slot-option">
          <span className={`glyph g-${o.glyph||o.type}`} style={{width:28, height:28, borderRadius:6}}>
            <Icon name={NODE_TYPE_META[o.type]?.icon || o.type} size={14}/>
          </span>
          <div>
            <div className="so-title">{o.title}</div>
            <div className="so-sub">{o.sub}</div>
          </div>
          <div className="so-meta">{o.meta || "compatible"}</div>
        </div>
      ))}
      {incompatible && incompatible.length > 0 && (
        <>
          <div className="pc-dock-section-label" style={{marginTop: 4}}>Not available here</div>
          {incompatible.map((o, i) => (
            <div key={i} className="pc-slot-option is-disabled">
              <span className={`glyph g-${o.glyph||o.type}`} style={{width:28, height:28, borderRadius:6}}>
                <Icon name={NODE_TYPE_META[o.type]?.icon || o.type} size={14}/>
              </span>
              <div>
                <div className="so-title">{o.title}</div>
                <div className="so-sub">{o.sub}</div>
              </div>
              <div className="so-meta is-lock">
                <CIcon name="lock" size={11} color="var(--color-yellow-400)"/> {o.reason}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
    <div className="pc-slot-picker-footer">
      <span>Legal stages here: <span className="mono">dedup</span>, <span className="mono">filter</span>, <span className="mono">transform</span></span>
      <a>Browse library →</a>
    </div>
  </div>
);

// ============ LIBRARY DOCK ============
const PCDock = ({ activeTab = "all", items, dragging }) => (
  <aside className="pc-dock">
    <div className="pc-dock-head">
      <h3>Library</h3>
      <p>Drag onto a slot, or use <span className="mono">+</span> to pick inline.</p>
    </div>
    <div className="pc-dock-tabs">
      {["All","Sources","Schemas","Processors","Sinks"].map((t,i)=>(
        <button key={i} className={`pc-dock-tab ${t.toLowerCase()===activeTab?'is-active':''}`}>{t}</button>
      ))}
    </div>
    <div className="pc-dock-body">
      <div style={{position:'relative'}}>
        <div style={{position:'absolute', left:10, top:9, color:'var(--color-gray-dark-500)'}}><Icon name="search" size={12}/></div>
        <input className="input" placeholder="Search library…" style={{paddingLeft:30, height:30, fontSize:12}}/>
      </div>
      {items.map((group, gi) => (
        <React.Fragment key={gi}>
          <div className="pc-dock-section-label">{group.label}</div>
          {group.rows.map((r, i) => (
            <div key={i} className={`pc-dock-item ${r.compat?'is-compat':''} ${dragging===r.key?'is-dragging':''}`}>
              <span className={`glyph g-${r.glyph||r.type}`} style={{width:28, height:28, borderRadius:6}}>
                <Icon name={NODE_TYPE_META[r.type]?.icon || r.type} size={13}/>
              </span>
              <div>
                <div className="di-name">{r.name}</div>
                <div className="di-sub">{r.sub}</div>
              </div>
              <CIcon name="grip" size={14} color="var(--color-gray-dark-500)"/>
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  </aside>
);

// ============ CANVAS HEADER + TOOL RAIL ============
const PCHeader = ({ name, nameId, step, actions }) => (
  <div className="pc-header">
    <div className="ttl">
      <CIcon name="chevR" size={14} color="var(--color-gray-dark-500)"/>
      <div>
        <h2>{name}</h2>
        <div className="name-sub">{nameId}</div>
      </div>
      {step && <span className="pc-step-indicator"><Icon name="pipelines" size={10}/> {step}</span>}
    </div>
    <div style={{flex:1}}/>
    <div className="flex gap-2 items-center">{actions}</div>
  </div>
);

const PCRail = ({ active = "pointer" }) => (
  <div className="pc-rail">
    <button className={active==="pointer"?"is-active":""} title="Select"><CIcon name="pointer" size={16}/></button>
    <button className={active==="hand"?"is-active":""} title="Pan"><CIcon name="hand" size={16}/></button>
    <div className="sep"/>
    <button title="Undo"><CIcon name="undo" size={16}/></button>
    <button title="Redo"><CIcon name="redo" size={16}/></button>
    <div className="sep"/>
    <button title="Fit"><CIcon name="fit" size={16}/></button>
    <button title="Zoom in"><CIcon name="zoom-in" size={16}/></button>
    <button title="Zoom out"><CIcon name="zoom-out" size={16}/></button>
    <div style={{flex:1}}/>
    <button title="AI assistant"><CIcon name="ai" size={16} color="#b794ff"/></button>
  </div>
);

const PCToolbar = ({ children }) => <div className="pc-toolbar">{children}</div>;

const PCZoom = ({ level = "100%" }) => (
  <div className="pc-zoom">
    <button><CIcon name="zoom-out" size={12}/></button>
    <span className="label">{level}</span>
    <button><CIcon name="zoom-in" size={12}/></button>
  </div>
);

const PCDeployBar = ({ status = "Valid · ready to deploy", mono, actions }) => (
  <div className="pc-deploy-bar">
    <div className="status"><span className="dot ok"/> {status}</div>
    {mono && <span className="mono">{mono}</span>}
    <div className="spacer"/>
    <div className="actions">{actions}</div>
  </div>
);

// ============ MODAL ============
const PCModal = ({ icon, title, subtitle, onClose, children, footer, wide }) => (
  <div className="pc-modal-backdrop">
    <div className={`pc-modal ${wide?'wide':''}`}>
      <div className="pc-modal-head">
        <div className="icon"><Icon name={icon || "edit"} size={16}/></div>
        <div className="ttl">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div style={{flex:1}}/>
        <button className="close-btn" onClick={onClose}><Icon name="x" size={14}/></button>
      </div>
      <div className="pc-modal-body">{children}</div>
      {footer && <div className="pc-modal-foot">{footer}</div>}
    </div>
  </div>
);

// ============ MINIMAP ============
const PCMinimap = ({ nodes = 4 }) => (
  <div className="pc-minimap">
    <div className="mm-title">Overview</div>
    <div className="mm-flow">
      <div className="mm-node src"/>
      <div className="mm-edge"/>
      <div className="mm-node"/>
      <div className="mm-edge"/>
      <div className="mm-node"/>
      <div className="mm-edge"/>
      <div className="mm-node snk"/>
    </div>
    <div className="mm-view"/>
  </div>
);

Object.assign(window, {
  CIcon, NODE_TYPE_META,
  PCNode, PCNodeB, PCEdge, PCSlot, PCSlotPicker,
  PCDock, PCHeader, PCRail, PCToolbar, PCZoom,
  PCDeployBar, PCModal, PCMinimap,
});
