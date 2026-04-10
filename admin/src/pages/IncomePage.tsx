import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme';
import { AlertTriangle } from 'lucide-react';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const LIGHT_T = {
  bg:        '#F9F8F4',
  surface:   '#FFFFFF',
  border:    '#E8E4DA',
  hairline:  '#F0EDE5',
  text:      '#1A1A1A',
  dim:       '#71695D',
  muted:     '#B8B0A4',
  green:     '#1A6B4F',
  greenSoft: '#EBF5EE',
  gold:      '#B8922A',
  goldSoft:  '#FDF8EC',
  blue:      '#2563EB',
  blueSoft:  '#EFF6FF',
  amber:     '#B45309',
  amberSoft: '#FFF8EB',
  red:       '#B91C1C',
  redSoft:   '#FEF2F2',
};

const DARK_T = {
  bg:        '#0A0A0F',
  surface:   '#111118',
  border:    '#1E1E2A',
  hairline:  '#1A1A24',
  text:      '#E4E4EC',
  dim:       '#8888A0',
  muted:     '#4A4A60',
  green:     '#34D399',
  greenSoft: 'rgba(52,211,153,0.1)',
  gold:      '#FBBF24',
  goldSoft:  'rgba(251,191,36,0.1)',
  blue:      '#60A5FA',
  blueSoft:  'rgba(96,165,250,0.1)',
  amber:     '#FBBF24',
  amberSoft: 'rgba(251,191,36,0.1)',
  red:       '#F87171',
  redSoft:   'rgba(248,113,113,0.1)',
};

// Mutable token reference — updated by the root component before render
let T = LIGHT_T;

const F = {
  serif: "'Instrument Serif', Georgia, serif",
  body:  "'Figtree', system-ui, sans-serif",
  mono:  "'JetBrains Mono', monospace",
};

const PLAN_COLORS = [
  '#1A6B4F', '#2563EB', '#C49A2B', '#9333EA', '#0891B2',
  '#EA580C', '#059669', '#D946EF', '#4F46E5', '#DC2626',
];

function getStatusColors(theme: typeof T): Record<string, { fill: string; text: string; bg: string }> {
  return {
    active:     { fill: theme.green, text: theme.green, bg: theme.greenSoft },
    trialing:   { fill: theme.blue,  text: theme.blue,  bg: theme.blueSoft },
    past_due:   { fill: theme.amber, text: theme.amber, bg: theme.amberSoft },
    canceled:   { fill: theme.red,   text: theme.red,   bg: theme.redSoft },
    incomplete: { fill: theme.gold,  text: theme.gold,  bg: theme.goldSoft },
  };
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmtCurrency(n: number, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(n);
}
function fmtMonth(yyyymm: string) {
  const [y, m] = yyyymm.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short' });
}

// ─── SVG Area Chart ───────────────────────────────────────────────────────────
function catmullRom(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function AreaChart({ trend }: { trend: { month: string; new: number }[] }) {
  if (!trend.length) return (
    <div style={{ fontFamily: F.body, fontSize: 13, color: T.muted, padding: '40px 0', textAlign: 'center' }}>
      No trend data yet.
    </div>
  );

  const W = 480, H = 140, PX = 32, PY = 18, PB = 28;
  const maxY = Math.max(...trend.map((t) => t.new), 1);
  const points = trend.map((t, i) => ({
    x: PX + (i / Math.max(trend.length - 1, 1)) * (W - PX * 2),
    y: PY + (1 - t.new / maxY) * (H - PY - PB),
  }));
  const linePath = catmullRom(points);
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = `${linePath} L ${last.x} ${H - PB} L ${first.x} ${H - PB} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.green} stopOpacity="0.18" />
          <stop offset="100%" stopColor={T.green} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.5, 1].map((frac) => {
        const y = PY + frac * (H - PY - PB);
        return (
          <line key={frac} x1={PX} y1={y} x2={W - PX} y2={y}
            stroke={T.border} strokeWidth="0.5" strokeDasharray="3,3" />
        );
      })}
      {/* Area */}
      <path d={areaPath} fill="url(#trendGrad)"
        style={{ animation: 'income-chart-fill 0.8s ease-out 0.3s both' }} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"
        style={{ strokeDasharray: 1000, animation: 'income-chart-draw 1.2s ease-out 0.2s both' }} />
      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill={T.surface} stroke={T.green} strokeWidth="1.5"
            style={{ opacity: 0, animation: `income-number 0.3s ease-out ${0.4 + i * 0.06}s both` }} />
          <text x={p.x} y={H - 8} textAnchor="middle"
            style={{ fontFamily: F.body, fontSize: 9, fill: T.muted, fontWeight: 500 }}>
            {fmtMonth(trend[i].month)}
          </text>
          {trend[i].new > 0 && (
            <text x={p.x} y={p.y - 10} textAnchor="middle"
              style={{ fontFamily: F.mono, fontSize: 9, fill: T.dim, fontWeight: 500,
                opacity: 0, animation: `income-number 0.3s ease-out ${0.5 + i * 0.06}s both` }}>
              {trend[i].new}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── Revenue Mix Bar ──────────────────────────────────────────────────────────
function RevenueMixBar({ plans, totalMrr }: { plans: any[]; totalMrr: number }) {
  const segments = plans.filter((p) => p.mrr > 0);
  if (!totalMrr || !segments.length) return null;
  return (
    <div>
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 10, background: T.hairline }}>
        {segments.map((p, i) => (
          <div key={p.id} title={`${p.displayName}: ${Math.round((p.mrr / totalMrr) * 100)}%`} style={{
            width: `${(p.mrr / totalMrr) * 100}%`,
            background: PLAN_COLORS[i % PLAN_COLORS.length],
            transformOrigin: 'left',
            animation: `income-bar-fill 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.3 + i * 0.08}s both`,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        {segments.map((p, i) => (
          <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.body, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: PLAN_COLORS[i % PLAN_COLORS.length], display: 'inline-block' }} />
            <span style={{ color: T.dim }}>{p.displayName}</span>
            <span style={{ color: T.text, fontWeight: 600, fontFamily: F.mono, fontSize: 11 }}>
              {Math.round((p.mrr / totalMrr) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Segmented Status Bar ─────────────────────────────────────────────────────
function StatusSegments({ breakdown, total }: { breakdown: { status: string; count: number }[]; total: number }) {
  if (!breakdown.length || !total) return null;
  const sorted = [...breakdown].sort((a, b) => b.count - a.count);
  return (
    <div>
      {/* Bar */}
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 8, background: T.hairline }}>
        {sorted.map((s, i) => (
          <div key={s.status} style={{
            width: `${(s.count / total) * 100}%`,
            background: getStatusColors(T)[s.status]?.fill ?? T.muted,
            transformOrigin: 'left',
            animation: `income-bar-fill 0.6s ease-out ${0.2 + i * 0.06}s both`,
          }} />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {sorted.map((s) => {
          const colors = getStatusColors(T)[s.status] ?? { fill: T.muted, text: T.dim, bg: T.hairline };
          return (
            <div key={s.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.fill, display: 'inline-block' }} />
                <span style={{
                  fontFamily: F.body, fontSize: 12, fontWeight: 500, color: colors.text,
                  background: colors.bg, padding: '2px 10px', borderRadius: 20,
                  textTransform: 'capitalize',
                }}>
                  {s.status.replace('_', ' ')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 600, color: T.text }}>{s.count}</span>
                <span style={{ fontFamily: F.body, fontSize: 11, color: T.muted, width: 32, textAlign: 'right' }}>
                  {Math.round((s.count / total) * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────
function PlanCard({
  plan, color, totalMrr, delay,
}: { plan: any; color: string; totalMrr: number; delay: number }) {
  const pct = totalMrr > 0 ? (plan.mrr / totalMrr) * 100 : 0;
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: '20px 22px',
      borderTop: `3px solid ${color}`,
      opacity: 0,
      animation: `income-rise 0.5s ease-out ${delay}ms both`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: 600, color: T.text }}>
              {plan.displayName}
            </span>
            {plan.isPopular && (
              <span style={{
                fontFamily: F.body, fontSize: 9, fontWeight: 600, letterSpacing: '0.05em',
                color: T.gold, background: T.goldSoft, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase',
              }}>
                Popular
              </span>
            )}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: T.muted, marginTop: 3 }}>
            {plan.price > 0 ? `$${plan.price}/mo` : 'Free tier'}
            {plan.yearlyPrice ? ` · $${plan.yearlyPrice}/yr` : ''}
          </div>
        </div>
        {/* MRR */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: F.serif, fontSize: 26, color: plan.mrr > 0 ? T.text : T.muted, lineHeight: 1 }}>
            {plan.mrr > 0 ? fmtCurrency(plan.mrr) : '—'}
          </div>
          <div style={{ fontFamily: F.body, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: T.muted, marginTop: 3, textTransform: 'uppercase' }}>
            monthly
          </div>
        </div>
      </div>

      {/* Subscriber counts */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { label: 'Monthly', value: plan.activeMonthly, fg: color },
          { label: 'Yearly', value: plan.activeYearly, fg: color },
          { label: 'Trial', value: plan.totalTrialing, fg: T.blue },
          ...(plan.pastDue > 0 ? [{ label: 'Past Due', value: plan.pastDue, fg: T.amber }] : []),
        ].map(({ label, value, fg }) => (
          <div key={label} style={{
            flex: 1, textAlign: 'center',
            background: value > 0 ? `${fg}08` : T.hairline,
            borderRadius: 8, padding: '8px 4px',
            border: `1px solid ${value > 0 ? `${fg}18` : T.hairline}`,
          }}>
            <div style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 600, color: value > 0 ? fg : T.muted, lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontFamily: F.body, fontSize: 9, color: T.dim, marginTop: 4, letterSpacing: '0.03em' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Share bar */}
      <div style={{ height: 3, borderRadius: 3, background: T.hairline, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, background: color,
          transformOrigin: 'left',
          animation: `income-bar-fill 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay + 200}ms both`,
          width: `${pct}%`,
        }} />
      </div>
      <div style={{ fontFamily: F.body, fontSize: 10, color: T.muted, marginTop: 5, textAlign: 'right' }}>
        {Math.round(pct)}% of total revenue
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IncomePage() {
  const { theme } = useTheme();
  T = theme === 'dark' ? DARK_T : LIGHT_T;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.income()
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ fontFamily: F.body, fontSize: 13, color: T.muted, padding: '80px 0', textAlign: 'center' }}>
      Loading income data...
    </div>
  );
  if (error) return (
    <div style={{ fontFamily: F.body, fontSize: 13, color: T.red, padding: '80px 0', textAlign: 'center' }}>
      {error}
    </div>
  );

  const { plans, summary, statusBreakdown, trend } = data as {
    plans: any[];
    summary: { totalMrr: number; totalArr: number; totalActive: number; totalTrialing: number; totalPastDue: number; totalCanceled: number };
    statusBreakdown: { status: string; count: number }[];
    trend: { month: string; new: number; canceled: number }[];
  };

  const activePlans = plans.filter((p) => p.isActive || p.totalActive > 0 || p.totalTrialing > 0);
  const totalSubs   = statusBreakdown.reduce((s, r) => s + r.count, 0);

  return (
    <div style={{ fontFamily: F.body, maxWidth: 1100 }}>

      {/* ── Hero Section ── */}
      <div style={{
        background: `linear-gradient(135deg, ${T.surface} 0%, ${T.bg} 100%)`,
        border: `1px solid ${T.border}`,
        borderRadius: 16, padding: '32px 36px', marginBottom: 24,
        opacity: 0, animation: 'income-rise 0.6s ease-out 0.05s both',
      }}>
        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 400, color: T.text, margin: 0, lineHeight: 1 }}>
              Income
            </h1>
            <span style={{ fontFamily: F.body, fontSize: 12, color: T.muted, fontWeight: 400 }}>
              Estimated recurring revenue
            </span>
          </div>
          <div style={{ width: 40, height: 2, background: T.gold, borderRadius: 1, marginTop: 10 }} />
        </div>

        {/* Revenue numbers */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 48, marginBottom: 28, flexWrap: 'wrap' }}>
          {/* MRR — the hero */}
          <div style={{ opacity: 0, animation: 'income-number 0.6s ease-out 0.2s both' }}>
            <div style={{ fontFamily: F.serif, fontSize: 56, color: T.text, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {fmtCurrency(summary.totalMrr, 2)}
            </div>
            <div style={{
              fontFamily: F.body, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
              color: T.dim, textTransform: 'uppercase', marginTop: 6,
            }}>
              Monthly Recurring Revenue
            </div>
          </div>
          {/* ARR */}
          <div style={{ opacity: 0, animation: 'income-number 0.6s ease-out 0.35s both', paddingBottom: 6 }}>
            <div style={{ fontFamily: F.serif, fontSize: 32, color: T.dim, lineHeight: 1, letterSpacing: '-0.01em' }}>
              {fmtCurrency(summary.totalArr)}
            </div>
            <div style={{
              fontFamily: F.body, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
              color: T.muted, textTransform: 'uppercase', marginTop: 6,
            }}>
              Annual Run Rate
            </div>
          </div>
          {/* Metric chips */}
          <div style={{ display: 'flex', gap: 10, paddingBottom: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {[
              { label: 'Active', value: summary.totalActive, color: T.green, bg: T.greenSoft },
              { label: 'Trialing', value: summary.totalTrialing, color: T.blue, bg: T.blueSoft },
              { label: 'Past Due', value: summary.totalPastDue, color: T.amber, bg: T.amberSoft },
              { label: 'Churned', value: summary.totalCanceled, color: T.red, bg: T.redSoft },
            ].map(({ label, value, color, bg }, i) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: bg, borderRadius: 8, padding: '6px 12px',
                border: `1px solid ${color}15`,
                opacity: 0, animation: `income-number 0.4s ease-out ${0.4 + i * 0.07}s both`,
              }}>
                <span style={{ fontFamily: F.mono, fontSize: 15, fontWeight: 600, color, lineHeight: 1 }}>
                  {value}
                </span>
                <span style={{ fontFamily: F.body, fontSize: 11, color: T.dim }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue mix bar */}
        <RevenueMixBar plans={activePlans} totalMrr={summary.totalMrr} />
      </div>

      {/* ── Plan Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16, marginBottom: 24,
      }}>
        {activePlans.map((plan, i) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            color={PLAN_COLORS[i % PLAN_COLORS.length]}
            totalMrr={summary.totalMrr}
            delay={100 + i * 80}
          />
        ))}
      </div>

      {/* ── Bottom Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 24 }}>
        {/* Trend chart */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: '22px 24px',
          opacity: 0, animation: 'income-rise 0.5s ease-out 0.5s both',
        }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: T.text }}>
              Subscription Trend
            </div>
            <div style={{ fontFamily: F.body, fontSize: 11, color: T.muted, marginTop: 2 }}>
              New subscriptions per month
            </div>
          </div>
          <AreaChart trend={trend} />
          {trend.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: 8,
              paddingTop: 12, borderTop: `1px solid ${T.hairline}`,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.body, fontSize: 11, color: T.dim }}>
                <span style={{ width: 8, height: 3, borderRadius: 2, background: T.green, display: 'inline-block' }} />
                New subscriptions
              </span>
              <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 600, color: T.text, marginLeft: 'auto' }}>
                {trend.reduce((s, t) => s + t.new, 0)} total
              </span>
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: '22px 24px',
          opacity: 0, animation: 'income-rise 0.5s ease-out 0.6s both',
        }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: T.text }}>
              Status Distribution
            </div>
            <div style={{ fontFamily: F.body, fontSize: 11, color: T.muted, marginTop: 2 }}>
              {totalSubs} total subscriptions
            </div>
          </div>
          <StatusSegments breakdown={statusBreakdown} total={totalSubs} />
        </div>
      </div>

      {/* ── Past Due Warning ── */}
      {summary.totalPastDue > 0 && (
        <div style={{
          background: T.amberSoft,
          border: `1px solid ${T.amber}40`,
          borderRadius: 12, padding: '16px 20px',
          display: 'flex', alignItems: 'flex-start', gap: 14,
          opacity: 0, animation: 'income-rise 0.5s ease-out 0.7s both',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `${T.amber}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle style={{ width: 16, height: 16, color: T.amber }} />
          </div>
          <div>
            <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: T.amber }}>
              {summary.totalPastDue} account{summary.totalPastDue > 1 ? 's' : ''} past due
            </div>
            <div style={{ fontFamily: F.body, fontSize: 12, color: T.amber, marginTop: 3, opacity: 0.8 }}>
              Unresolved failed payments put approximately{' '}
              <strong style={{ fontFamily: F.mono, fontWeight: 600 }}>
                {fmtCurrency(activePlans.reduce((s, p) => s + (p.pastDue > 0 ? p.price * p.pastDueMonthly + (p.yearlyPrice ?? p.price * 12) / 12 * p.pastDueYearly : 0), 0), 2)}/mo
              </strong>
              {' '}of MRR at risk of churning.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
