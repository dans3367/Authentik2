import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  Users, KeyRound, Building2, UserCheck, ShieldCheck, Store, Briefcase,
  CreditCard, Mail, Send, FileText, Megaphone, LayoutTemplate, AlertTriangle,
  TrendingUp, Lock, Clock, Newspaper, ChevronDown, Loader2
} from 'lucide-react';

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string | React.ReactNode; icon: any; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1 h-8 flex items-center">{value}</div>
        </div>
        <div className={`${color} p-2.5 rounded-lg shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Skeletons ──────────────────────────────────────────────────────────────
function SkeletonStatCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-full">
          <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-24 mb-3" />
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-16" />
        </div>
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-lg shrink-0" />
      </div>
    </div>
  );
}

function SkeletonBreakdownCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 animate-pulse">
      <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-6" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="flex justify-between mb-2">
              <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-20" />
              <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-8" />
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonGrowthCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-800 rounded shrink-0" />
        <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12 mx-auto mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mx-auto" />
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12 mx-auto mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mx-auto" />
        </div>
      </div>
    </div>
  );
}

// ─── Breakdown Card ─────────────────────────────────────────────────────────
function BreakdownCard({ title, items, colorFn }: {
  title: string;
  items: { label: string; count: number }[];
  colorFn?: (label: string) => string;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h2>
      <div className="space-y-3">
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          const barColor = colorFn?.(item.label) ?? 'bg-indigo-500';
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.count}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Growth Card ────────────────────────────────────────────────────────────
function GrowthCard({ title, last7d, last30d }: { title: string; last7d: number; last30d: number }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{last7d}</p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-1">Last 7 days</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{last30d}</p>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">Last 30 days</p>
        </div>
      </div>
    </div>
  );
}

// ─── Accordion Section ──────────────────────────────────────────────────────
interface AccordionSectionProps {
  title: string;
  icon: any;
  iconColor: string;
  badge?: React.ReactNode;
  badgeColor?: string;
  defaultOpen?: boolean;
  onExpand?: () => void;
  children: React.ReactNode;
}

function AccordionSection({
  title, icon: Icon, iconColor, badge, badgeColor = 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  defaultOpen = false, onExpand, children,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [hasExpanded, setHasExpanded] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen && onExpand) {
      onExpand();
    }
  }, [defaultOpen]); // Run only on mount to trigger initial fetch

  const handleToggle = () => {
    const newState = !open;
    setOpen(newState);
    if (newState && !hasExpanded) {
      setHasExpanded(true);
      if (onExpand) onExpand();
    }
  };

  return (
    <div className="mb-4">
      {/* Header — clickable */}
      <button
        onClick={handleToggle}
        className="w-full group flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 cursor-pointer select-none"
      >
        {/* Icon */}
        <div className={`${iconColor} w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4 text-white" />
        </div>

        {/* Title */}
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tracking-wide uppercase flex-1 text-left">
          {title}
        </span>

        {/* Summary badge */}
        {badge !== undefined && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeColor} tabular-nums flex items-center gap-1.5`}>
            {badge}
          </span>
        )}

        {/* Chevron */}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>

      {/* Collapsible body */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: open ? 2000 : 0,
          opacity: open ? 1 : 0,
          marginTop: open ? 12 : 0,
        }}
      >
        {hasExpanded && children}
      </div>
    </div>
  );
}

// ─── Color helpers ──────────────────────────────────────────────────────────
const roleColor = (role: string) => {
  if (role === 'Owner') return 'bg-purple-500';
  if (role === 'Administrator') return 'bg-blue-500';
  if (role === 'Manager') return 'bg-green-500';
  return 'bg-gray-400';
};

const subStatusColor = (status: string) => {
  if (status === 'active') return 'bg-green-500';
  if (status === 'trialing') return 'bg-indigo-500';
  if (status === 'past_due') return 'bg-yellow-500';
  if (status === 'canceled') return 'bg-red-500';
  return 'bg-gray-400';
};

// ─── Dashboard Page ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [userStats, setUserStats] = useState<any>(null);
  const [tenantStats, setTenantStats] = useState<any>(null);
  const [subStats, setSubStats] = useState<any>(null);
  const [emailStats, setEmailStats] = useState<any>(null);
  const [marketingStats, setMarketingStats] = useState<any>(null);
  const [growthStats, setGrowthStats] = useState<any>(null);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingMarketing, setLoadingMarketing] = useState(false);
  const [loadingGrowth, setLoadingGrowth] = useState(false);

  // Users Section
  const loadUsers = () => {
    if (userStats || loadingUsers) return;
    setLoadingUsers(true);
    api.statsUsers().then(setUserStats).catch(console.error).finally(() => setLoadingUsers(false));
  };

  // Tenants Section
  const loadTenants = () => {
    if (tenantStats || loadingTenants) return;
    setLoadingTenants(true);
    api.statsTenants().then(setTenantStats).catch(console.error).finally(() => setLoadingTenants(false));
  };

  // Subscriptions Section
  const loadSubs = () => {
    if (subStats || loadingSubs) return;
    setLoadingSubs(true);
    api.statsSubscriptions().then(setSubStats).catch(console.error).finally(() => setLoadingSubs(false));
  };

  // Email Section
  const loadEmail = () => {
    if (emailStats || loadingEmail) return;
    setLoadingEmail(true);
    api.statsEmail().then(setEmailStats).catch(console.error).finally(() => setLoadingEmail(false));
  };

  // Marketing Section
  const loadMarketing = () => {
    if (marketingStats || loadingMarketing) return;
    setLoadingMarketing(true);
    api.statsMarketing().then(setMarketingStats).catch(console.error).finally(() => setLoadingMarketing(false));
  };

  // Growth & Breakdowns Section
  const loadGrowth = () => {
    if (growthStats || loadingGrowth) return;
    setLoadingGrowth(true);
    api.statsGrowth().then(setGrowthStats).catch(console.error).finally(() => setLoadingGrowth(false));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Dashboard</h1>

      {/* ── Users ── */}
      <AccordionSection
        title="Users"
        icon={Users}
        iconColor="bg-blue-500"
        badge={
          loadingUsers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
          userStats ? `${userStats.total} total · ${userStats.active} active` : 'Load data'
        }
        badgeColor="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
        onExpand={loadUsers}
        defaultOpen
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {!userStats ? (
            Array(5).fill(0).map((_, i) => <SkeletonStatCard key={i} />)
          ) : (
            <>
              <StatCard label="Total Users" value={userStats.total} icon={Users} color="bg-blue-500" />
              <StatCard label="Active Users" value={userStats.active} icon={UserCheck} color="bg-green-500" />
              <StatCard label="Verified Users" value={userStats.verified} icon={ShieldCheck} color="bg-purple-500" />
              <StatCard label="2FA Enabled" value={userStats.twoFa} icon={Lock} color="bg-cyan-600" />
              <StatCard label="Active Sessions" value={userStats.sessions} icon={KeyRound} color="bg-orange-500" />
            </>
          )}
        </div>
      </AccordionSection>

      {/* ── Tenants & Business ── */}
      <AccordionSection
        title="Tenants & Business"
        icon={Building2}
        iconColor="bg-teal-500"
        badge={
          loadingTenants ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
          tenantStats ? `${tenantStats.total} tenants · ${tenantStats.shops} shops` : 'Load data'
        }
        badgeColor="bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400"
        onExpand={loadTenants}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {!tenantStats ? (
            Array(5).fill(0).map((_, i) => <SkeletonStatCard key={i} />)
          ) : (
            <>
              <StatCard label="Total Tenants" value={tenantStats.total} icon={Building2} color="bg-teal-500" />
              <StatCard label="Active Tenants" value={tenantStats.active} icon={Building2} color="bg-green-600" />
              <StatCard label="Companies" value={tenantStats.companies} icon={Briefcase} color="bg-violet-500" />
              <StatCard label="Setup Complete" value={tenantStats.setupComplete} icon={Briefcase} color="bg-emerald-500" />
              <StatCard label="Total Shops" value={tenantStats.shops} icon={Store} color="bg-pink-500" />
            </>
          )}
        </div>
      </AccordionSection>

      {/* ── Subscriptions ── */}
      <AccordionSection
        title="Subscriptions"
        icon={CreditCard}
        iconColor="bg-green-500"
        badge={
          loadingSubs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
          subStats ? `${subStats.active + subStats.trialing + subStats.pastDue + subStats.canceled} total · ${subStats.active} active` : 'Load data'
        }
        badgeColor="bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
        onExpand={loadSubs}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {!subStats ? (
            Array(4).fill(0).map((_, i) => <SkeletonStatCard key={i} />)
          ) : (
            <>
              <StatCard label="Active Subs" value={subStats.active} icon={CreditCard} color="bg-green-500" />
              <StatCard label="Trialing" value={subStats.trialing} icon={Clock} color="bg-indigo-500" />
              <StatCard label="Past Due" value={subStats.pastDue} icon={AlertTriangle} color="bg-yellow-500" />
              <StatCard label="Canceled" value={subStats.canceled} icon={CreditCard} color="bg-red-500" />
            </>
          )}
        </div>
      </AccordionSection>

      {/* ── Email ── */}
      <AccordionSection
        title="Email"
        icon={Mail}
        iconColor="bg-sky-500"
        badge={
          loadingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
          emailStats ? `${emailStats.contacts} contacts · ${emailStats.sends} sent` : 'Load data'
        }
        badgeColor="bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400"
        onExpand={loadEmail}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {!emailStats ? (
            Array(4).fill(0).map((_, i) => <SkeletonStatCard key={i} />)
          ) : (
            <>
              <StatCard label="Contacts" value={emailStats.contacts} icon={Mail} color="bg-sky-500" />
              <StatCard label="Emails Sent" value={emailStats.sends} icon={Send} color="bg-blue-600" />
              <StatCard label="Newsletters" value={emailStats.newsletters} icon={Newspaper} color="bg-indigo-500" />
              <StatCard label="Bounces" value={emailStats.bounces} icon={AlertTriangle} color="bg-red-400" />
            </>
          )}
        </div>
      </AccordionSection>

      {/* ── Marketing ── */}
      <AccordionSection
        title="Marketing"
        icon={Megaphone}
        iconColor="bg-rose-500"
        badge={
          loadingMarketing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
          marketingStats ? `${marketingStats.forms + marketingStats.formResponses + marketingStats.campaigns + marketingStats.templates} total` : 'Load data'
        }
        badgeColor="bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400"
        onExpand={loadMarketing}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {!marketingStats ? (
            Array(4).fill(0).map((_, i) => <SkeletonStatCard key={i} />)
          ) : (
            <>
              <StatCard label="Forms" value={marketingStats.forms} icon={FileText} color="bg-amber-500" />
              <StatCard label="Form Responses" value={marketingStats.formResponses} icon={FileText} color="bg-amber-600" />
              <StatCard label="Campaigns" value={marketingStats.campaigns} icon={Megaphone} color="bg-rose-500" />
              <StatCard label="Templates" value={marketingStats.templates} icon={LayoutTemplate} color="bg-teal-600" />
            </>
          )}
        </div>
      </AccordionSection>

      {/* ── Growth & Breakdowns ── */}
      <AccordionSection
        title="Growth & Breakdowns"
        icon={TrendingUp}
        iconColor="bg-emerald-500"
        badge={
          loadingGrowth ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
          growthStats ? `+${growthStats.users.signups7d} users (7d)` : 'Load data'
        }
        badgeColor="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        onExpand={loadGrowth}
        defaultOpen
      >
        {!growthStats ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <SkeletonGrowthCard />
              <SkeletonGrowthCard />
              <SkeletonBreakdownCard />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SkeletonBreakdownCard />
              <SkeletonBreakdownCard />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <GrowthCard title="New Users" last7d={growthStats.users.signups7d} last30d={growthStats.users.signups30d} />
              <GrowthCard title="New Tenants" last7d={growthStats.tenants.new7d} last30d={growthStats.tenants.new30d} />
              <BreakdownCard title="Users by Role" items={(growthStats.roleBreakdown ?? []).map((r: any) => ({ label: r.role, count: Number(r.count) }))} colorFn={roleColor} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <BreakdownCard title="User Subscription Status" items={(growthStats.subscriptionBreakdown ?? []).map((s: any) => ({ label: s.status || 'none', count: Number(s.count) }))} colorFn={subStatusColor} />
              <BreakdownCard title="Active Subscriptions by Plan" items={(growthStats.planBreakdown ?? []).map((p: any) => ({ label: p.planName || 'Unknown', count: Number(p.count) }))} colorFn={() => 'bg-indigo-500'} />
            </div>
          </>
        )}
      </AccordionSection>
    </div>
  );
}
