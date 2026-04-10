import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  Users, KeyRound, Building2, UserCheck, ShieldCheck, Store, Briefcase,
  CreditCard, Mail, Send, FileText, Megaphone, LayoutTemplate, AlertTriangle,
  TrendingUp, Lock, Clock, Newspaper, ArrowUpRight, Sparkles,
} from 'lucide-react';

type Palette = {
  icon: string;   // text color for icon
  bg: string;     // tinted bg for icon
  ring: string;   // accent hover bar
};

const palettes: Record<string, Palette> = {
  blue:    { icon: 'text-blue-600',    bg: 'bg-blue-500/10',    ring: 'bg-blue-500' },
  emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'bg-emerald-500' },
  violet:  { icon: 'text-violet-600',  bg: 'bg-violet-500/10',  ring: 'bg-violet-500' },
  amber:   { icon: 'text-amber-600',   bg: 'bg-amber-500/10',   ring: 'bg-amber-500' },
  rose:    { icon: 'text-rose-600',    bg: 'bg-rose-500/10',    ring: 'bg-rose-500' },
  cyan:    { icon: 'text-cyan-600',    bg: 'bg-cyan-500/10',    ring: 'bg-cyan-500' },
  teal:    { icon: 'text-teal-600',    bg: 'bg-teal-500/10',    ring: 'bg-teal-500' },
  indigo:  { icon: 'text-indigo-600',  bg: 'bg-indigo-500/10',  ring: 'bg-indigo-500' },
  sky:     { icon: 'text-sky-600',     bg: 'bg-sky-500/10',     ring: 'bg-sky-500' },
  red:     { icon: 'text-red-600',     bg: 'bg-red-500/10',     ring: 'bg-red-500' },
};

function StatCard({ label, value, icon: Icon, tone }: {
  label: string; value: number | string; icon: any; tone: keyof typeof palettes;
}) {
  const p = palettes[tone];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-5 hover:shadow-lg hover:shadow-black/[0.03] hover:border-gray-300/70 transition-all duration-300">
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${p.ring} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${p.bg} flex items-center justify-center`}>
          <Icon className={`w-[18px] h-[18px] ${p.icon}`} strokeWidth={2.2} />
        </div>
      </div>
      <div>
        <span className="text-[26px] font-extrabold tracking-tight leading-none block text-gray-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        <span className="text-[10px] font-semibold text-gray-500 mt-2 block uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
    </div>
  );
}

function BreakdownCard({ title, items, colorFn }: {
  title: string;
  items: { label: string; count: number }[];
  colorFn?: (label: string) => string;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-6">
      <h2 className="text-sm font-bold text-gray-900 mb-5 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">
          {total} total
        </span>
      </h2>
      {items.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-xs text-gray-400">No data available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const barColor = colorFn?.(item.label) ?? 'bg-indigo-500';
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] text-gray-700 font-medium">{item.label}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-bold text-gray-900">{item.count}</span>
                    <span className="text-[10px] text-gray-400 font-medium w-8 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GrowthCard({ title, last7d, last30d, tone = 'emerald' }: {
  title: string; last7d: number; last30d: number; tone?: keyof typeof palettes;
}) {
  const p = palettes[tone];
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <div className={`w-9 h-9 rounded-xl ${p.bg} flex items-center justify-center`}>
          <TrendingUp className={`w-4 h-4 ${p.icon}`} strokeWidth={2.2} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowUpRight className={`w-3 h-3 ${p.icon}`} />
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">7 days</span>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">{last7d}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowUpRight className={`w-3 h-3 ${p.icon}`} />
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">30 days</span>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">{last30d}</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-8 first:mt-0">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.14em]">{title}</h2>
        <span className="h-px flex-1 w-16 bg-gray-200" />
      </div>
      {count !== undefined && (
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {count.toLocaleString()} items
        </span>
      )}
    </div>
  );
}

const roleColor = (role: string) => {
  if (role === 'Owner') return 'bg-violet-500';
  if (role === 'Administrator') return 'bg-blue-500';
  if (role === 'Manager') return 'bg-emerald-500';
  return 'bg-gray-400';
};

const subStatusColor = (status: string) => {
  if (status === 'active') return 'bg-emerald-500';
  if (status === 'trialing') return 'bg-indigo-500';
  if (status === 'past_due') return 'bg-amber-500';
  if (status === 'canceled') return 'bg-red-500';
  return 'bg-gray-400';
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200/70 rounded ${className}`} />;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900">Failed to load dashboard</h3>
          <p className="text-sm text-red-700 mt-1">Please refresh the page or try again later.</p>
        </div>
      </div>
    );
  }

  const userCards = [
    { label: 'Total Users', value: stats.users.total, icon: Users, tone: 'blue' as const },
    { label: 'Active Users', value: stats.users.active, icon: UserCheck, tone: 'emerald' as const },
    { label: 'Verified', value: stats.users.verified, icon: ShieldCheck, tone: 'violet' as const },
    { label: '2FA Enabled', value: stats.users.twoFa, icon: Lock, tone: 'cyan' as const },
    { label: 'Active Sessions', value: stats.sessions.total, icon: KeyRound, tone: 'amber' as const },
  ];

  const tenantCards = [
    { label: 'Total Tenants', value: stats.tenants.total, icon: Building2, tone: 'teal' as const },
    { label: 'Active Tenants', value: stats.tenants.active, icon: Building2, tone: 'emerald' as const },
    { label: 'Companies', value: stats.companies.total, icon: Briefcase, tone: 'violet' as const },
    { label: 'Setup Complete', value: stats.companies.setupComplete, icon: Briefcase, tone: 'indigo' as const },
    { label: 'Total Shops', value: stats.shops.total, icon: Store, tone: 'rose' as const },
  ];

  const subCards = [
    { label: 'Active Subs', value: stats.subscriptions.active, icon: CreditCard, tone: 'emerald' as const },
    { label: 'Trialing', value: stats.subscriptions.trialing, icon: Clock, tone: 'indigo' as const },
    { label: 'Past Due', value: stats.subscriptions.pastDue, icon: AlertTriangle, tone: 'amber' as const },
    { label: 'Canceled', value: stats.subscriptions.canceled, icon: CreditCard, tone: 'red' as const },
  ];

  const emailCards = [
    { label: 'Contacts', value: stats.email.contacts, icon: Mail, tone: 'sky' as const },
    { label: 'Emails Sent', value: stats.email.sends, icon: Send, tone: 'blue' as const },
    { label: 'Newsletters', value: stats.email.newsletters, icon: Newspaper, tone: 'indigo' as const },
    { label: 'Bounces', value: stats.email.bounces, icon: AlertTriangle, tone: 'red' as const },
  ];

  const marketingCards = [
    { label: 'Forms', value: stats.marketing.forms, icon: FileText, tone: 'amber' as const },
    { label: 'Form Responses', value: stats.marketing.formResponses, icon: FileText, tone: 'amber' as const },
    { label: 'Campaigns', value: stats.marketing.campaigns, icon: Megaphone, tone: 'rose' as const },
    { label: 'Templates', value: stats.marketing.templates, icon: LayoutTemplate, tone: 'teal' as const },
  ];

  const roleItems = (stats.roleBreakdown ?? []).map((r: any) => ({ label: r.role, count: Number(r.count) }));
  const subItems = (stats.subscriptionBreakdown ?? []).map((s: any) => ({ label: s.status || 'none', count: Number(s.count) }));
  const planItems = (stats.planBreakdown ?? []).map((p: any) => ({ label: p.planName || 'Unknown', count: Number(p.count) }));

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.14em] mb-2">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight leading-none text-gray-900">
            Dashboard
          </h1>
          <Sparkles className="w-5 h-5 text-indigo-400" />
        </div>
        <p className="text-sm text-gray-500 mt-2">A live overview of your platform's health.</p>
      </div>

      {/* Users */}
      <SectionHeader title="Users" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {userCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Tenants & Shops */}
      <SectionHeader title="Tenants & Business" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {tenantCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Subscriptions */}
      <SectionHeader title="Subscriptions" />
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {subCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Email */}
      <SectionHeader title="Email" />
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {emailCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Marketing */}
      <SectionHeader title="Marketing" />
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {marketingCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Growth + Breakdowns */}
      <SectionHeader title="Growth & Breakdowns" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <GrowthCard title="New Users" last7d={stats.users.signups7d} last30d={stats.users.signups30d} tone="emerald" />
        <GrowthCard title="New Tenants" last7d={stats.tenants.new7d} last30d={stats.tenants.new30d} tone="blue" />
        <BreakdownCard title="Users by Role" items={roleItems} colorFn={roleColor} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <BreakdownCard title="Subscription Status" items={subItems} colorFn={subStatusColor} />
        <BreakdownCard title="Active Subscriptions by Plan" items={planItems} colorFn={() => 'bg-indigo-500'} />
      </div>
    </div>
  );
}
