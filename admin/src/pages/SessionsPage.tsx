import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Sessions</h1>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Session ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">User ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">IP Address</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">User Agent</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Created</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Expires</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No active sessions</td></tr>
            ) : (
              sessions.map((s) => {
                const expired = s.expiresAt && new Date(s.expiresAt) < new Date();
                return (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{s.id.slice(0, 12)}…</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{s.userId.slice(0, 12)}…</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.ipAddress || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{s.userAgent || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        expired
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                          : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                      }`}>
                        {s.expiresAt ? new Date(s.expiresAt).toLocaleString() : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(s.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded">
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600 dark:text-gray-400">
          <span>Page {page} of {totalPages} ({total} sessions)</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
