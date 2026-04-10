import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import {
  Search, ChevronLeft, ChevronRight, Trash2, Pencil, X, Check,
  Building2, ChevronDown, Users as UsersIcon,
} from 'lucide-react';
import TenantDetailPanel from '../components/TenantDetailPanel';

const roleStyles: Record<string, string> = {
  Owner:         'bg-violet-50 text-violet-700 ring-1 ring-violet-100',
  Administrator: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
  Manager:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  Employee:      'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.users({ page, limit, search, role: roleFilter });
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    await api.deleteUser(id);
    fetchUsers();
  };

  const startEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, role: user.role, isActive: user.isActive });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await api.updateUser(editingId, editForm);
    setEditingId(null);
    fetchUsers();
  };

  const totalPages = Math.ceil(total / limit);
  const inputBase = 'px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition';

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.14em] mb-2">Administration</p>
          <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900 leading-none">Users</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-2">
              {total.toLocaleString()} total {total === 1 ? 'user' : 'users'}
              {(search || roleFilter) && ' matching your filters'}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={`w-full pl-9 pr-8 ${inputBase}`}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className={`appearance-none pr-9 cursor-pointer ${inputBase}`}
          >
            <option value="">All Roles</option>
            <option value="Owner">Owner</option>
            <option value="Administrator">Administrator</option>
            <option value="Manager">Manager</option>
            <option value="Employee">Employee</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200/70 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-200/70">
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-5 py-4">
                      <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                        <UsersIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700">No users found</p>
                      <p className="text-xs text-gray-500 mt-1">Try adjusting your search or filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      {editingId === user.id ? (
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
                            {(user.name || user.email || '?').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900">{user.name || '—'}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {editingId === user.id ? (
                        <input
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        />
                      ) : user.email}
                    </td>
                    <td className="px-5 py-3.5">
                      {editingId === user.id ? (
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        >
                          <option value="Owner">Owner</option>
                          <option value="Administrator">Administrator</option>
                          <option value="Manager">Manager</option>
                          <option value="Employee">Employee</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          roleStyles[user.role] ?? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
                        }`}>
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {editingId === user.id ? (
                        <label className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.isActive}
                            onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Active
                        </label>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          user.isActive
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {editingId === user.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={saveEdit}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-0.5">
                          {user.tenantId && (
                            <button
                              onClick={() => setSelectedTenantId(user.tenantId)}
                              title="View tenant"
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Building2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(user)}
                            title="Edit user"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.name)}
                            title="Delete user"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
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

      {selectedTenantId && (
        <TenantDetailPanel
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onDeleted={() => { setSelectedTenantId(null); fetchUsers(); }}
        />
      )}
    </div>
  );
}
