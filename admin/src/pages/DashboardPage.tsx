import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Users, KeyRound, Building2, UserCheck, ShieldCheck } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (!stats) return <div className="text-red-500">Failed to load stats</div>;

  const cards = [
    { label: 'Total Users', value: stats.users.total, icon: Users, color: 'bg-blue-500' },
    { label: 'Active Users', value: stats.users.active, icon: UserCheck, color: 'bg-green-500' },
    { label: 'Verified Users', value: stats.users.verified, icon: ShieldCheck, color: 'bg-purple-500' },
    { label: 'Active Sessions', value: stats.sessions.total, icon: KeyRound, color: 'bg-orange-500' },
    { label: 'Tenants', value: stats.tenants.total, icon: Building2, color: 'bg-teal-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`${color} p-2.5 rounded-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Role breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Users by Role</h2>
          <div className="space-y-3">
            {stats.roleBreakdown?.map((r: any) => (
              <div key={r.role} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{r.role}</span>
                <span className="text-sm font-semibold bg-gray-100 px-3 py-1 rounded-full">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription Status</h2>
          <div className="space-y-3">
            {stats.subscriptionBreakdown?.map((s: any) => (
              <div key={s.status} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{s.status || 'none'}</span>
                <span className="text-sm font-semibold bg-gray-100 px-3 py-1 rounded-full">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
