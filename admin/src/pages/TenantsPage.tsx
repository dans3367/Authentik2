import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Pencil, X, Check } from 'lucide-react';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tenants</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Domain</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Max Users</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No tenants found</td></tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editingId === t.id ? (
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="px-2 py-1 border rounded text-sm w-full" />
                    ) : (
                      <span className="font-medium text-gray-900">{t.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.slug}</td>
                  <td className="px-4 py-3 text-gray-600">{t.domain || '-'}</td>
                  <td className="px-4 py-3">
                    {editingId === t.id ? (
                      <label className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" checked={editForm.isActive}
                          onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                        Active
                      </label>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{t.isActive ? 'Active' : 'Inactive'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === t.id ? (
                      <input type="number" value={editForm.maxUsers}
                        onChange={(e) => setEditForm({ ...editForm, maxUsers: parseInt(e.target.value) })}
                        className="px-2 py-1 border rounded text-sm w-20" />
                    ) : (
                      <span className="text-gray-600">{t.maxUsers}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === t.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={saveEdit}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(t)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
