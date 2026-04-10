import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  Users, KeyRound, Building2, UserCheck, ShieldCheck, Store, Briefcase,
  CreditCard, Mail, Send, FileText, Megaphone, LayoutTemplate, AlertTriangle,
  TrendingUp, Lock, Clock, Newspaper,
} from 'lucide-react';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
        </div>
        <div className={`${color} p-2.5 rounded-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
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

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 dark:text-gray-400">Loading dashboard...</div>;
  if (!stats) return <div className="text-red-500">Failed to load stats</div>;

  const topCards = [
    { label: 'Total Users', value: stats.users.total, icon: Users, color: 'bg-blue-500' },
    { label: 'Active Users', value: stats.users.active, icon: UserCheck, color: 'bg-green-500' },
    { label: 'Verified Users', value: stats.users.verified, icon: ShieldCheck, color: 'bg-purple-500' },
    { label: '2FA Enabled', value: stats.users.twoFa, icon: Lock, color: 'bg-cyan-600' },
    { label: 'Active Sessions', value: stats.sessions.total, icon: KeyRound, color: 'bg-orange-500' },
  ];

  const tenantCards = [
    { label: 'Total Tenants', value: stats.tenants.total, icon: Building2, color: 'bg-teal-500' },
    { label: 'Active Tenants', value: stats.tenants.active, icon: Building2, color: 'bg-green-600' },
    { label: 'Companies', value: stats.companies.total, icon: Briefcase, color: 'bg-violet-500' },
    { label: 'Setup Complete', value: stats.companies.setupComplete, icon: Briefcase, color: 'bg-emerald-500' },
    { label: 'Total Shops', value: stats.shops.total, icon: Store, color: 'bg-pink-500' },
  ];

  const subCards = [
    { label: 'Active Subs', value: stats.subscriptions.active, icon: CreditCard, color: 'bg-green-500' },
    { label: 'Trialing', value: stats.subscriptions.trialing, icon: Clock, color: 'bg-indigo-500' },
    { label: 'Past Due', value: stats.subscriptions.pastDue, icon: AlertTriangle, color: 'bg-yellow-500' },
    { label: 'Canceled', value: stats.subscriptions.canceled, icon: CreditCard, color: 'bg-red-500' },
  ];

  const emailCards = [
    { label: 'Contacts', value: stats.email.contacts, icon: Mail, color: 'bg-sky-500' },
    { label: 'Emails Sent', value: stats.email.sends, icon: Send, color: 'bg-blue-600' },
    { label: 'Newsletters', value: stats.email.newsletters, icon: Newspaper, color: 'bg-indigo-500' },
    { label: 'Bounces', value: stats.email.bounces, icon: AlertTriangle, color: 'bg-red-400' },
  ];

  const marketingCards = [
    { label: 'Forms', value: stats.marketing.forms, icon: FileText, color: 'bg-amber-500' },
    { label: 'Form Responses', value: stats.marketing.formResponses, icon: FileText, color: 'bg-amber-600' },
    { label: 'Campaigns', value: stats.marketing.campaigns, icon: Megaphone, color: 'bg-rose-500' },
    { label: 'Templates', value: stats.marketing.templates, icon: LayoutTemplate, color: 'bg-teal-600' },
  ];

  const roleItems = (stats.roleBreakdown ?? []).map((r: any) => ({ label: r.role, count: Number(r.count) }));
  const subItems = (stats.subscriptionBreakdown ?? []).map((s: any) => ({ label: s.status || 'none', count: Number(s.count) }));
  const planItems = (stats.planBreakdown ?? []).map((p: any) => ({ label: p.planName || 'Unknown', count: Number(p.count) }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Dashboard</h1>

      <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Users</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {topCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Tenants & Business</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {tenantCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Subscriptions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {subCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Email</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {emailCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Marketing</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {marketingCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Growth & Breakdowns</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <GrowthCard title="New Users" last7d={stats.users.signups7d} last30d={stats.users.signups30d} />
        <GrowthCard title="New Tenants" last7d={stats.tenants.new7d} last30d={stats.tenants.new30d} />
        <BreakdownCard title="Users by Role" items={roleItems} colorFn={roleColor} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BreakdownCard title="User Subscription Status" items={subItems} colorFn={subStatusColor} />
        <BreakdownCard title="Active Subscriptions by Plan" items={planItems} colorFn={() => 'bg-indigo-500'} />
      </div>
    </div>
  );
}
