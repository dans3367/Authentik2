import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, MessageSquare, Phone, Mail, Home, Check, ArrowRight, Loader2 } from "lucide-react";
import SendEmailModal from "@/components/SendEmailModal";
import { addHours, isWithinInterval, format, isToday, isTomorrow, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { AppointmentWithCustomer, Customer, getCustomerName as getCustomerNameUtils } from "@/utils/appointment-utils";

interface NextUpAppointmentsProps {
  appointments: AppointmentWithCustomer[];
  onViewDetails: (appointment: AppointmentWithCustomer) => void;
  onConfirm?: (appointmentId: string) => Promise<unknown> | void;
  pageTitle?: ReactNode;
  pageSubtitle?: ReactNode;
  pageAction?: ReactNode;
}

const AVATAR_PALETTE = [
  "bg-sky-200 text-sky-900",
  "bg-pink-200 text-pink-900",
  "bg-emerald-200 text-emerald-900",
  "bg-teal-200 text-teal-900",
  "bg-amber-200 text-amber-900",
  "bg-violet-200 text-violet-900",
  "bg-rose-200 text-rose-900",
  "bg-indigo-200 text-indigo-900",
];

function hashString(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatAddress(c: Customer) {
  const line1 = c.address?.trim();
  const cityState = [c.city, c.state].filter(Boolean).join(", ");
  const line2 = [cityState, c.zipCode].filter(Boolean).join(" ").trim();
  const lines = [line1, line2, c.country?.trim()].filter((v): v is string => Boolean(v && v.length));
  return lines;
}

interface CustomerInfoDialogProps {
  customer: Customer;
  trigger: ReactNode;
}

function CustomerInfoDialog({ customer, trigger }: CustomerInfoDialogProps) {
  const { t } = useTranslation();
  const name = getCustomerNameUtils(customer);
  const initials = getInitials(name);
  const avatarClass = AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length];
  const addressLines = formatAddress(customer);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center text-base font-semibold ${avatarClass}`}>
              {initials}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-left text-lg truncate">{name}</DialogTitle>
              <DialogDescription className="text-left">{t('reminders.nextUp.customerContactInfo')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
          {customer.phoneNumber ? (
            <a
              href={`tel:${customer.phoneNumber}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              <Phone className="h-4 w-4 text-slate-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{t('reminders.nextUp.phone')}</div>
                <div className="text-sm text-slate-900 dark:text-slate-100 truncate">{customer.phoneNumber}</div>
              </div>
            </a>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3">
              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{t('reminders.nextUp.phone')}</div>
                <div className="text-sm text-slate-400 italic">{t('reminders.nextUp.notProvided')}</div>
              </div>
            </div>
          )}

          {customer.email ? (
            <a
              href={`mailto:${customer.email}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              <Mail className="h-4 w-4 text-slate-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{t('reminders.nextUp.email')}</div>
                <div className="text-sm text-slate-900 dark:text-slate-100 truncate">{customer.email}</div>
              </div>
            </a>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3">
              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{t('reminders.nextUp.email')}</div>
                <div className="text-sm text-slate-400 italic">{t('reminders.nextUp.notProvided')}</div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 px-4 py-3">
            <Home className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{t('reminders.nextUp.address')}</div>
              {addressLines.length === 0 ? (
                <div className="text-sm text-slate-400 italic">{t('reminders.nextUp.notProvided')}</div>
              ) : (
                <div className="text-sm text-slate-900 dark:text-slate-100 space-y-0.5">
                  {addressLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NextUpAppointments({
  appointments,
  onViewDetails,
  onConfirm,
  pageTitle,
  pageSubtitle,
  pageAction,
}: NextUpAppointmentsProps) {
  const { t, i18n } = useTranslation();
  // date-fns formats weekday/month names in English unless given a locale.
  const dfLocale = i18n.language?.toLowerCase().startsWith("es") ? es : undefined;
  const groupLabel = (date: Date) => {
    if (isToday(date)) return t('reminders.nextUp.today');
    if (isTomorrow(date)) return t('reminders.nextUp.tomorrow');
    return format(date, "EEEE", { locale: dfLocale });
  };
  const [now, setNow] = useState(new Date());
  const [hoursRange, setHoursRange] = useState(48);
  const [confirmingIds, setConfirmingIds] = useState<Set<string>>(new Set());

  const handleConfirmClick = async (appointmentId: string) => {
    if (!onConfirm || confirmingIds.has(appointmentId)) return;
    setConfirmingIds(prev => {
      const next = new Set(prev);
      next.add(appointmentId);
      return next;
    });
    try {
      await onConfirm(appointmentId);
    } finally {
      setConfirmingIds(prev => {
        const next = new Set(prev);
        next.delete(appointmentId);
        return next;
      });
    }
  };

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => {
      setNow(new Date());
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  const nextUp = appointments.filter(apt => {
    const aptDate = new Date(apt.appointmentDate);
    if (isNaN(aptDate.getTime())) return false;
    return isWithinInterval(aptDate, {
      start: now,
      end: addHours(now, hoursRange)
    }) && apt.status !== 'cancelled' && apt.status !== 'completed' && apt.status !== 'no_show';
  }).sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());

  const groups = useMemo(() => {
    const map: { key: string; date: Date; items: AppointmentWithCustomer[] }[] = [];
    for (const apt of nextUp) {
      const d = new Date(apt.appointmentDate);
      const last = map[map.length - 1];
      if (last && isSameDay(last.date, d)) {
        last.items.push(apt);
      } else {
        map.push({ key: d.toDateString(), date: d, items: [apt] });
      }
    }
    return map;
  }, [nextUp]);

  const unconfirmedCount = nextUp.filter(
    a => a.status !== 'confirmed' && a.status !== 'in_progress'
  ).length;

  // Compact range filter — reads clearly as an adjustable control, not a heading.
  const rangeSelect = (
    <Select
      value={hoursRange.toString()}
      onValueChange={(val) => setHoursRange(parseInt(val))}
    >
      <SelectTrigger
        aria-label={t('reminders.nextUp.timeRange')}
        className="h-9 w-[150px] text-sm font-medium"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="12">{t('reminders.nextUp.next12Hours')}</SelectItem>
        <SelectItem value="24">{t('reminders.nextUp.next24Hours')}</SelectItem>
        <SelectItem value="36">{t('reminders.nextUp.next36Hours')}</SelectItem>
        <SelectItem value="48">{t('reminders.nextUp.next48Hours')}</SelectItem>
        <SelectItem value="64">{t('reminders.nextUp.next64Hours')}</SelectItem>
      </SelectContent>
    </Select>
  );

  // At-a-glance counts as quiet chips; unconfirmed only surfaces when it matters.
  const summaryChips = (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <span className="tabular-nums">{nextUp.length}</span>
        <span className="text-slate-500 dark:text-slate-400">{t('reminders.nextUp.scheduled')}</span>
      </span>
      {unconfirmedCount > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="tabular-nums">{unconfirmedCount}</span>
          <span>{t('reminders.nextUp.unconfirmed')}</span>
        </span>
      )}
    </div>
  );

  const hasPageHeader = Boolean(pageTitle || pageSubtitle || pageAction);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-6">
        {hasPageHeader ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                {pageTitle && (
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                    {pageTitle}
                  </h1>
                )}
                {pageSubtitle && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {pageSubtitle}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {rangeSelect}
                {pageAction}
              </div>
            </div>

            {summaryChips}
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {rangeSelect}
            {summaryChips}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {nextUp.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            {t('reminders.nextUp.noUpcoming', { hours: hoursRange })}
          </p>
        ) : (
          <div className="space-y-8">
            {groups.map(group => (
              <div key={group.key}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-baseline gap-2 shrink-0">
                    <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {groupLabel(group.date)}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {format(group.date, "MMM d", { locale: dfLocale })}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  <span className="text-xs font-medium tracking-wider text-slate-500 dark:text-slate-400">
                    {group.items.length}{" "}
                    {group.items.length === 1
                      ? t('reminders.nextUp.appointmentCountAbbr')
                      : t('reminders.nextUp.appointmentCountAbbrPlural')}
                  </span>
                </div>

                <div className="relative">
                  <div
                    className="absolute left-[62px] top-2 bottom-2 border-l border-dashed border-slate-300 dark:border-slate-700"
                    aria-hidden="true"
                  />
                  <ul className="space-y-3">
                    {group.items.map(apt => {
                      const aptDate = new Date(apt.appointmentDate);
                      const customerName = getCustomerNameUtils(apt.customer);
                      const isConfirmed = apt.status === 'confirmed';
                      const isInProgress = apt.status === 'in_progress';
                      const isStartable = aptDate.getTime() - now.getTime() <= 30 * 60 * 1000;
                      const avatarClass = AVATAR_PALETTE[hashString(customerName) % AVATAR_PALETTE.length];
                      const dotClass = isConfirmed || isInProgress
                        ? "bg-emerald-500"
                        : "bg-amber-500";
                      const statusLabel = isInProgress
                        ? t('reminders.nextUp.statusInProgress')
                        : isConfirmed
                          ? t('reminders.nextUp.statusConfirmed')
                          : t('reminders.nextUp.statusNeedsConfirmation');

                      return (
                        <li key={apt.id} className="flex items-stretch gap-4">
                          <div className="w-[56px] shrink-0 flex flex-col items-end pt-4">
                            <div className="flex items-baseline gap-0.5 text-slate-900 dark:text-slate-100">
                              <span className="text-xl font-semibold tracking-tight tabular-nums">
                                {format(aptDate, "h:mm", { locale: dfLocale })}
                              </span>
                              <span className="text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                                {format(aptDate, "a", { locale: dfLocale })}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              +{apt.duration}m
                            </span>
                          </div>

                          <div className="relative shrink-0 flex items-center pt-5">
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    role="img"
                                    aria-label={statusLabel}
                                    tabIndex={0}
                                    className={`relative z-10 h-2.5 w-2.5 rounded-full ring-2 ring-slate-50 dark:ring-slate-900/40 outline-none focus-visible:ring-slate-400 ${dotClass}`}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {statusLabel}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          <div className="flex-1 group flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all">
                            <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${avatarClass}`}>
                              {getInitials(customerName)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => onViewDetails(apt)}
                                  className="max-w-full truncate text-left text-sm font-semibold text-slate-900 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-100 dark:focus-visible:ring-offset-slate-900"
                                  aria-label={t('reminders.nextUp.viewDetailsFor', { name: customerName })}
                                >
                                  {customerName}
                                </button>
                                {!isConfirmed && !isInProgress && (
                                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md border-0">
                                    {t('reminders.nextUp.badgeNeedsConfirm')}
                                  </Badge>
                                )}
                                {isInProgress && (
                                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md border-0">
                                    {t('reminders.nextUp.badgeInProgress')}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => onViewDetails(apt)}
                                  className="truncate text-left underline-offset-4 hover:text-slate-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:hover:text-slate-200 dark:focus-visible:ring-offset-slate-900"
                                  aria-label={t('reminders.nextUp.viewDetailsForTitle', { title: apt.title })}
                                >
                                  {apt.title}
                                </button>
                                {apt.shop?.name && (
                                  <>
                                    <span className="text-slate-300 dark:text-slate-600">·</span>
                                    <span className="flex items-center gap-1 truncate">
                                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{apt.shop.name}</span>
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {apt.customer?.id && apt.customer?.email ? (
                                <SendEmailModal
                                  contactId={apt.customer.id}
                                  contactEmail={apt.customer.email}
                                  contactName={customerName}
                                  trigger={
                                    <button
                                      type="button"
                                      className="h-8 w-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
                                      aria-label={t('reminders.nextUp.sendEmailTo', { name: customerName })}
                                      title={t('reminders.nextUp.sendEmail')}
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                    </button>
                                  }
                                />
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="h-8 w-8 rounded-md flex items-center justify-center text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                  aria-label={t('reminders.nextUp.noEmailOnFile')}
                                  title={t('reminders.nextUp.noEmailOnFile')}
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </button>
                              )}
                              {apt.customer ? (
                                <CustomerInfoDialog
                                  customer={apt.customer}
                                  trigger={
                                    <button
                                      type="button"
                                      className="h-8 w-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
                                      aria-label={t('reminders.nextUp.viewContactInfoFor', { name: customerName })}
                                      title={t('reminders.nextUp.contactInfo')}
                                    >
                                      <Phone className="h-4 w-4" />
                                    </button>
                                  }
                                />
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="h-8 w-8 rounded-md flex items-center justify-center text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                  aria-label={t('reminders.nextUp.noCustomerInfo')}
                                  title={t('reminders.nextUp.noCustomerInfo')}
                                >
                                  <Phone className="h-4 w-4" />
                                </button>
                              )}
                              {isConfirmed || isInProgress ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="ml-1 h-9 px-3 rounded-lg border-slate-300 dark:border-slate-700 font-medium"
                                  onClick={() => onViewDetails(apt)}
                                >
                                  {isStartable || isInProgress ? t('reminders.nextUp.start') : t('reminders.nextUp.details')}
                                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={confirmingIds.has(apt.id)}
                                  className="ml-1 h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white font-medium"
                                  onClick={() => {
                                    if (onConfirm) {
                                      handleConfirmClick(apt.id);
                                    } else {
                                      onViewDetails(apt);
                                    }
                                  }}
                                >
                                  {confirmingIds.has(apt.id) ? (
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5 mr-1.5" />
                                  )}
                                  {confirmingIds.has(apt.id) ? t('reminders.nextUp.confirming') : t('reminders.nextUp.confirm')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
