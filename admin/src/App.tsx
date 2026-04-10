import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { api } from './lib/api';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import SessionsPage from './pages/SessionsPage';
import TenantsPage from './pages/TenantsPage';
import ProfilePage from './pages/ProfilePage';
import IncomePage from './pages/IncomePage';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import { ThemeProvider } from './lib/theme';

interface AuthContextType {
  user: { email: string; name: string; role: string } | null;
  setUser: (u: any) => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth status directly — bypass the request() wrapper's 401→redirect
    // to avoid an infinite loop when already on /login.
    fetch('/admin-api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ThemeProvider>
    <ToastProvider>
    <AuthContext.Provider value={{ user, setUser, loading }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/sessions" element={<SessionsPage />} />
                    <Route path="/tenants" element={<TenantsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/income" element={<IncomePage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
    </ToastProvider>
    </ThemeProvider>
  );
}
