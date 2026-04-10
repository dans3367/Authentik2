import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { Pencil, X, Check, Trash2, Search, Filter, ChevronDown, Building2 } from 'lucide-react';
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tenants</h1>
        {!loading && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filteredTenants.length === tenants.length
              ? `${tenants.length} tenants`
              : `${filteredTenants.length} of ${tenants.length} tenants`}
          </span>
        )}
      </div>

      {/* Search & Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, slug, or domain…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">All Plans</option>
            <option value="none">No Plan</option>
            {planNames.map((name) => (
              <option key={name} value={name}>{name.replace(/\s*plan\s*/i, '').trim()}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            Clear{activeFilterCount > 1 ? ` (${activeFilterCount})` : ''}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Domain</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Created</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>
            ) : filteredTenants.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                {tenants.length === 0 ? 'No tenants found' : (
                  <div className="flex flex-col items-center gap-2">
                    <span>No tenants match your filters</span>
                    <button onClick={clearFilters} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium">
                      Clear filters
                    </button>
                  </div>
                )}
              </td></tr>
            ) : (
              filteredTenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    {editingId === t.id ? (
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="px-2 py-1 border rounded text-sm w-full dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" />
                    ) : (
                      <button
                        onClick={() => setSelectedTenantId(t.id)}
                        className="font-medium hover:underline text-left cursor-pointer text-gray-900 dark:text-gray-100"
                      >
                        {t.name}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{t.slug}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t.domain || '-'}</td>
                  <td className="px-4 py-3">
                    {t.planName ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400">{t.planName.replace(/\s*plan\s*/i, '').trim()}</span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === t.id ? (
                      <label className="flex items-center gap-1.5 text-sm dark:text-gray-300">
                        <input type="checkbox" checked={editForm.isActive}
                          onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                        Active
                      </label>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.isActive
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                      }`}>{t.isActive ? 'Active' : 'Inactive'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === t.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={saveEdit}
                          className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(t)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeletingTenant({ id: t.id, name: t.name })}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded">
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
