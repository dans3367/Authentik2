const BASE = '/admin-api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const method = options?.method || 'GET';
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const serverError = data?.error || `Request failed: ${res.status} ${res.statusText}`;
    console.error(
      `[admin-api] ${method} ${url} → ${res.status} ${res.statusText}`,
      { serverError, body: data, url: `${BASE}${url}` }
    );

    if (res.status === 401) {
      // Only auto-redirect for non-login requests. On the login page we want
      // to show the real error message ("Invalid credentials", etc.) instead.
      const isLoginRequest = url.startsWith('/auth/login');
      if (!isLoginRequest && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error(serverError);
    }

    throw new Error(serverError);
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
  scheduleUpgrade: (tenantId: string, planId: string, isYearly: boolean) =>
    request<any>(`/tenants/${tenantId}/schedule-upgrade`, {
      method: 'POST',
      body: JSON.stringify({ planId, isYearly }),
    }),
  cancelScheduledUpgrade: (tenantId: string) =>
    request<any>(`/tenants/${tenantId}/schedule-upgrade`, {
      method: 'DELETE',
    }),
  plans: () => request<any>('/plans'),
  income: () => request<any>('/income'),
  updateTenant: (id: string, data: any) =>
    request<any>(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTenant: (id: string) =>
    request<any>(`/tenants/${id}`, { method: 'DELETE' }),
  suspendTenant: (id: string, suspend: boolean) =>
    request<any>(`/tenants/${id}/suspend`, { method: 'POST', body: JSON.stringify({ suspend }) }),
  impersonate: (userId: string) =>
    request<{ success: boolean; user: { id: string; name: string; email: string }; appUrl: string }>(
      `/impersonate/${userId}`, { method: 'POST' }
    ),
};
