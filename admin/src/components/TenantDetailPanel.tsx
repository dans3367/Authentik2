import { useEffect, useState } from 'react';
import { useToast } from './Toast';
import { api } from '../lib/api';
import {
  X,
  Building2,
  Users,
  CreditCard,
  Globe,
  Mail,
  Phone,
  ExternalLink,
  ShieldCheck,
  Clock,
  Store,
  Settings,
  Crown,
  Calendar,
  AlertTriangle,
  Trash2,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import ConfirmModal from './ConfirmModal';

interface Props {
  tenantId: string;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function TenantDetailPanel({ tenantId, onClose, onDeleted }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'billing' | 'limits'>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const toast = useToast();

  const refresh = () => {
    api.tenantDetails(tenantId).then(setData).catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    api.tenantDetails(tenantId).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [tenantId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'users' as const, label: 'Users' },
    { id: 'billing' as const, label: 'Billing' },
    { id: 'limits' as const, label: 'Limits' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[560px] max-w-full bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-semibold text-gray-900 text-lg">
                {loading ? 'Loading...' : data?.tenant?.name || 'Tenant Details'}
              </h2>
              {data?.tenant?.slug && (
                <p className="text-xs text-gray-500 font-mono">{data.tenant.slug}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!loading && data && (
              <>
                <button
                  onClick={() => setShowSuspendModal(true)}
                  className={`p-1.5 rounded-md transition-colors ${
                    data.tenant.isActive
                      ? 'text-gray-400 hover:bg-amber-100 hover:text-amber-600'
                      : 'text-gray-400 hover:bg-green-100 hover:text-green-600'
                  }`}
                  title={data.tenant.isActive ? 'Suspend tenant' : 'Reinstate tenant'}
                >
                  {data.tenant.isActive
                    ? <PauseCircle className="w-4 h-4" />
                    : <PlayCircle className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="p-1.5 hover:bg-red-100 text-gray-400 hover:text-red-600 rounded-md transition-colors"
                  title="Delete tenant"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-md transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">Loading tenant details...</div>
          ) : !data ? (
            <div className="text-red-500">Failed to load tenant details.</div>
          ) : (
            <>
              {activeTab === 'overview' && <OverviewTab data={data} />}
              {activeTab === 'users' && <UsersTab data={data} />}
              {activeTab === 'billing' && <BillingTab data={data} tenantId={tenantId} onRefresh={refresh} />}
              {activeTab === 'limits' && <LimitsTab data={data} />}
            </>
          )}
        </div>
      </div>

      {showDeleteModal && data && (
        <ConfirmDeleteModal
          title={`Delete "${data.tenant.name}"`}
          description={`You are about to permanently delete the tenant "${data.tenant.name}" and all associated data.`}
          onConfirm={async () => {
            const tenantName = data.tenant.name;
            await api.deleteTenant(tenantId);
            setShowDeleteModal(false);
            onClose();
            onDeleted?.();
            toast.success(`Tenant "${tenantName}" deleted successfully.`);
          }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {showSuspendModal && data && (
        <ConfirmModal
          title={data.tenant.isActive ? `Suspend "${data.tenant.name}"` : `Reinstate "${data.tenant.name}"`}
          description={
            data.tenant.isActive
              ? `All ${data.userCount} user account(s) under this tenant will be deactivated and login will be disabled immediately.`
              : `The tenant and all its user accounts will be reactivated and login will be re-enabled.`
          }
          confirmLabel={data.tenant.isActive ? 'Suspend Tenant' : 'Reinstate Tenant'}
          confirmClassName={
            data.tenant.isActive
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }
          iconBg={data.tenant.isActive ? 'bg-amber-100' : 'bg-green-100'}
          icon={
            data.tenant.isActive
              ? <PauseCircle className="w-5 h-5 text-amber-600" />
              : <PlayCircle className="w-5 h-5 text-green-600" />
          }
          onConfirm={async () => {
            const suspending = data.tenant.isActive;
            const tenantName = data.tenant.name;
            await api.suspendTenant(tenantId, suspending);
            setShowSuspendModal(false);
            refresh();
            toast.success(
              suspending
                ? `Tenant "${tenantName}" suspended. All user logins disabled.`
                : `Tenant "${tenantName}" reinstated. User logins re-enabled.`
            );
          }}
          onCancel={() => setShowSuspendModal(false)}
        />
      )}
    </>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start py-1.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm text-gray-900 text-right max-w-[60%] ${mono ? 'font-mono text-xs' : ''}`}>
        {value ?? <span className="text-gray-300">-</span>}
      </span>
    </div>
  );
}

function StatusBadge({ status, type }: { status: string; type?: 'subscription' | 'default' }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    trialing: 'bg-blue-100 text-blue-700',
    past_due: 'bg-yellow-100 text-yellow-700',
    canceled: 'bg-red-100 text-red-700',
    incomplete: 'bg-orange-100 text-orange-700',
    inactive: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// --- Tabs ---

function OverviewTab({ data }: { data: any }) {
  const { tenant, owner, company, userCount, shops, activeSubscription } = data;
  return (
    <>
      <Section title="Tenant Info" icon={Building2}>
        <div className="bg-gray-50 rounded-lg p-4 divide-y divide-gray-100">
          <Field label="ID" value={tenant.id} mono />
          <Field label="Name" value={tenant.name} />
          <Field label="Slug" value={tenant.slug} mono />
          <Field label="Domain" value={tenant.domain} />
          <Field label="Status" value={tenant.isActive ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />} />
          <Field label="Max Users" value={tenant.maxUsers} />
          <Field label="Created" value={formatDate(tenant.createdAt)} />
        </div>
      </Section>

      {owner && (
        <Section title="Account Owner" icon={Crown}>
          <div className="bg-gray-50 rounded-lg p-4 divide-y divide-gray-100">
            <Field label="Name" value={owner.name} />
            <Field label="Email" value={owner.email} />
            <Field label="Verified" value={owner.emailVerified ? 'Yes' : 'No'} />
            <Field label="Last Login" value={formatDateTime(owner.lastLoginAt)} />
            <Field label="Subscription" value={<StatusBadge status={owner.subscriptionStatus || 'inactive'} />} />
            {owner.stripeCustomerId && <Field label="Stripe Customer" value={owner.stripeCustomerId} mono />}
          </div>
        </Section>
      )}

      {company && (
        <Section title="Company" icon={Building2}>
          <div className="bg-gray-50 rounded-lg p-4 divide-y divide-gray-100">
            <Field label="Name" value={company.name} />
            <Field label="Type" value={company.companyType} />
            {company.companyEmail && (
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm text-gray-900 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {company.companyEmail}
                </span>
              </div>
            )}
            {company.phone && (
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-gray-500">Phone</span>
                <span className="text-sm text-gray-900 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {company.phone}
                </span>
              </div>
            )}
            {company.website && (
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-gray-500">Website</span>
                <span className="text-sm text-indigo-600 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {company.website}
                </span>
              </div>
            )}
            <Field label="Location" value={company.geographicalLocation} />
            <Field label="Language" value={company.language} />
            <Field label="Setup Complete" value={company.setupCompleted ? 'Yes' : 'No'} />
            {company.businessDescription && (
              <div className="py-1.5">
                <span className="text-sm text-gray-500 block mb-1">Business Description</span>
                <p className="text-sm text-gray-700 bg-white rounded p-2 border border-gray-100">
                  {company.businessDescription}
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      {activeSubscription && (
        <Section title="Current Plan" icon={CreditCard}>
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-indigo-900 text-lg">
                {activeSubscription.plan?.displayName || activeSubscription.plan?.name || 'Unknown Plan'}
              </span>
              <StatusBadge status={activeSubscription.status} />
            </div>
            {activeSubscription.plan && (
              <p className="text-sm text-indigo-700 mb-2">{activeSubscription.plan.description}</p>
            )}
            <div className="text-sm text-indigo-800">
              <span className="font-medium">
                ${activeSubscription.isYearly ? activeSubscription.plan?.yearlyPrice : activeSubscription.plan?.price}
              </span>
              <span className="text-indigo-600">/{activeSubscription.isYearly ? 'year' : 'month'}</span>
            </div>
          </div>
        </Section>
      )}

      <Section title="Quick Stats" icon={Settings}>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{userCount}</p>
            <p className="text-xs text-gray-500">Users</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{shops?.length || 0}</p>
            <p className="text-xs text-gray-500">Shops</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{data.subscriptions?.length || 0}</p>
            <p className="text-xs text-gray-500">Subscriptions</p>
          </div>
        </div>
      </Section>
    </>
  );
}

function UsersTab({ data }: { data: any }) {
  const { users } = data;
  if (!users?.length) return <p className="text-gray-400 text-sm">No users in this tenant.</p>;

  return (
    <Section title={`Users (${users.length})`} icon={Users}>
      <div className="space-y-2">
        {users.map((u: any) => (
          <div key={u.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-900 truncate">{u.name}</span>
                {u.role === 'Owner' && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
              </div>
              <p className="text-xs text-gray-500 truncate">{u.email}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                u.role === 'Owner' ? 'bg-purple-100 text-purple-700' :
                u.role === 'Administrator' ? 'bg-blue-100 text-blue-700' :
                u.role === 'Manager' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>{u.role}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>{u.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BillingTab({ data, tenantId, onRefresh }: { data: any; tenantId: string; onRefresh: () => void }) {
  const { subscriptions, owner, activeSubscription } = data;
  const [allPlans, setAllPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activeSubscription?.planId || '');
  const [isYearly, setIsYearly] = useState<boolean>(activeSubscription?.isYearly || false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.plans().then((d) => setAllPlans(d.plans)).catch(console.error);
  }, []);

  // Keep selector in sync if panel data refreshes
  useEffect(() => {
    setSelectedPlanId(activeSubscription?.planId || '');
    setIsYearly(activeSubscription?.isYearly || false);
  }, [activeSubscription?.planId]);

  const currentPlanId = activeSubscription?.planId;
  const isDirty = selectedPlanId && (selectedPlanId !== currentPlanId || isYearly !== (activeSubscription?.isYearly || false));
  const selectedPlan = allPlans.find((p) => p.id === selectedPlanId);

  const handleSave = async () => {
    if (!selectedPlanId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.changePlan(tenantId, selectedPlanId, isYearly);
      setSaveMsg({ type: 'success', text: `Plan changed to ${selectedPlan?.displayName}` });
      onRefresh();
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || 'Failed to change plan' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Plan Changer */}
      <Section title="Change Plan" icon={CreditCard}>
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          {allPlans.length === 0 ? (
            <p className="text-sm text-gray-400">No plans available.</p>
          ) : (
            <>
              <div className="space-y-2">
                {allPlans.map((plan) => {
                  const isCurrent = plan.id === currentPlanId;
                  const isSelected = plan.id === selectedPlanId;
                  return (
                    <label
                      key={plan.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={isSelected}
                        onChange={() => setSelectedPlanId(plan.id)}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">{plan.displayName}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">Current</span>
                          )}
                          {plan.isPopular && (
                            <span className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium">Popular</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                          <span className="font-medium">${plan.price}/mo</span>
                          {plan.yearlyPrice && <span>${plan.yearlyPrice}/yr</span>}
                          <span>{plan.maxUsers ?? '∞'} users</span>
                          <span>{plan.maxShops ?? '∞'} shops</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Billing cycle toggle */}
              {selectedPlan?.yearlyPrice && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-sm text-gray-600">Billing cycle:</span>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                    <button
                      onClick={() => setIsYearly(false)}
                      className={`px-3 py-1.5 transition-colors ${!isYearly ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setIsYearly(true)}
                      className={`px-3 py-1.5 transition-colors ${isYearly ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      Yearly
                    </button>
                  </div>
                </div>
              )}

              {/* Save button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : null}
                  Save Plan Change
                </button>
                {saveMsg && (
                  <span className={`text-sm ${saveMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {saveMsg.text}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Stripe details from owner */}
      {owner && (owner.stripeCustomerId || owner.stripeSubscriptionId) && (
        <Section title="Stripe Details" icon={CreditCard}>
          <div className="bg-gray-50 rounded-lg p-4 divide-y divide-gray-100">
            {owner.stripeCustomerId && <Field label="Customer ID" value={owner.stripeCustomerId} mono />}
            {owner.stripeSubscriptionId && <Field label="Subscription ID" value={owner.stripeSubscriptionId} mono />}
            <Field label="Status" value={<StatusBadge status={owner.subscriptionStatus || 'inactive'} />} />
            {owner.subscriptionPlanId && <Field label="Plan ID" value={owner.subscriptionPlanId} mono />}
            <Field label="Start Date" value={formatDate(owner.subscriptionStartDate)} />
            <Field label="End Date" value={formatDate(owner.subscriptionEndDate)} />
            {owner.trialEndsAt && <Field label="Trial Ends" value={formatDate(owner.trialEndsAt)} />}
            {owner.suspendedByDowngrade && (
              <div className="py-2">
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Suspended by downgrade {owner.suspendedAt && `on ${formatDate(owner.suspendedAt)}`}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Active subscription details */}
      {activeSubscription?.plan && (
        <Section title="Current Plan Details" icon={ShieldCheck}>
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-indigo-900">{activeSubscription.plan.displayName}</h4>
              <StatusBadge status={activeSubscription.status} />
            </div>
            <p className="text-sm text-indigo-700">{activeSubscription.plan.description}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-white rounded p-2">
                <span className="text-gray-500 block text-xs">Monthly</span>
                <span className="font-medium">${activeSubscription.plan.price}/mo</span>
              </div>
              {activeSubscription.plan.yearlyPrice && (
                <div className="bg-white rounded p-2">
                  <span className="text-gray-500 block text-xs">Yearly</span>
                  <span className="font-medium">${activeSubscription.plan.yearlyPrice}/yr</span>
                </div>
              )}
              <div className="bg-white rounded p-2">
                <span className="text-gray-500 block text-xs">Billing Cycle</span>
                <span className="font-medium">{activeSubscription.isYearly ? 'Yearly' : 'Monthly'}</span>
              </div>
              <div className="bg-white rounded p-2">
                <span className="text-gray-500 block text-xs">Support</span>
                <span className="font-medium capitalize">{activeSubscription.plan.supportLevel}</span>
              </div>
            </div>
            <div className="text-xs text-indigo-600 space-y-1 pt-1">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Period: {formatDate(activeSubscription.currentPeriodStart)} – {formatDate(activeSubscription.currentPeriodEnd)}
              </div>
              {activeSubscription.cancelAtPeriodEnd && (
                <div className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" /> Cancels at period end</div>
              )}
              {activeSubscription.downgradeTargetPlanId && (
                <div className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" /> Downgrade scheduled</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-indigo-100">
              <div><span className="text-gray-500">Max Users:</span> {activeSubscription.plan.maxUsers ?? 'Unlimited'}</div>
              <div><span className="text-gray-500">Max Shops:</span> {activeSubscription.plan.maxShops ?? 'Unlimited'}</div>
              <div><span className="text-gray-500">Storage:</span> {activeSubscription.plan.storageLimit ? `${activeSubscription.plan.storageLimit} GB` : 'Unlimited'}</div>
              <div><span className="text-gray-500">Email/mo:</span> {activeSubscription.plan.monthlyEmailLimit ?? 'Unlimited'}</div>
            </div>
          </div>
        </Section>
      )}

      {/* Subscription history */}
      {subscriptions?.length > 0 && (
        <Section title="Subscription History" icon={Clock}>
          <div className="space-y-2">
            {subscriptions.map((sub: any) => (
              <div key={sub.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{sub.plan?.displayName || sub.planId}</span>
                  <StatusBadge status={sub.status} />
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>{formatDate(sub.currentPeriodStart)} – {formatDate(sub.currentPeriodEnd)}</div>
                  <div className="font-mono">{sub.stripeSubscriptionId}</div>
                  {sub.canceledAt && <div className="text-red-500">Canceled: {formatDate(sub.canceledAt)}</div>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!subscriptions?.length && !owner?.stripeCustomerId && (
        <div className="text-gray-400 text-sm text-center py-8">No billing data found for this tenant.</div>
      )}
    </>
  );
}

function LimitsTab({ data }: { data: any }) {
  const { limits, activeSubscription, shops } = data;

  return (
    <>
      {limits ? (
        <Section title="Custom Limit Overrides" icon={Settings}>
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 divide-y divide-amber-100">
            <Field label="Max Shops" value={limits.maxShops ?? 'Plan default'} />
            <Field label="Max Users" value={limits.maxUsers ?? 'Plan default'} />
            <Field label="Storage (GB)" value={limits.maxStorageGb ?? 'Plan default'} />
            <Field label="Monthly Email Limit" value={limits.monthlyEmailLimit ?? 'Plan default'} />
            {limits.overrideReason && <Field label="Reason" value={limits.overrideReason} />}
            <Field label="Active" value={limits.isActive ? 'Yes' : 'No'} />
            {limits.expiresAt && <Field label="Expires" value={formatDate(limits.expiresAt)} />}
          </div>
        </Section>
      ) : (
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 mb-6">
          No custom limit overrides. Using plan defaults.
        </div>
      )}

      {activeSubscription?.plan && (
        <Section title="Plan Limits" icon={ShieldCheck}>
          <div className="bg-gray-50 rounded-lg p-4 divide-y divide-gray-100">
            <Field label="Max Users" value={activeSubscription.plan.maxUsers ?? 'Unlimited'} />
            <Field label="Max Shops" value={activeSubscription.plan.maxShops ?? 'Unlimited'} />
            <Field label="Max Projects" value={activeSubscription.plan.maxProjects ?? 'Unlimited'} />
            <Field label="Storage" value={activeSubscription.plan.storageLimit ? `${activeSubscription.plan.storageLimit} GB` : 'Unlimited'} />
            <Field label="Monthly Emails" value={activeSubscription.plan.monthlyEmailLimit ?? 'Unlimited'} />
            <Field label="Users Management" value={activeSubscription.plan.allowUsersManagement ? 'Allowed' : 'Not allowed'} />
            <Field label="Roles Management" value={activeSubscription.plan.allowRolesManagement ? 'Allowed' : 'Not allowed'} />
          </div>
        </Section>
      )}

      <Section title="Current Usage" icon={Store}>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gray-900">{data.userCount}</p>
            <p className="text-xs text-gray-500">Users</p>
            {activeSubscription?.plan?.maxUsers && (
              <p className="text-xs text-gray-400 mt-0.5">of {activeSubscription.plan.maxUsers}</p>
            )}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gray-900">{shops?.length || 0}</p>
            <p className="text-xs text-gray-500">Shops</p>
            {activeSubscription?.plan?.maxShops && (
              <p className="text-xs text-gray-400 mt-0.5">of {activeSubscription.plan.maxShops}</p>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
