import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../App';
import { User, Lock, Check, AlertCircle } from 'lucide-react';

type Status = { type: 'success' | 'error'; message: string } | null;

function StatusBanner({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm ${
        status.type === 'success'
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
      }`}
    >
      {status.type === 'success' ? (
        <Check className="w-4 h-4 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      {status.message}
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

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {/* Account Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <User className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Account Details</h2>
        </div>
        <form onSubmit={handleProfileSave} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              placeholder="Super Admin"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">This is used to log in to the admin panel.</p>
          </div>
          <StatusBanner status={profileStatus} />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileSaving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {profileSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Lock className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              type="password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">Minimum 8 characters.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password"
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <StatusBanner status={pwStatus} />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwSaving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {pwSaving ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
