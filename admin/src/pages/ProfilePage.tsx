import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../App';
import { User, Lock, Check, AlertCircle, Loader2 } from 'lucide-react';

type Status = { type: 'success' | 'error'; message: string } | null;

function StatusBanner({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm ${
      status.type === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 ring-1 ring-emerald-100 dark:ring-emerald-500/20'
        : 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-400 ring-1 ring-red-100 dark:ring-red-500/20'
    }`}>
      {status.type === 'success' ? (
        <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
      )}
      <span className="font-medium">{status.message}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { user, setUser } = useAuth();

  const [profileForm, setProfileForm] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const [profileStatus, setProfileStatus] = useState<Status>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwStatus, setPwStatus] = useState<Status>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileStatus(null);
    try {
      const updated = await api.updateProfile({
        name: profileForm.name.trim() || undefined,
        email: profileForm.email.trim() || undefined,
      });
      setUser(updated);
      setProfileStatus({ type: 'success', message: 'Profile updated successfully.' });
    } catch (err: any) {
      setProfileStatus({ type: 'error', message: err.message ?? 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwStatus({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwStatus({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    setPwSaving(true);
    try {
      await api.changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwStatus({ type: 'success', message: 'Password changed successfully.' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPwStatus({ type: 'error', message: err.message ?? 'Failed to change password.' });
    } finally {
      setPwSaving(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500';
  const labelCls = 'block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5';

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Profile</h1>

      {/* Account Details */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <div className="flex items-center gap-2.5 mb-4">
          <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Account Details</h2>
        </div>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input type="text" value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              required className={inputCls} />
          </div>
          <StatusBanner status={profileStatus} />
          <div className="flex justify-end">
            <button type="submit" disabled={profileSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition">
              {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {profileSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className={labelCls}>Current Password</label>
            <input type="password" value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              required autoComplete="current-password" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>New Password</label>
            <input type="password" value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              required autoComplete="new-password" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Confirm New Password</label>
            <input type="password" value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              required autoComplete="new-password" className={inputCls} />
          </div>
          <StatusBanner status={pwStatus} />
          <div className="flex justify-end">
            <button type="submit" disabled={pwSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition">
              {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
