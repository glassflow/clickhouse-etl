// AI Assistant primitives — shared bits for chat artboards

const AIMsgUser = ({ children, time }) => (
  <div className="ai-msg user">
    <div className="avatar">VC</div>
    <div>
      <div className="ai-bubble">{children}</div>
      {time && <div className="ai-msg-meta" style={{textAlign:'right'}}>{time}</div>}
    </div>
  </div>
);

const AIMsgAI = ({ children, time, thinking }) => (
  <div className="ai-msg ai">
    <div className="avatar"><CIcon name="ai" size={13}/></div>
    <div>
      {thinking && <div className="ai-thinking" style={{marginBottom:8}}><span className="pulse"/>{thinking}</div>}
      <div className="ai-bubble">{children}</div>
      {time && <div className="ai-msg-meta">{time}</div>}
    </div>
  </div>
);

const AIBecause = ({ children }) => (
  <span className="ai-because" title="Source attribution">
    <Icon name="info" size={10}/>{children}
  </span>
);

const AILibChip = ({ icon = "kafka", name }) => (
  <span className="ai-lib-chip">
    <Icon name={icon} size={10}/>{name}
  </span>
);

const AIPickCard = ({ title, opts }) => (
  <div className="ai-pick-card">
    <div className="ai-pick-head"><Icon name="info" size={11}/> {title}</div>
    <div className="ai-pick-opts">
      {opts.map((o,i)=>(
        <div key={i} className={`ai-pick-opt ${o.lib?'is-lib':''} ${o.selected?'is-selected':''}`}>
          <div className="glyph"><Icon name={o.icon || 'kafka'} size={13}/></div>
          <div>
            <div className="po-title">{o.title}</div>
            <div className="po-sub">{o.sub}</div>
          </div>
          <div className="po-badge">{o.badge || (o.lib?'library':'new')}</div>
        </div>
      ))}
    </div>
  </div>
);

const AIComposer = ({ value = "", suggestions, placeholder = "Describe the pipeline you want to build…" }) => (
  <div className="ai-composer">
    <div className="ai-composer-box">
      <textarea className="ai-composer-input" placeholder={placeholder} defaultValue={value}/>
      <div className="ai-composer-row">
        <button className="ai-composer-tool"><Icon name="plus" size={11}/> Attach</button>
        <button className="ai-composer-tool"><Icon name="library" size={11}/> Library</button>
        <button className="ai-composer-tool"><Icon name="schema" size={11}/> Paste schema</button>
        <button className="ai-composer-send" disabled={!value}><CIcon name="ai" size={11} color="#0a0a0c"/> Send</button>
      </div>
    </div>
    {suggestions && (
      <div className="ai-suggestions">
        {suggestions.map((s,i)=>(<div key={i} className="ai-suggest-chip">{s}</div>))}
      </div>
    )}
  </div>
);

const AIChatHead = ({ title = "Pipeline assistant", sub = "new conversation · haiku-4.5", actions }) => (
  <div className="ai-chat-head">
    <div className="mark"><CIcon name="ai" size={16}/></div>
    <div>
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
    <div style={{flex:1}}/>
    {actions}
  </div>
);

const AISummaryBar = ({ stats, actions }) => (
  <div className="ai-summary-bar">
    {stats.map((s,i)=>(
      <React.Fragment key={i}>
        {i>0 && <div className="sep"/>}
        <div className="stat">{s.icon && <Icon name={s.icon} size={12}/>} <strong>{s.k}</strong> <span className="mono">{s.v}</span></div>
      </React.Fragment>
    ))}
    <div className="actions">{actions}</div>
  </div>
);

Object.assign(window, {
  AIMsgUser, AIMsgAI, AIBecause, AILibChip, AIPickCard,
  AIComposer, AIChatHead, AISummaryBar,
});
