import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { Trash2, ChevronLeft, ChevronRight, KeyRound } from 'lucide-react';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.sessions({ page, limit });
      setSessions(data.sessions);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleDelete = async (id: string) => {
    if (!confirm('Revoke this session?')) return;
    await api.deleteSession(id);
    fetchSessions();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.14em] mb-2">Security</p>
          <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900 leading-none">Sessions</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-2">
              {total.toLocaleString()} active {total === 1 ? 'session' : 'sessions'}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/70 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-200/70">
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Session ID</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">User ID</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">IP Address</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">User Agent</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Expires</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                        <KeyRound className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700">No active sessions</p>
                      <p className="text-xs text-gray-500 mt-1">Active user sessions will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const expired = s.expiresAt && new Date(s.expiresAt) < new Date();
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          {s.id.slice(0, 12)}…
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{s.userId.slice(0, 12)}…</td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs font-mono">{s.ipAddress || '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs max-w-[220px] truncate" title={s.userAgent}>
                        {s.userAgent ? s.userAgent.slice(0, 40) + '…' : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {s.expiresAt ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            expired
                              ? 'bg-red-50 text-red-700 ring-1 ring-red-100'
                              : 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${expired ? 'bg-red-500' : 'bg-gray-400'}`} />
                            {new Date(s.expiresAt).toLocaleString()}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Revoke session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500 font-medium">
            Page <span className="text-gray-900 font-semibold">{page}</span> of{' '}
            <span className="text-gray-900 font-semibold">{totalPages}</span>
            <span className="text-gray-400"> · {total.toLocaleString()} total</span>
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
