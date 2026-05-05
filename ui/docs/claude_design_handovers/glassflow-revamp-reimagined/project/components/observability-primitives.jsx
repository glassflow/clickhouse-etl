// =============================================================
// observability-primitives.jsx
// Chart primitives + log line + filter pills, observability surfaces.
// All visuals via tokens; no hardcoded chart colors.
// =============================================================
const { Icon: OBCIcon } = window;

// --- deterministic noisy series generator (mulberry32) ---
function obSeeded(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function obSeries({seed = 1, n = 72, base = 50, amp = 30, drift = 0, spike = null, dipAt = null, floor = 0}) {
  const r = obSeeded(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const noise = (r() - 0.5) * amp;
    const wave = Math.sin(i / 7) * (amp * 0.6) + Math.sin(i / 3.1) * (amp * 0.25);
    let v = base + wave + noise + drift * i;
    if (spike && i === spike.at) v += spike.amount;
    if (dipAt && i === dipAt) v -= amp * 1.4;
    out.push(Math.max(floor, v));
  }
  return out;
}

// --- low-level chart SVG ---
const OBChartSVG = ({
  width = 460, height = 130,
  series, // array of { values, color, dashed?, fill? }
  yMax = null, yMin = 0,
  showAxis = true, showGrid = true,
  showCrosshair = false, crosshairAt = 0.7,
  showBrush = false, brushFrom = 0.55, brushTo = 0.78,
  pad = { l: 32, r: 8, t: 6, b: 18 }
}) => {
  if (!series || !series.length) return null;
  const n = series[0].values.length;
  const allValues = series.flatMap(s => s.values);
  const max = yMax !== null ? yMax : Math.max(...allValues) * 1.15;
  const min = yMin;
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const x = (i) => pad.l + (i / (n - 1)) * w;
  const y = (v) => pad.t + h - ((v - min) / (max - min)) * h;
  const yTicks = 4;
  const xTicks = 6;
  const fmt = (v) => {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    if (v >= 100) return v.toFixed(0);
    if (v >= 10)  return v.toFixed(1);
    return v.toFixed(2);
  };

  const buildPath = (vals) => {
    let d = '';
    vals.forEach((v, i) => {
      d += (i === 0 ? 'M' : 'L') + x(i).toFixed(2) + ',' + y(v).toFixed(2) + ' ';
    });
    return d;
  };
  const buildArea = (vals) => {
    let d = `M ${x(0)},${y(min)} `;
    vals.forEach((v, i) => { d += `L ${x(i).toFixed(2)},${y(v).toFixed(2)} `; });
    d += `L ${x(n - 1)},${y(min)} Z`;
    return d;
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display:'block'}}>
      {/* gridlines */}
      {showGrid && Array.from({length: yTicks + 1}, (_, i) => {
        const yy = pad.t + (h * i / yTicks);
        return <line key={'gy'+i} x1={pad.l} y1={yy} x2={pad.l + w} y2={yy} stroke="#15151b" strokeDasharray="2 4"/>;
      })}
      {showGrid && Array.from({length: xTicks + 1}, (_, i) => {
        const xx = pad.l + (w * i / xTicks);
        return <line key={'gx'+i} x1={xx} y1={pad.t} x2={xx} y2={pad.t + h} stroke="#0f0f15"/>;
      })}
      {/* y-axis labels */}
      {showAxis && Array.from({length: yTicks + 1}, (_, i) => {
        const v = max - ((max - min) * i / yTicks);
        const yy = pad.t + (h * i / yTicks);
        return <text key={'yl'+i} x={pad.l - 6} y={yy + 3} textAnchor="end" fill="#5a5a64" fontFamily="JetBrains Mono, monospace" fontSize="9">{fmt(v)}</text>;
      })}
      {/* x-axis labels (relative time) */}
      {showAxis && [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const xx = pad.l + w * t;
        const labels = ['-1h', '-45m', '-30m', '-15m', 'now'];
        return <text key={'xl'+i} x={xx} y={height - 4} textAnchor="middle" fill="#5a5a64" fontFamily="JetBrains Mono, monospace" fontSize="9">{labels[i]}</text>;
      })}

      {/* fill areas (under primary series) */}
      {series.map((s, i) => s.fill && (
        <path key={'fa'+i} d={buildArea(s.values)} fill={s.fill} opacity="0.28"/>
      ))}

      {/* lines */}
      {series.map((s, i) => (
        <path
          key={'ln'+i}
          d={buildPath(s.values)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.weight || 1.5}
          strokeDasharray={s.dashed ? '4 3' : ''}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* brush selection (range pinned to logs) */}
      {showBrush && (
        <g>
          <rect
            x={pad.l + w * brushFrom}
            y={pad.t}
            width={w * (brushTo - brushFrom)}
            height={h}
            fill="rgba(232, 145, 89, 0.13)"
          />
          <line x1={pad.l + w * brushFrom} y1={pad.t} x2={pad.l + w * brushFrom} y2={pad.t + h} stroke="rgba(232, 145, 89, 0.6)" strokeWidth="1"/>
          <line x1={pad.l + w * brushTo}   y1={pad.t} x2={pad.l + w * brushTo}   y2={pad.t + h} stroke="rgba(232, 145, 89, 0.6)" strokeWidth="1"/>
        </g>
      )}

      {/* crosshair */}
      {showCrosshair && (
        <g>
          <line
            x1={pad.l + w * crosshairAt}
            y1={pad.t}
            x2={pad.l + w * crosshairAt}
            y2={pad.t + h}
            stroke="rgba(232, 145, 89, 0.55)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {series.map((s, i) => {
            const idx = Math.round((n - 1) * crosshairAt);
            return <circle key={'cd'+i} cx={pad.l + w * crosshairAt} cy={y(s.values[idx])} r="3" fill={s.color} stroke="#08080a" strokeWidth="1"/>;
          })}
        </g>
      )}
    </svg>
  );
};

// --- Sparkline (small) for summary cards ---
const OBSpark = ({ values, color = 'var(--color-orange-300)', width = 160, height = 36 }) => {
  const max = Math.max(...values) * 1.1;
  const min = Math.min(...values) * 0.9;
  const w = width;
  const h = height;
  const n = values.length;
  const x = (i) => (i / (n - 1)) * w;
  const y = (v) => h - ((v - min) / (max - min || 1)) * h;
  let d = '';
  let dArea = `M 0,${h} `;
  values.forEach((v, i) => {
    d += (i === 0 ? 'M' : 'L') + x(i).toFixed(2) + ',' + y(v).toFixed(2) + ' ';
    dArea += `L ${x(i).toFixed(2)},${y(v).toFixed(2)} `;
  });
  dArea += `L ${w},${h} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={dArea} fill={color} opacity="0.18"/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
};

// --- High-level metric chart card ---
const OBChart = ({
  title, sub, value, unit, delta, deltaTone = 'up',
  series, yMax,
  showCrosshair, crosshairAt,
  showBrush, brushFrom, brushTo,
  legend,
  focused = false,
  height = 150,
  toolbar = null,
  brushLabel,
  children
}) => {
  return (
    <div className={"ob-chart" + (focused ? ' is-focused' : '')}>
      <div className="ob-chart-head">
        <div>
          <div className="ob-chart-title">{title}</div>
          {sub && <div className="ob-chart-sub">{sub}</div>}
        </div>
        <div className="ob-chart-current">
          <div className="value">
            {value}
            {unit && <span className="unit">{unit}</span>}
          </div>
          {delta && <div className={"delta " + deltaTone}>{delta}</div>}
        </div>
      </div>
      <div className="ob-chart-body" style={{position:'relative'}}>
        {showBrush && brushLabel && (
          <div className="ob-brush-label" style={{
            left: ((brushFrom + brushTo) / 2 * 100) + '%'
          }}>{brushLabel}</div>
        )}
        <OBChartSVG
          width={focused ? 1180 : 460}
          height={height}
          series={series}
          yMax={yMax}
          showCrosshair={showCrosshair}
          crosshairAt={crosshairAt}
          showBrush={showBrush}
          brushFrom={brushFrom}
          brushTo={brushTo}
        />
        {children}
      </div>
      {legend && (
        <div className="ob-legend">
          {legend.map((l, i) => (
            <div key={i} className="ob-legend-item">
              <span className="sw" style={{background: l.color, ...(l.dashed ? {borderTop:'2px dashed '+l.color, background:'transparent'} : {})}}/>
              <span>{l.label}</span>
              {l.value && <span className="v">{l.value}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Time range selector ---
const OBRangePicker = ({ value = '1h' }) => {
  const ranges = ['15m', '1h', '6h', '24h', '7d'];
  return (
    <div className="ob-range">
      {ranges.map((r, i) => (
        <React.Fragment key={r}>
          <div className={"ob-range-item" + (r === value ? ' is-active' : '')}>{r}</div>
          {i < ranges.length - 1 && <div className="ob-range-divider"/>}
        </React.Fragment>
      ))}
      <div className="ob-range-divider"/>
      <div className="ob-range-item" style={{display:'inline-flex', alignItems:'center', gap:6}}>
        <OBCIcon name="history" size={11}/> custom…
      </div>
    </div>
  );
};

// --- Filter pill row ---
const OBPill = ({ label, color, on = true, count, mono = true }) => (
  <span className={"ob-pill" + (on ? ' is-on' : ' is-off')} style={mono ? {} : {fontFamily:'inherit'}}>
    <span className="swatch" style={color ? {background: color} : {}}/>
    <span>{label}</span>
    {count !== undefined && (
      <span style={{color:'var(--color-gray-dark-500)', fontSize:10}}>{count}</span>
    )}
  </span>
);

// --- Pipeline-scoped trust badge ---
const OBScopeBadge = ({ id }) => (
  <span className="ob-scope" title="Pipeline-scoped query — no metric leakage between pipelines">
    <OBCIcon name="check" size={10}/>
    scoped: <strong>{id}</strong>
  </span>
);

// --- Live indicator ---
const OBLive = ({ paused = false, rate }) => (
  <span className={"ob-live" + (paused ? ' is-paused' : '')}>
    <span className="pulse"/>
    {paused ? 'paused' : 'live'}
    {rate && !paused && <span style={{color:'var(--color-gray-dark-500)', fontWeight:500, textTransform:'none', letterSpacing:0, marginLeft:4}}>· {rate}</span>}
  </span>
);

// --- Single log line ---
const OBLogLine = ({ ts, comp, sev, children, state, onClick, selected }) => {
  const cls = ['ob-logline'];
  if (state) cls.push('is-' + state);
  if (selected) cls.push('is-match');
  if (sev === 'error' && !state) cls.push('is-error');
  if (sev === 'warn' && !state) cls.push('is-warn');
  return (
    <div className={cls.join(' ')} onClick={onClick}>
      <div className="ts">{ts}</div>
      <div className="comp">{comp}</div>
      <div className={"sev " + sev}>{sev}</div>
      <div className="msg">{children}</div>
    </div>
  );
};

// --- Pipeline header (matches Bridge / canvas precedent) ---
const OBPipelineHeader = ({ name, env = 'prod', revision, status = 'running', children }) => {
  return (
    <div>
      <div className="br-crumbs">
        <OBCIcon name="pipelines" size={12}/>
        <a>Pipelines</a> <OBCIcon name="chevR" size={10}/>
        <span style={{color:'var(--color-foreground-neutral)'}}>{name}</span>
      </div>
      <div className="flex items-center gap-3" style={{marginTop:8}}>
        <span className={"br-pip-dot br-pip-" + status}/>
        <h1 className="br-title" style={{margin:0}}>{name}</h1>
        <span className="chip chip-warn">{env}</span>
        {revision && <span className="mono" style={{fontSize:11, color:'var(--color-gray-dark-500)'}}>{revision}</span>}
        <div style={{flex:1}}/>
        {children}
      </div>
    </div>
  );
};

// --- Tab row ---
const OBTabs = ({ tabs, active }) => (
  <div className="ob-tabs">
    {tabs.map((t, i) => {
      const label = typeof t === 'string' ? t : t.label;
      const badge = typeof t === 'object' ? t.badge : null;
      const isActive = label === active;
      return (
        <div key={i} className={"ob-tab" + (isActive ? ' is-active' : '')}>
          {label}
          {badge && <span className="badge">{badge}</span>}
        </div>
      );
    })}
  </div>
);

// --- Annotation note ---
const OBNote = ({ children }) => (
  <div className="ob-note"><strong>NOTE</strong>{children}</div>
);

Object.assign(window, {
  OBChart, OBChartSVG, OBSpark, OBRangePicker, OBPill, OBScopeBadge,
  OBLive, OBLogLine, OBPipelineHeader, OBTabs, OBNote,
  obSeries
});
