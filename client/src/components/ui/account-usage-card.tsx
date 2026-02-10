import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Store, 
  Users, 
  Mail, 
  Contact, 
  ListChecks, 
  FileText, 
  Newspaper, 
  Megaphone,
  Calendar,
  Tag,
  AlertCircle,
  CheckCircle2,
  Infinity,
  ArrowUpRight,
  ShieldAlert
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

interface UsageItem {
  current: number;
  limit: number | null;
  canAdd?: boolean;
  canSend?: boolean;
  remaining?: number | null;
  isCustomLimit?: boolean;
  periodLabel?: string;
}

interface AccountUsageData {
  subscription: {
    planName: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  usage: {
    shops: UsageItem;
    users: UsageItem;
    emails: UsageItem;
    contacts: UsageItem;
    lists: UsageItem;
    forms: UsageItem;
    newsletters: UsageItem;
    campaigns: UsageItem;
    appointments: UsageItem;
    tags: UsageItem;
  };
}

interface UsageMetricProps {
  icon: React.ReactNode;
  label: string;
  current: number;
  limit: number | null;
  warning?: boolean;
  periodLabel?: string;
}

function UsageMetric({ icon, label, current, limit, warning, periodLabel }: UsageMetricProps) {
  const percentage = limit ? Math.min((current / limit) * 100, 100) : 0;
  const isUnlimited = limit === null;
  const isNearLimit = limit && current >= limit * 0.8;
  const isAtLimit = limit && current >= limit;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <span className="text-sm font-medium">{label}</span>
          {periodLabel && (
            <span className="text-xs text-muted-foreground">({periodLabel})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {current.toLocaleString()}
            {!isUnlimited && (
              <span className="text-muted-foreground font-normal">
                {" / "}{limit?.toLocaleString()}
              </span>
            )}
          </span>
          {isUnlimited ? (
            <Infinity className="h-4 w-4 text-muted-foreground" />
          ) : isAtLimit ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : isNearLimit ? (
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
        </div>
      </div>
      {!isUnlimited && (
        <Progress 
          value={percentage} 
          className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-yellow-500' : ''}`}
        />
      )}
    </div>
  );
}

export function AccountUsageCard() {
  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery<AccountUsageData>({
    queryKey: ["/api/account-usage"],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('management.accountUsage.title', 'Account Usage')}</CardTitle>
          <CardDescription>{t('management.accountUsage.subtitle', 'Your current resource usage and limits')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    const is403 = error instanceof Error && error.message?.startsWith('403:');
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('management.accountUsage.title', 'Account Usage')}</CardTitle>
        </CardHeader>
        <CardContent>
          {is403 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <ShieldAlert className="h-8 w-8 text-orange-500" />
              <p className="font-medium text-sm">{t('common.permissionDenied', 'Permission Denied')}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{t('common.permissionDeniedDescription', 'You do not have permission to view this section. Contact your administrator to request access.')}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{t('management.accountUsage.error', 'Failed to load usage data')}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const { subscription, usage } = data;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('management.accountUsage.title', 'Account Usage')}</CardTitle>
            <CardDescription>
              {t('management.accountUsage.subtitle', 'Your current resource usage and limits')}
            </CardDescription>
          </div>
          <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
            {subscription.planName}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {t('management.accountUsage.billingPeriod', 'Billing period')}: {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('management.accountUsage.limitedResources', 'Limited Resources')}
          </h4>
          <UsageMetric
            icon={<Mail className="h-4 w-4" />}
            label={t('management.accountUsage.emailsSent', 'Emails Sent')}
            current={usage.emails.current}
            limit={usage.emails.limit}
            periodLabel={usage.emails.periodLabel}
          />
          {usage.shops.limit === 0 ? (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className="text-muted-foreground"><Store className="h-4 w-4" /></div>
                <span className="text-sm font-medium">{t('management.accountUsage.shops', 'Shops')}</span>
              </div>
              <Link href="/profile?tab=subscription" className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                {t('common.upgrade', 'Upgrade')}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <UsageMetric
              icon={<Store className="h-4 w-4" />}
              label={t('management.accountUsage.shops', 'Shops')}
              current={usage.shops.current}
              limit={usage.shops.limit}
            />
          )}
          {usage.users.limit !== null && usage.users.limit <= 1 ? (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className="text-muted-foreground"><Users className="h-4 w-4" /></div>
                <span className="text-sm font-medium">{t('management.accountUsage.teamMembers', 'Team Members')}</span>
              </div>
              <Link href="/profile?tab=subscription" className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                {t('common.upgrade', 'Upgrade')}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <UsageMetric
              icon={<Users className="h-4 w-4" />}
              label={t('management.accountUsage.teamMembers', 'Team Members')}
              current={usage.users.current}
              limit={usage.users.limit}
            />
          )}
        </div>

        {/* Upgrade CTA */}
        <div className="mt-8 pt-6 border-t">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>{t('management.accountUsage.needMore', 'Need even more resources?')}</span>
            <Link href="/profile?tab=subscription" className="inline-flex items-center gap-1 text-primary font-medium hover:underline">
              {t('management.accountUsage.checkPlans', 'Check out our higher limit plans')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResourceUsageCard() {
  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery<AccountUsageData>({
    queryKey: ["/api/account-usage"],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('management.resourceUsage.title', 'Resource Usage')}</CardTitle>
          <CardDescription>{t('management.resourceUsage.subtitle', 'Your current resource counts and limits')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    const is403 = error instanceof Error && error.message?.startsWith('403:');
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('management.resourceUsage.title', 'Resource Usage')}</CardTitle>
        </CardHeader>
        <CardContent>
          {is403 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <ShieldAlert className="h-8 w-8 text-orange-500" />
              <p className="font-medium text-sm">{t('common.permissionDenied', 'Permission Denied')}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{t('common.permissionDeniedDescription', 'You do not have permission to view this section. Contact your administrator to request access.')}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{t('management.resourceUsage.error', 'Failed to load usage data')}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const { usage } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('management.resourceUsage.title', 'Resource Usage')}</CardTitle>
        <CardDescription>
          {t('management.resourceUsage.subtitle', 'Your current resource counts and limits')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <UsageMetric
            icon={<Contact className="h-4 w-4" />}
            label={t('management.accountUsage.contacts', 'Contacts')}
            current={usage.contacts.current}
            limit={usage.contacts.limit}
          />
          <UsageMetric
            icon={<ListChecks className="h-4 w-4" />}
            label={t('management.accountUsage.lists', 'Lists')}
            current={usage.lists.current}
            limit={usage.lists.limit}
          />
          <UsageMetric
            icon={<FileText className="h-4 w-4" />}
            label={t('management.accountUsage.forms', 'Forms')}
            current={usage.forms.current}
            limit={usage.forms.limit}
          />
          <UsageMetric
            icon={<Newspaper className="h-4 w-4" />}
            label={t('management.accountUsage.newsletters', 'Newsletters')}
            current={usage.newsletters.current}
            limit={usage.newsletters.limit}
          />
          <UsageMetric
            icon={<Megaphone className="h-4 w-4" />}
            label={t('management.accountUsage.campaigns', 'Campaigns')}
            current={usage.campaigns.current}
            limit={usage.campaigns.limit}
          />
          <UsageMetric
            icon={<Calendar className="h-4 w-4" />}
            label={t('management.accountUsage.appointments', 'Appointments')}
            current={usage.appointments.current}
            limit={usage.appointments.limit}
          />
          <UsageMetric
            icon={<Tag className="h-4 w-4" />}
            label={t('management.accountUsage.tags', 'Tags')}
            current={usage.tags.current}
            limit={usage.tags.limit}
          />
        </div>
      </CardContent>
    </Card>
  );
}
