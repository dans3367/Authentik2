const BASE = '/admin-api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ success: boolean; email: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ email: string; name: string; role: string }>('/auth/me'),
  updateProfile: (data: { name?: string; email?: string }) =>
    request<{ email: string; name: string; role: string }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  stats: () => request<any>('/stats'),
  users: (params?: { page?: number; limit?: number; search?: string; role?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.role) q.set('role', params.role);
    return request<any>(`/users?${q}`);
  },
  user: (id: string) => request<any>(`/users/${id}`),
  updateUser: (id: string, data: any) =>
    request<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request<any>(`/users/${id}`, { method: 'DELETE' }),
  sessions: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return request<any>(`/sessions?${q}`);
  },
  deleteSession: (id: string) =>
    request<any>(`/sessions/${id}`, { method: 'DELETE' }),
  tenants: () => request<any>('/tenants'),
  tenantDetails: (id: string) => request<any>(`/tenants/${id}/details`),
  changePlan: (tenantId: string, planId: string, isYearly: boolean) =>
    request<any>(`/tenants/${tenantId}/change-plan`, {
      method: 'POST',
      body: JSON.stringify({ planId, isYearly }),
    }),
  plans: () => request<any>('/plans'),
  updateTenant: (id: string, data: any) =>
    request<any>(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTenant: (id: string) =>
    request<any>(`/tenants/${id}`, { method: 'DELETE' }),
  suspendTenant: (id: string, suspend: boolean) =>
    request<any>(`/tenants/${id}/suspend`, { method: 'POST', body: JSON.stringify({ suspend }) }),
};
