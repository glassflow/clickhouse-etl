// Shared primitives: AppShell chrome, SVG icons, small widgets.
// Attaches everything to window so other Babel scripts can use them.

const Icon = ({ name, size = 16, color = "currentColor", strokeWidth = 1.75 }) => {
  const s = { width: size, height: size, stroke: color, strokeWidth, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "plus":     return (<svg viewBox="0 0 24 24" {...s}><path d="M12 5v14M5 12h14"/></svg>);
    case "search":   return (<svg viewBox="0 0 24 24" {...s}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>);
    case "folder":   return (<svg viewBox="0 0 24 24" {...s}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>);
    case "chevR":    return (<svg viewBox="0 0 24 24" {...s}><path d="m9 6 6 6-6 6"/></svg>);
    case "chevD":    return (<svg viewBox="0 0 24 24" {...s}><path d="m6 9 6 6 6-6"/></svg>);
    case "more":     return (<svg viewBox="0 0 24 24" fill={color} stroke="none"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>);
    case "pipelines": return (<svg viewBox="0 0 24 24" {...s}><path d="M3 6h10"/><path d="M11 12h10"/><path d="M3 18h10"/></svg>);
    case "dash":     return (<svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>);
    case "library":  return (<svg viewBox="0 0 24 24" {...s}><path d="M4 5v14"/><path d="M8 5v14"/><path d="M13 5h7v14h-7z"/></svg>);
    case "obs":      return (<svg viewBox="0 0 24 24" {...s}><path d="M3 12h3l2-6 4 12 2-6h7"/></svg>);
    case "help":     return (<svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7"/><path d="M12 17h.01"/></svg>);
    case "kafka":    return (<svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="12" cy="18" r="2"/><path d="M12 8v2M12 14v2M8 12h2M14 12h2"/></svg>);
    case "ch":       return (<svg viewBox="0 0 24 24" {...s}><rect x="4" y="5" width="3" height="14"/><rect x="9" y="5" width="3" height="14"/><rect x="14" y="5" width="3" height="8"/><rect x="19" y="9" width="1" height="6"/></svg>);
    case "schema":   return (<svg viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M10 4v16"/></svg>);
    case "dedup":    return (<svg viewBox="0 0 24 24" {...s}><rect x="4" y="4" width="10" height="10" rx="2"/><rect x="10" y="10" width="10" height="10" rx="2"/></svg>);
    case "filter":   return (<svg viewBox="0 0 24 24" {...s}><path d="M4 5h16l-6 8v6l-4-2v-4z"/></svg>);
    case "transform":return (<svg viewBox="0 0 24 24" {...s}><path d="M4 7h11l-3-3M20 17H9l3 3"/></svg>);
    case "otlp":     return (<svg viewBox="0 0 24 24" {...s}><path d="M12 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/><path d="M8 8a5 5 0 0 1 8 0M6 6a8 8 0 0 1 12 0M12 18v2"/></svg>);
    case "warn":     return (<svg viewBox="0 0 24 24" {...s}><path d="M12 3 2 20h20z"/><path d="M12 10v5M12 17.5v.5"/></svg>);
    case "info":     return (<svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.5"/></svg>);
    case "check":    return (<svg viewBox="0 0 24 24" {...s}><path d="m5 12 5 5 9-11"/></svg>);
    case "x":        return (<svg viewBox="0 0 24 24" {...s}><path d="m6 6 12 12M18 6 6 18"/></svg>);
    case "edit":     return (<svg viewBox="0 0 24 24" {...s}><path d="M4 20h4l10-10-4-4L4 16z"/><path d="m14 6 4 4"/></svg>);
    case "clone":    return (<svg viewBox="0 0 24 24" {...s}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>);
    case "link":     return (<svg viewBox="0 0 24 24" {...s}><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>);
    case "play":     return (<svg viewBox="0 0 24 24" fill={color} stroke="none"><path d="M6 4v16l14-8z"/></svg>);
    case "stop":     return (<svg viewBox="0 0 24 24" fill={color} stroke="none"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>);
    case "drift":    return (<svg viewBox="0 0 24 24" {...s}><path d="M4 7h16M4 17h16M8 12h8"/><path d="M16 4v4M20 10v4M8 12v4M4 18v-4"/></svg>);
    case "history":  return (<svg viewBox="0 0 24 24" {...s}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 8v4l3 2"/></svg>);
    case "tag":      return (<svg viewBox="0 0 24 24" {...s}><path d="M20 12 12 4H4v8l8 8z"/><circle cx="8" cy="8" r="1.25" fill={color} stroke="none"/></svg>);
    case "trash":    return (<svg viewBox="0 0 24 24" {...s}><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13h10l1-13"/></svg>);
    case "download": return (<svg viewBox="0 0 24 24" {...s}><path d="M12 4v12m-4-4 4 4 4-4M4 20h16"/></svg>);
    case "sparkles": return (<svg viewBox="0 0 24 24" {...s}><path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5l2.5-2.5M15 9l2.5-2.5"/></svg>);
    case "reload":   return (<svg viewBox="0 0 24 24" {...s}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>);
    default: return null;
  }
};

const AppShell = ({ activeNav = "library", children }) => (
  <div className="app-shell">
    <div className="app-topbar">
      <div className="app-logo"><span className="logo-mark"/>GlassFlow</div>
      <div className="app-nav">
        <div className={`app-nav-item ${activeNav==='dashboard'?'is-active':''}`}><Icon name="dash" size={14}/> Dashboard</div>
        <div className={`app-nav-item ${activeNav==='pipelines'?'is-active':''}`}><Icon name="pipelines" size={14}/> Pipelines</div>
        <div className={`app-nav-item ${activeNav==='library'?'is-active':''}`}><Icon name="library" size={14}/> Library</div>
        <div className={`app-nav-item ${activeNav==='obs'?'is-active':''}`}><Icon name="obs" size={14}/> Observability</div>
        <div className="app-nav-item is-plus" style={{marginLeft: 12}}><Icon name="plus" size={14}/> Create</div>
      </div>
      <div className="app-nav-right">
        <div className="app-nav-item"><Icon name="help" size={14}/> Help</div>
        <div className="app-avatar">VC</div>
      </div>
    </div>
    <div className="app-body">{children}</div>
  </div>
);

const LibrarySide = ({ active = "schemas" }) => (
  <aside className="lib-side">
    <div className="lib-side-title">Library</div>
    <div className={`lib-side-row ${active==='all'?'is-active':''}`}>
      <Icon name="library" size={14}/> All components <span className="count">47</span>
    </div>
    <div className={`lib-side-row ${active==='kafka'?'is-active':''}`}>
      <Icon name="kafka" size={14}/> Kafka connections <span className="count">8</span>
    </div>
    <div className={`lib-side-row ${active==='ch'?'is-active':''}`}>
      <Icon name="ch" size={14}/> ClickHouse connections <span className="count">5</span>
    </div>
    <div className={`lib-side-row ${active==='schemas'?'is-active':''}`}>
      <Icon name="schema" size={14}/> Schemas <span className="count">12</span>
    </div>
    <div className={`lib-side-row ${active==='dedup'?'is-active':''}`}>
      <Icon name="dedup" size={14}/> Dedup configs <span className="count">6</span>
    </div>
    <div className={`lib-side-row ${active==='filter'?'is-active':''}`}>
      <Icon name="filter" size={14}/> Filter configs <span className="count">9</span>
    </div>
    <div className={`lib-side-row ${active==='transform'?'is-active':''}`}>
      <Icon name="transform" size={14}/> Transform configs <span className="count">7</span>
    </div>

    <div className="lib-side-title">Folders</div>
    <div className="lib-side-row folder-row"><span className="folder-chevron">▾</span><Icon name="folder" size={14}/> Production <span className="count">18</span></div>
    <div className="lib-side-row folder-row indent"><Icon name="folder" size={14}/> analytics <span className="count">7</span></div>
    <div className="lib-side-row folder-row indent"><Icon name="folder" size={14}/> billing <span className="count">6</span></div>
    <div className="lib-side-row folder-row indent"><Icon name="folder" size={14}/> growth <span className="count">5</span></div>
    <div className="lib-side-row folder-row"><span className="folder-chevron">▸</span><Icon name="folder" size={14}/> Staging <span className="count">14</span></div>
    <div className="lib-side-row folder-row"><span className="folder-chevron">▸</span><Icon name="folder" size={14}/> Team A <span className="count">9</span></div>
    <div className="lib-side-row folder-row"><span className="folder-chevron">▸</span><Icon name="folder" size={14}/> Uncategorised <span className="count">6</span></div>

    <div className="lib-side-title">Tags</div>
    <div style={{display:'flex', flexWrap:'wrap', gap:6, padding:'4px 10px'}}>
      <span className="tag">kafka-prod</span>
      <span className="tag">clickhouse-analytics</span>
      <span className="tag">otlp</span>
      <span className="tag">pii</span>
      <span className="tag">dedup-user</span>
      <span className="tag">+7</span>
    </div>
  </aside>
);

// Tiny glyph for type chips
const TypeGlyph = ({ type, size = 20 }) => {
  const className = `glyph g-${type}`;
  const iconName = { kafka: "kafka", ch: "ch", schema: "schema", dedup: "dedup", filter: "filter", transform: "transform" }[type] || "schema";
  const style = { width: size + 8, height: size + 8 };
  return (<span className={className} style={style}><Icon name={iconName} size={size-4}/></span>);
};

// Artboard wrapper with an annotation block pinned under
const Annot = ({ children }) => <div className="annot"><strong>NOTE</strong>{children}</div>;

Object.assign(window, { Icon, AppShell, LibrarySide, TypeGlyph, Annot });
