import { useEffect, useState } from 'react';
import { useToast } from './Toast';
import { api } from '../lib/api';
import { X, Crown, Trash2, PauseCircle, PlayCircle, Loader2, AlertTriangle, LogIn } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import ConfirmModal from './ConfirmModal';

interface Props {
  tenantId: string;
  onClose: () => void;
  onDeleted?: () => void;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:       '#09090F',
  surface:  '#0F1120',
  surface2: '#141828',
  border:   '#1C2036',
  borderHi: 'rgba(129,140,248,0.3)',
  text:     '#DDE3F0',
  dim:      '#7A82A0',
  muted:    '#3A4060',
  indigo:   '#818CF8',
  indigoBg: 'rgba(129,140,248,0.08)',
  green:    '#34D399',
  greenBg:  'rgba(52,211,153,0.08)',
  amber:    '#FBBF24',
  amberBg:  'rgba(251,191,36,0.08)',
  red:      '#F87171',
  redBg:    'rgba(248,113,113,0.08)',
} as const;

const F = {
  body: "'Outfit', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Badge({
  label, variant = 'neutral',
}: { label: string; variant?: 'green' | 'amber' | 'red' | 'indigo' | 'neutral' }) {
  const map = {
    green:   { color: C.green,  bg: C.greenBg,  border: 'rgba(52,211,153,0.25)' },
    amber:   { color: C.amber,  bg: C.amberBg,  border: 'rgba(251,191,36,0.25)' },
    red:     { color: C.red,    bg: C.redBg,    border: 'rgba(248,113,113,0.25)' },
    indigo:  { color: C.indigo, bg: C.indigoBg, border: 'rgba(129,140,248,0.25)' },
    neutral: { color: C.dim,    bg: 'rgba(122,130,160,0.08)', border: 'rgba(122,130,160,0.2)' },
  };
  const { color, bg, border } = map[variant];
  return (
    <span style={{
      fontFamily: F.body, fontSize: 11, fontWeight: 500, letterSpacing: '0.03em',
      color, background: bg, border: `1px solid ${border}`,
      borderRadius: 6, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', opacity: 0.85 }} />
      {label}
    </span>
  );
}

function subVariant(status: string): 'green' | 'amber' | 'red' | 'indigo' | 'neutral' {
  if (status === 'active') return 'green';
  if (status === 'trialing') return 'indigo';
  if (status === 'past_due') return 'amber';
  if (status === 'canceled') return 'red';
  if (status === 'incomplete') return 'amber';
  return 'neutral';
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontFamily: F.body, fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', color: C.muted, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{
        fontFamily: mono ? F.mono : F.body,
        fontSize: mono ? 11 : 13, fontWeight: 400, color: C.text,
        textAlign: 'right', maxWidth: '60%', overflowWrap: 'break-word',
      }}>
        {value ?? <span style={{ color: C.muted }}>—</span>}
      </span>
    </div>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${accent ? C.borderHi : C.border}`,
      borderRadius: 10,
      padding: '4px 16px 0',
      marginBottom: 20,
      ...(accent ? { boxShadow: '0 0 0 1px rgba(129,140,248,0.1), 0 4px 24px rgba(0,0,0,0.4)' } : {}),
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: F.body, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
      color: C.muted, textTransform: 'uppercase', marginBottom: 4, marginTop: 20,
    }}>
      {children}
    </p>
  );
}

function StatCard({ value, label, color = C.indigo }: { value: React.ReactNode; label: string; color?: string }) {
  return (
    <div style={{
      flex: 1, background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '16px 14px', textAlign: 'center',
      borderTop: `2px solid ${color}`,
    }}>
      <div style={{ fontFamily: F.body, fontSize: 26, fontWeight: 700, color: C.text, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: F.body, fontSize: 11, color: C.dim, marginTop: 5, letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ data }: { data: any }) {
  const { tenant, owner, company, userCount, shops, subscriptions, activeSubscription } = data;

  return (
    <div className="tab-content">
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <StatCard value={userCount} label="Users" color={C.indigo} />
        <StatCard value={shops?.length ?? 0} label="Shops" color={C.green} />
        <StatCard value={subscriptions?.length ?? 0} label="Subscriptions" color={C.amber} />
      </div>

      {/* Tenant info */}
      <SectionLabel>Tenant</SectionLabel>
      <Card>
        <Row label="ID" value={tenant.id} mono />
        <Row label="Slug" value={tenant.slug} mono />
        {tenant.domain && <Row label="Domain" value={tenant.domain} />}
        <Row label="Status" value={
          tenant.isActive
            ? <Badge label="Active" variant="green" />
            : <Badge label="Suspended" variant="amber" />
        } />
        <Row label="Max Users" value={tenant.maxUsers} />
        <Row label="Created" value={fmtDate(tenant.createdAt)} />
      </Card>

      {/* Owner */}
      {owner && (
        <>
          <SectionLabel>Account Owner</SectionLabel>
          <Card>
            <Row label="Name" value={
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {owner.name}
                <Crown style={{ width: 12, height: 12, color: '#F59E0B' }} />
              </span>
            } />
            <Row label="Email" value={owner.email} mono />
            <Row label="Verified" value={owner.emailVerified
              ? <Badge label="Verified" variant="green" />
              : <Badge label="Unverified" variant="neutral" />
            } />
            <Row label="Last Login" value={fmtDateTime(owner.lastLoginAt)} />
            {owner.stripeCustomerId && <Row label="Stripe ID" value={owner.stripeCustomerId} mono />}
          </Card>
        </>
      )}

      {/* Company */}
      {company && (
        <>
          <SectionLabel>Company</SectionLabel>
          <Card>
            <Row label="Name" value={company.name} />
            {company.companyType && <Row label="Type" value={company.companyType} />}
            {company.companyEmail && <Row label="Email" value={company.companyEmail} mono />}
            {company.phone && <Row label="Phone" value={company.phone} />}
            {company.website && <Row label="Website" value={company.website} />}
            {company.geographicalLocation && <Row label="Location" value={company.geographicalLocation} />}
            <Row label="Setup" value={company.setupCompleted
              ? <Badge label="Complete" variant="green" />
              : <Badge label="Incomplete" variant="neutral" />
            } />
          </Card>
        </>
      )}

      {/* Active Plan */}
      {activeSubscription?.plan && (
        <>
          <SectionLabel>Active Plan</SectionLabel>
          <div style={{
            background: 'linear-gradient(135deg, rgba(129,140,248,0.12) 0%, rgba(99,102,241,0.04) 100%)',
            border: `1px solid ${C.borderHi}`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 20,
            boxShadow: '0 0 24px rgba(129,140,248,0.08)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: F.body, fontSize: 18, fontWeight: 700, color: C.text }}>
                  {activeSubscription.plan.displayName || activeSubscription.plan.name}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.dim, marginTop: 2 }}>
                  {activeSubscription.plan.description}
                </div>
              </div>
              <Badge label={activeSubscription.status} variant={subVariant(activeSubscription.status)} />
            </div>
            <div style={{ display: 'flex', gap: 16, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 500, color: C.indigo }}>
                  ${activeSubscription.isYearly ? activeSubscription.plan.yearlyPrice : activeSubscription.plan.price}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, letterSpacing: '0.05em' }}>
                  PER {activeSubscription.isYearly ? 'YEAR' : 'MONTH'}
                </div>
              </div>
              {activeSubscription.plan.maxUsers && (
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 500, color: C.text }}>
                    {activeSubscription.plan.maxUsers}
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, letterSpacing: '0.05em' }}>MAX USERS</div>
                </div>
              )}
              {activeSubscription.plan.maxShops && (
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 500, color: C.text }}>
                    {activeSubscription.plan.maxShops}
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, letterSpacing: '0.05em' }}>MAX SHOPS</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  ['#6366F1','#4F46E5'], ['#10B981','#059669'], ['#F59E0B','#D97706'],
  ['#EF4444','#DC2626'], ['#8B5CF6','#7C3AED'], ['#06B6D4','#0891B2'],
];

function UserRow({ u, idx, onImpersonate, isImpersonating }: { u: any; idx: number; onImpersonate: (user: any) => void; isImpersonating: boolean }) {
  const [c1, c2] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      borderBottom: `1px solid ${C.border}`,
      transition: 'background 0.15s',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: F.body, fontSize: 12, fontWeight: 700, color: '#fff',
      }}>
        {initials(u.name || u.email)}
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {u.name || '—'}
          </span>
          {u.role === 'Owner' && <Crown style={{ width: 11, height: 11, color: C.amber, flexShrink: 0 }} />}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {u.email}
        </div>
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {u.isActive && (
          <ActionBtn
            onClick={() => onImpersonate(u)}
            title={`Impersonate ${u.name || u.email}`}
            color={C.indigo}
            size={28}
            disabled={isImpersonating}
          >
            <LogIn style={{ width: 13, height: 13 }} />
          </ActionBtn>
        )}
        <Badge
          label={u.role}
          variant={u.role === 'Owner' ? 'amber' : u.role === 'Administrator' ? 'indigo' : u.role === 'Manager' ? 'green' : 'neutral'}
        />
        <Badge label={u.isActive ? 'Active' : 'Inactive'} variant={u.isActive ? 'green' : 'red'} />
      </div>
    </div>
  );
}

function UsersTab({ data }: { data: any }) {
  const { users } = data;
  const toast = useToast();
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const handleImpersonate = async (user: any) => {
    setImpersonating(user.id);
    // Open window synchronously (in the click handler) so the popup blocker allows it
    const newWindow = window.open('about:blank', '_blank');
    try {
      const result = await api.impersonate(user.id);
      if (newWindow) {
        newWindow.location.href = result.appUrl;
      }
      toast.success(`Impersonating ${user.name || user.email} — opened in new tab. Session expires in 1 hour.`);
    } catch (err: any) {
      if (newWindow) newWindow.close();
      toast.error(err.message || 'Failed to impersonate user');
    } finally {
      setImpersonating(null);
    }
  };

  return (
    <div className="tab-content">
      <SectionLabel>{users?.length ?? 0} Users</SectionLabel>
      {!users?.length ? (
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.dim, padding: '32px 0', textAlign: 'center' }}>
          No users in this tenant.
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {users.map((u: any, i: number) => (
            <UserRow key={u.id} u={u} idx={i} onImpersonate={handleImpersonate} isImpersonating={impersonating === u.id} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────
function BillingTab({ data, tenantId, onRefresh }: { data: any; tenantId: string; onRefresh: () => void }) {
  const { subscriptions, owner, activeSubscription } = data;
  const [allPlans, setAllPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activeSubscription?.planId || '');
  const [isYearly, setIsYearly] = useState<boolean>(activeSubscription?.isYearly || false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.plans().then((d) => setAllPlans(d.plans)).catch(console.error);
  }, []);

  useEffect(() => {
    setSelectedPlanId(activeSubscription?.planId || '');
    setIsYearly(activeSubscription?.isYearly || false);
  }, [activeSubscription?.planId, activeSubscription?.isYearly]);

  const currentPlanId = activeSubscription?.planId;
  const isDirty = selectedPlanId && (selectedPlanId !== currentPlanId || isYearly !== (activeSubscription?.isYearly || false));
  const selectedPlan = allPlans.find((p) => p.id === selectedPlanId);

  const handleSave = async () => {
    if (!selectedPlanId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.changePlan(tenantId, selectedPlanId, isYearly);
      setSaveMsg({ type: 'success', text: `Switched to ${selectedPlan?.displayName}` });
      onRefresh();
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || 'Failed to change plan' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tab-content">
      {/* Plan selector */}
      <SectionLabel>Change Plan</SectionLabel>
      {allPlans.length === 0 ? (
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.dim }}>Loading plans…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {allPlans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const isSelected = plan.id === selectedPlanId;
            return (
              <label key={plan.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                background: isSelected ? 'rgba(129,140,248,0.07)' : C.surface,
                border: `1px solid ${isSelected ? C.borderHi : C.border}`,
                borderRadius: 10, padding: '12px 14px',
                transition: 'all 0.15s',
                boxShadow: isSelected ? '0 0 0 1px rgba(129,140,248,0.15)' : 'none',
              }}>
                {/* Custom radio */}
                <div style={{ marginTop: 2, position: 'relative', width: 16, height: 16, flexShrink: 0 }}>
                  <input
                    type="radio" name="plan" value={plan.id}
                    checked={isSelected}
                    onChange={() => setSelectedPlanId(plan.id)}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                  />
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: `2px solid ${isSelected ? C.indigo : C.muted}`,
                    background: isSelected ? C.indigoBg : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.indigo }} />}
                  </div>
                </div>
                {/* Plan details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: C.text }}>
                      {plan.displayName}
                    </span>
                    {isCurrent && <Badge label="Current" variant="green" />}
                    {plan.isPopular && <Badge label="Popular" variant="indigo" />}
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: 12, color: C.dim, marginTop: 2 }}>{plan.description}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                    <span style={{ fontFamily: F.mono, fontSize: 12, color: C.indigo }}>${plan.price}/mo</span>
                    {plan.yearlyPrice && <span style={{ fontFamily: F.mono, fontSize: 12, color: C.dim }}>${plan.yearlyPrice}/yr</span>}
                    <span style={{ fontFamily: F.body, fontSize: 11, color: C.dim }}>{plan.maxUsers ?? '∞'} users</span>
                    <span style={{ fontFamily: F.body, fontSize: 11, color: C.dim }}>{plan.maxShops ?? '∞'} shops</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Billing cycle */}
      {selectedPlan?.yearlyPrice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontFamily: F.body, fontSize: 12, color: C.dim }}>Billing cycle</span>
          <div style={{
            display: 'flex', background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, overflow: 'hidden',
          }}>
            {(['Monthly', 'Yearly'] as const).map((label) => {
              const active = label === 'Yearly' ? isYearly : !isYearly;
              return (
                <button key={label} onClick={() => setIsYearly(label === 'Yearly')} style={{
                  padding: '6px 14px',
                  fontFamily: F.body, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: active ? C.indigo : 'transparent',
                  color: active ? '#fff' : C.dim,
                  border: 'none', transition: 'all 0.15s',
                }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Save row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={handleSave} disabled={!isDirty || saving} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 18px', borderRadius: 8, border: 'none', cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
          background: isDirty && !saving ? C.indigo : C.muted,
          color: isDirty && !saving ? '#fff' : C.surface,
          fontFamily: F.body, fontSize: 13, fontWeight: 600,
          transition: 'all 0.15s', opacity: !isDirty || saving ? 0.5 : 1,
        }}>
          {saving && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
          Save Plan
        </button>
        {saveMsg && (
          <span style={{
            fontFamily: F.body, fontSize: 12,
            color: saveMsg.type === 'success' ? C.green : C.red,
          }}>
            {saveMsg.text}
          </span>
        )}
      </div>

      {/* Stripe details */}
      {owner && (owner.stripeCustomerId || owner.stripeSubscriptionId) && (
        <>
          <SectionLabel>Stripe</SectionLabel>
          <Card>
            {owner.stripeCustomerId && <Row label="Customer ID" value={owner.stripeCustomerId} mono />}
            {owner.stripeSubscriptionId && <Row label="Subscription ID" value={owner.stripeSubscriptionId} mono />}
            <Row label="Status" value={<Badge label={owner.subscriptionStatus || 'inactive'} variant={subVariant(owner.subscriptionStatus)} />} />
            {owner.subscriptionPlanId && <Row label="Plan ID" value={owner.subscriptionPlanId} mono />}
            <Row label="Period Start" value={fmtDate(owner.subscriptionStartDate)} />
            <Row label="Period End" value={fmtDate(owner.subscriptionEndDate)} />
            {owner.trialEndsAt && <Row label="Trial Ends" value={fmtDate(owner.trialEndsAt)} />}
            {owner.suspendedByDowngrade && (
              <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle style={{ width: 13, height: 13, color: C.amber }} />
                <span style={{ fontFamily: F.body, fontSize: 12, color: C.amber }}>
                  Suspended by downgrade{owner.suspendedAt ? ` · ${fmtDate(owner.suspendedAt)}` : ''}
                </span>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Subscription history */}
      {subscriptions?.length > 0 && (
        <>
          <SectionLabel>History</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subscriptions.map((sub: any, i: number) => (
              <div key={sub.id} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '12px 14px',
                borderLeft: `3px solid ${i === 0 ? C.indigo : C.muted}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.text }}>
                    {sub.plan?.displayName || sub.planId}
                  </span>
                  <Badge label={sub.status} variant={subVariant(sub.status)} />
                </div>
                <div style={{ fontFamily: F.body, fontSize: 11, color: C.dim }}>
                  {fmtDate(sub.currentPeriodStart)} – {fmtDate(sub.currentPeriodEnd)}
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginTop: 3 }}>
                  {sub.stripeSubscriptionId}
                </div>
                {sub.canceledAt && (
                  <div style={{ fontFamily: F.body, fontSize: 11, color: C.red, marginTop: 4 }}>
                    Canceled {fmtDate(sub.canceledAt)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!subscriptions?.length && !owner?.stripeCustomerId && (
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.dim, textAlign: 'center', padding: '32px 0' }}>
          No billing data for this tenant.
        </div>
      )}
    </div>
  );
}

// ─── Limits Tab ───────────────────────────────────────────────────────────────
function UsageBar({ used, max, color = C.indigo }: { used: number; max?: number | null; color?: string }) {
  if (!max) return (
    <div style={{ fontFamily: F.mono, fontSize: 12, color: C.dim }}>
      {used} <span style={{ color: C.muted }}>/ unlimited</span>
    </div>
  );
  const pct = Math.min(100, (used / max) * 100);
  const barColor = pct > 90 ? C.red : pct > 70 ? C.amber : color;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.text }}>{used}</span>
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.dim }}>/ {max}</span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: C.border, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 4,
          background: barColor,
          transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />
      </div>
    </div>
  );
}

function LimitsTab({ data }: { data: any }) {
  const { limits, activeSubscription, shops, userCount } = data;

  const planMaxUsers  = limits?.maxUsers  ?? activeSubscription?.plan?.maxUsers  ?? null;
  const planMaxShops  = limits?.maxShops  ?? activeSubscription?.plan?.maxShops  ?? null;
  const planEmailLimit = limits?.monthlyEmailLimit ?? activeSubscription?.plan?.monthlyEmailLimit ?? null;
  const planStorage   = limits?.maxStorageGb ?? activeSubscription?.plan?.storageLimit ?? null;

  return (
    <div className="tab-content">
      {/* Usage meters */}
      <SectionLabel>Current Usage</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Users', used: userCount, max: planMaxUsers, color: C.indigo },
          { label: 'Shops', used: shops?.length ?? 0, max: planMaxShops, color: C.green },
          { label: 'Monthly Emails', used: 0, max: planEmailLimit, color: C.amber },
          { label: 'Storage (GB)', used: 0, max: planStorage, color: C.red },
        ].map(({ label, used, max, color }) => (
          <div key={label} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, color: C.dim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              {label}
            </div>
            <UsageBar used={used} max={max} color={color} />
          </div>
        ))}
      </div>

      {/* Custom overrides */}
      {limits ? (
        <>
          <SectionLabel>Custom Overrides</SectionLabel>
          <div style={{
            background: 'rgba(251,191,36,0.05)', border: `1px solid rgba(251,191,36,0.2)`,
            borderRadius: 10, padding: '4px 16px 0', marginBottom: 20,
          }}>
            <Row label="Max Shops" value={limits.maxShops ?? <span style={{ color: C.muted }}>Plan default</span>} />
            <Row label="Max Users" value={limits.maxUsers ?? <span style={{ color: C.muted }}>Plan default</span>} />
            <Row label="Storage (GB)" value={limits.maxStorageGb ?? <span style={{ color: C.muted }}>Plan default</span>} />
            <Row label="Monthly Emails" value={limits.monthlyEmailLimit ?? <span style={{ color: C.muted }}>Plan default</span>} />
            {limits.overrideReason && <Row label="Reason" value={limits.overrideReason} />}
            <Row label="Expires" value={limits.expiresAt ? fmtDate(limits.expiresAt) : <span style={{ color: C.muted }}>Never</span>} />
            <Row label="Active" value={<Badge label={limits.isActive ? 'Yes' : 'No'} variant={limits.isActive ? 'green' : 'neutral'} />} />
          </div>
        </>
      ) : (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: '14px 16px', marginBottom: 20,
          fontFamily: F.body, fontSize: 13, color: C.dim,
        }}>
          No custom overrides — using plan defaults.
        </div>
      )}

      {/* Plan limits reference */}
      {activeSubscription?.plan && (
        <>
          <SectionLabel>Plan Limits</SectionLabel>
          <Card>
            <Row label="Max Users" value={activeSubscription.plan.maxUsers ?? 'Unlimited'} />
            <Row label="Max Shops" value={activeSubscription.plan.maxShops ?? 'Unlimited'} />
            <Row label="Max Projects" value={activeSubscription.plan.maxProjects ?? 'Unlimited'} />
            <Row label="Storage" value={activeSubscription.plan.storageLimit ? `${activeSubscription.plan.storageLimit} GB` : 'Unlimited'} />
            <Row label="Monthly Emails" value={activeSubscription.plan.monthlyEmailLimit ?? 'Unlimited'} />
            <Row label="Users Mgmt" value={<Badge label={activeSubscription.plan.allowUsersManagement ? 'Allowed' : 'Not allowed'} variant={activeSubscription.plan.allowUsersManagement ? 'green' : 'neutral'} />} />
            <Row label="Roles Mgmt" value={<Badge label={activeSubscription.plan.allowRolesManagement ? 'Allowed' : 'Not allowed'} variant={activeSubscription.plan.allowRolesManagement ? 'green' : 'neutral'} />} />
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'users'    as const, label: 'Users' },
  { id: 'billing'  as const, label: 'Billing' },
  { id: 'limits'   as const, label: 'Limits' },
];

export default function TenantDetailPanel({ tenantId, onClose, onDeleted }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'billing' | 'limits'>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const toast = useToast();

  const refresh = () => {
    api.tenantDetails(tenantId).then(setData).catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    api.tenantDetails(tenantId).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const tenantName = data?.tenant?.name || 'Tenant';
  const isActive   = data?.tenant?.isActive ?? true;

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 40, backdropFilter: 'blur(2px)' }}
        onClick={onClose} />

      {/* Panel */}
      <div
        className="animate-slide-in"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 600,
          maxWidth: '100%', zIndex: 50, display: 'flex', flexDirection: 'column',
          background: C.bg, fontFamily: F.body,
          boxShadow: '-4px 0 60px rgba(0,0,0,0.6), -1px 0 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          background: `linear-gradient(160deg, #141828 0%, #0D0F1A 100%)`,
          borderBottom: `1px solid ${C.border}`,
          padding: '20px 20px 0',
          flexShrink: 0,
        }}>
          {/* Top row: avatar + name + actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
            {/* Avatar */}
            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              background: isActive
                ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                : 'linear-gradient(135deg, #374151, #1F2937)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: F.body, fontSize: 16, fontWeight: 700, color: '#fff',
              boxShadow: isActive ? '0 0 16px rgba(99,102,241,0.35)' : 'none',
              letterSpacing: '0.02em',
            }}>
              {initials(tenantName)}
            </div>

            {/* Name block */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{
                  fontFamily: F.body, fontSize: 18, fontWeight: 700,
                  color: C.text, margin: 0, lineHeight: 1.2,
                }}>
                  {loading ? 'Loading…' : tenantName}
                </h2>
                {!loading && data && (
                  <Badge
                    label={isActive ? 'Active' : 'Suspended'}
                    variant={isActive ? 'green' : 'amber'}
                  />
                )}
              </div>
              {data?.tenant?.slug && (
                <div style={{ fontFamily: F.mono, fontSize: 11, color: C.dim, marginTop: 4 }}>
                  {data.tenant.slug}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {!loading && data && (
                <>
                  <ActionBtn
                    onClick={() => setShowSuspendModal(true)}
                    title={isActive ? 'Suspend tenant' : 'Reinstate tenant'}
                    color={isActive ? C.amber : C.green}
                  >
                    {isActive ? <PauseCircle style={{ width: 15, height: 15 }} /> : <PlayCircle style={{ width: 15, height: 15 }} />}
                  </ActionBtn>
                  <ActionBtn onClick={() => setShowDeleteModal(true)} title="Delete tenant" color={C.red}>
                    <Trash2 style={{ width: 15, height: 15 }} />
                  </ActionBtn>
                </>
              )}
              <ActionBtn onClick={onClose} title="Close" color={C.dim}>
                <X style={{ width: 16, height: 16 }} />
              </ActionBtn>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginBottom: -1 }}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  padding: '8px 16px',
                  fontFamily: F.body, fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? C.text : C.dim,
                  background: active ? C.bg : 'transparent',
                  border: 'none', cursor: 'pointer',
                  borderTopLeftRadius: 8, borderTopRightRadius: 8,
                  borderBottom: active ? 'none' : 'none',
                  position: 'relative', transition: 'color 0.15s',
                }}>
                  {tab.label}
                  {active && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 10, right: 10, height: 2,
                      background: C.indigo, borderRadius: '2px 2px 0 0',
                      boxShadow: `0 0 8px ${C.indigo}`,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 20px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.dim, gap: 10, fontFamily: F.body, fontSize: 13 }}>
              <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
              Loading tenant details…
            </div>
          ) : !data ? (
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.red, padding: '32px 0', textAlign: 'center' }}>
              Failed to load tenant details.
            </div>
          ) : (
            <>
              {activeTab === 'overview' && <OverviewTab data={data} />}
              {activeTab === 'users'    && <UsersTab data={data} />}
              {activeTab === 'billing'  && <BillingTab data={data} tenantId={tenantId} onRefresh={refresh} />}
              {activeTab === 'limits'   && <LimitsTab data={data} />}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {showDeleteModal && data && (
        <ConfirmDeleteModal
          title={`Delete "${tenantName}"`}
          description={`You are about to permanently delete the tenant "${tenantName}" and all associated data.`}
          onConfirm={async () => {
            await api.deleteTenant(tenantId);
            setShowDeleteModal(false);
            onClose();
            onDeleted?.();
            toast.success(`Tenant "${tenantName}" deleted successfully.`);
          }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {showSuspendModal && data && (
        <ConfirmModal
          title={isActive ? `Suspend "${tenantName}"` : `Reinstate "${tenantName}"`}
          description={
            isActive
              ? `All ${data.userCount} user account(s) under this tenant will be deactivated and login will be disabled immediately.`
              : `The tenant and all its user accounts will be reactivated and login will be re-enabled.`
          }
          confirmLabel={isActive ? 'Suspend Tenant' : 'Reinstate Tenant'}
          confirmClassName={isActive ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
          iconBg={isActive ? 'bg-amber-100' : 'bg-green-100'}
          icon={isActive
            ? <PauseCircle className="w-5 h-5 text-amber-600" />
            : <PlayCircle className="w-5 h-5 text-green-600" />
          }
          onConfirm={async () => {
            await api.suspendTenant(tenantId, isActive);
            setShowSuspendModal(false);
            refresh();
            toast.success(
              isActive
                ? `Tenant "${tenantName}" suspended. All user logins disabled.`
                : `Tenant "${tenantName}" reinstated. User logins re-enabled.`
            );
          }}
          onCancel={() => setShowSuspendModal(false)}
        />
      )}
    </>
  );
}

// ─── Tiny helper ─────────────────────────────────────────────────────────────
function ActionBtn({
  children, onClick, title, color, size = 32, disabled,
}: { children: React.ReactNode; onClick: () => void; title: string; color: string; size?: number; disabled?: boolean }) {
  const [hover, setHover] = useState(false);
  const rgb = color === C.red ? '248,113,113' : color === C.amber ? '251,191,36' : color === C.green ? '52,211,153' : color === C.indigo ? '129,140,248' : '122,130,160';
  return (
    <button
      onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, borderRadius: size <= 28 ? 6 : 8, border: 'none', cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hover && !disabled ? `rgba(${rgb}, 0.12)` : 'transparent',
        color: hover && !disabled ? color : C.muted,
        transition: 'all 0.15s',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
