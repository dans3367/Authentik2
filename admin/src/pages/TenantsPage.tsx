import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import {
  Pencil, X, Check, Trash2, Search, Filter, ChevronDown, Building2,
} from 'lucide-react';
import TenantDetailPanel from '../components/TenantDetailPanel';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await api.tenants();
      setTenants(data.tenants);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const planNames = useMemo(() => {
    const names = new Set<string>();
    tenants.forEach((t) => { if (t.planName) names.add(t.planName); });
    return Array.from(names).sort();
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          (t.name && t.name.toLowerCase().includes(q)) ||
          (t.slug && t.slug.toLowerCase().includes(q)) ||
          (t.domain && t.domain.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      if (statusFilter === 'active' && !t.isActive) return false;
      if (statusFilter === 'inactive' && t.isActive) return false;
      if (planFilter !== 'all') {
        if (planFilter === 'none' && t.planName) return false;
        if (planFilter !== 'none' && t.planName !== planFilter) return false;
      }
      return true;
    });
  }, [tenants, searchQuery, statusFilter, planFilter]);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (planFilter !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPlanFilter('all');
  };

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setEditForm({ name: t.name, isActive: t.isActive, maxUsers: t.maxUsers });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await api.updateTenant(editingId, editForm);
    setEditingId(null);
    fetchTenants();
  };

  const inputBase = 'px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition';

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.14em] mb-2">Administration</p>
          <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900 leading-none">Tenants</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-2">
              {filteredTenants.length === tenants.length
                ? `${tenants.length.toLocaleString()} total ${tenants.length === 1 ? 'tenant' : 'tenants'}`
                : `${filteredTenants.length.toLocaleString()} of ${tenants.length.toLocaleString()} tenants matching filters`}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, slug, or domain…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-8 ${inputBase}`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={`appearance-none pr-9 cursor-pointer ${inputBase}`}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className={`appearance-none pr-9 cursor-pointer ${inputBase}`}
          >
            <option value="all">All Plans</option>
            <option value="none">No Plan</option>
            {planNames.map((name) => (
              <option key={name} value={name}>{name.replace(/\s*plan\s*/i, '').trim()}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            Clear{activeFilterCount > 1 ? ` (${activeFilterCount})` : ''}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200/70 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-200/70">
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Slug</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Domain</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                        <Building2 className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700">
                        {tenants.length === 0 ? 'No tenants yet' : 'No tenants match your filters'}
                      </p>
                      {tenants.length > 0 && (
                        <button
                          onClick={clearFilters}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold mt-2"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      {editingId === t.id ? (
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        />
                      ) : (
                        <button
                          onClick={() => setSelectedTenantId(t.id)}
                          className="flex items-center gap-3 text-left cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center text-[10px] font-bold text-teal-700 flex-shrink-0">
                            {(t.name || '?').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {t.name}
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{t.slug}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">{t.domain || '—'}</td>
                    <td className="px-5 py-3.5">
                      {t.planName ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                          {t.planName.replace(/\s*plan\s*/i, '').trim()}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">None</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {editingId === t.id ? (
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
                          t.isActive
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {t.isActive ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {editingId === t.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={saveEdit}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => startEdit(t)}
                            title="Edit tenant"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingTenant({ id: t.id, name: t.name })}
                            title="Delete tenant"
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

      {selectedTenantId && (
        <TenantDetailPanel
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onDeleted={() => { setSelectedTenantId(null); fetchTenants(); }}
        />
      )}

      {deletingTenant && (
        <ConfirmDeleteModal
          title={`Delete "${deletingTenant.name}"`}
          description={`You are about to permanently delete the tenant "${deletingTenant.name}" and all associated data.`}
          onConfirm={async () => {
            await api.deleteTenant(deletingTenant.id);
            setDeletingTenant(null);
            if (selectedTenantId === deletingTenant.id) setSelectedTenantId(null);
            fetchTenants();
          }}
          onCancel={() => setDeletingTenant(null)}
        />
      )}
    </div>
  );
}
