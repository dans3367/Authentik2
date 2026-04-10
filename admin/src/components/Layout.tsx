import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { api } from '../lib/api';
import {
  LayoutDashboard,
  Users,
  KeyRound,
  Building2,
  LogOut,
  Shield,
  UserCircle,
  TrendingUp,
} from 'lucide-react';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/sessions', label: 'Sessions', icon: KeyRound },
  { to: '/tenants', label: 'Tenants', icon: Building2 },
  { to: '/income', label: 'Income', icon: TrendingUp },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    navigate('/login');
  };

  const initials = (user?.name || user?.email || '?')
    .split(/\s+|@/)[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen bg-gray-50/60">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200/70 flex flex-col">
        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-500/20">
              <Shield className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-bold text-[15px] text-gray-900 leading-tight">Admin Panel</div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.14em] mt-0.5">
                Super Admin
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-2 space-y-0.5">
          <div className="px-3 mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em]">
              Overview
            </span>
          </div>
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  active
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100/80 text-gray-500 group-hover:bg-white group-hover:text-gray-700'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="flex-1">{label}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: profile + logout */}
        <div className="p-3 mt-2">
          <Link
            to="/profile"
            className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
              pathname === '/profile'
                ? 'bg-indigo-50 ring-1 ring-indigo-100'
                : 'hover:bg-gray-100/70'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-[11px] font-bold text-gray-700 flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-gray-900 truncate">
                {user?.name || 'Super Admin'}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {user?.email || 'admin'}
              </div>
            </div>
            <UserCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </Link>
          <button
            onClick={handleLogout}
            className="mt-1 flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
