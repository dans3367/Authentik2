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
} from 'lucide-react';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/sessions', label: 'Sessions', icon: KeyRound },
  { to: '/tenants', label: 'Tenants', icon: Building2 },
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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-400" />
            <span className="font-bold text-lg">Admin Panel</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Authentik Super Admin</p>
        </div>
        <nav className="flex-1 py-4">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-700 space-y-1">
          <Link
            to="/profile"
            className={`flex items-center gap-2 text-sm transition-colors w-full rounded px-1 py-1.5 ${
              pathname === '/profile'
                ? 'text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <UserCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{user?.name || user?.email || 'Profile'}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-full px-1 py-1.5"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
