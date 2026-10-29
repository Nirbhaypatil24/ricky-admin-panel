import { useEffect, useMemo, useRef, useState } from 'react';

const compact = (n) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${+(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${+(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
};

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * exp;
}

/**
 * Single-series column chart (no legend: the panel title names the series).
 * Columns ≤ 24px wide, 4px rounded tops, 2px minimum gap, hairline grid, per-column hover tooltip.
 * data: [{ key, label, value, detail }]
 */
export default function BarChart({ data, height = 180, valueLabel = (v) => v, axisPrefix = '', ariaLabel, highlightKey }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 4, bottom: 24, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.value || 0))), [data]);
  const ticks = [0, max / 2, max];
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(24, slot - 2));
  const labelEvery = Math.max(1, Math.ceil(36 / slot));
  const y = (v) => pad.top + innerH - (v / max) * innerH;

  const bar = (x, top, w, h) => {
    if (h <= 0) return '';
    const r = Math.min(4, w / 2, h);
    return `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${top + h} Z`;
  };

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div ref={wrap} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeWidth="1" />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="rgb(var(--faint))">
              {t === 0 ? '0' : `${axisPrefix}${compact(t)}`}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const h = d.value > 0 ? Math.max(2, innerH - (y(d.value) - pad.top)) : 0;
          const top = pad.top + innerH - h;
          const active = hover === i || d.key === highlightKey;
          return (
            <g key={d.key}>
              <path d={bar(x, top, barW, h)} fill="rgb(var(--viz))" opacity={hover === null || hover === i ? 1 : 0.45} />
              {active && d.key === highlightKey && hover === null && h === 0 && (
                <line x1={x} x2={x + barW} y1={pad.top + innerH - 1} y2={pad.top + innerH - 1} stroke="rgb(var(--viz))" strokeWidth="2" />
              )}
              {i % labelEvery === 0 && (
                <text x={pad.left + i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))" fontWeight={d.key === highlightKey ? 700 : 400}>
                  {d.label}
                </text>
              )}
              {/* Hit target: the whole column slot, taller than the bar */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${d.label}: ${valueLabel(d.value)}`}
              />
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="rgb(var(--faint))" strokeOpacity="0.5" strokeWidth="1" />
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-ctl border border-line bg-surface px-2.5 py-1.5 text-sm shadow-float"
          style={{
            left: Math.min(width - 70, Math.max(70, pad.left + hover * slot + slot / 2)),
            top: Math.max(4, y(hovered.value || 0) - 6),
          }}
        >
          <p className="font-semibold">{valueLabel(hovered.value)}</p>
          <p className="text-xs text-muted">{hovered.detail || hovered.label}</p>
        </div>
      )}
    </div>
  );
}

/** Horizontal stacked bar for a whole made of parts (fleet by meter mode). 2px surface gaps, 4px rounded ends. */
export function StackBar({ parts, total, height = 14, ariaLabel }) {
  const sum = total ?? parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="flex w-full gap-[2px]" style={{ height }} role="img" aria-label={ariaLabel}>
      {sum === 0 ? (
        <div className="h-full w-full rounded bg-sunken" />
      ) : (
        shown.map((p, i) => (
          <div
            key={p.key}
            title={`${p.label}: ${p.value}`}
            className={`h-full ${i === 0 ? 'rounded-l' : ''} ${i === shown.length - 1 ? 'rounded-r' : ''}`}
            style={{ flexGrow: p.value, flexBasis: 0, minWidth: 6, background: p.color }}
          />
        ))
      )}
    </div>
  );
}
