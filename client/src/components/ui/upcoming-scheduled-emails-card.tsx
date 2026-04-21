import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppSelector } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Clock,
  Send,
  CalendarClock,
  ChevronRight,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

interface ScheduledEmailContact {
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface ScheduledEmail {
  id: string;
  to: string[];
  subject: string;
  status: "pending" | "triggered" | "running";
  scheduledAt: string;
  createdAt: string;
  contactId: string | null;
  contact: ScheduledEmailContact | null;
  metadata: {
    timezone?: string;
    scheduledBy?: string;
    taskLogId?: string;
  };
}

const statusConfig: Record<string, { color: string; dot: string; icon: React.ElementType; label: string }> = {
  pending: {
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    icon: Clock,
    label: "Queued",
  },
  triggered: {
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
    icon: Send,
    label: "Triggered",
  },
  running: {
    color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    icon: Loader2,
    label: "Sending",
  },
};

function getContactName(email: ScheduledEmail): string {
  if (email.contact) {
    if (email.contact.firstName && email.contact.lastName)
      return `${email.contact.firstName} ${email.contact.lastName}`;
    if (email.contact.firstName) return email.contact.firstName;
    if (email.contact.lastName) return email.contact.lastName;
    return email.contact.email;
  }
  return email.to[0] || "Unknown";
}

function getInitials(email: ScheduledEmail): string {
  if (email.contact) {
    if (email.contact.firstName && email.contact.lastName)
      return `${email.contact.firstName[0]}${email.contact.lastName[0]}`.toUpperCase();
    if (email.contact.firstName) return email.contact.firstName[0].toUpperCase();
    if (email.contact.lastName) return email.contact.lastName[0].toUpperCase();
    return email.contact.email[0].toUpperCase();
  }
  return (email.to[0] || "?")[0].toUpperCase();
}

function getDaysUntil(scheduledAt: string): number {
  const scheduled = new Date(scheduledAt);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const scheduledDay = new Date(scheduled);
  scheduledDay.setHours(0, 0, 0, 0);
  return Math.ceil((scheduledDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const avatarColors = [
  "from-cyan-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-rose-400 to-pink-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
];

export function UpcomingScheduledEmailsCard() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);

  const { data, isLoading } = useQuery<{ scheduled: ScheduledEmail[]; total: number }>({
    queryKey: ["/api/scheduled-emails/upcoming", { shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/scheduled-emails/upcoming?limit=5");
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const scheduled = data?.scheduled || [];

  const formatTime = (dateStr: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(dateStr));

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(dateStr));

  if (isLoading) {
    return (
      <Card className="h-full rounded-2xl border-border/50">
        <CardHeader className="pb-2 px-5 pt-5">
          <CardTitle className="text-base font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <CalendarClock className="h-4 w-4 text-cyan-500" />
            </div>
            {t("dashboard.scheduledEmails.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-200 border-t-cyan-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full rounded-2xl border-border/50">
      <CardHeader className="pb-2 px-5 pt-5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-bold flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <CalendarClock className="h-4 w-4 text-cyan-500" />
            </div>
            {t("dashboard.scheduledEmails.title")}
            {scheduled.length > 0 && (
              <span className="text-[10px] font-bold text-muted-foreground/50 bg-muted/60 px-2 py-1 rounded-lg ml-1">
                {data?.total || scheduled.length}
              </span>
            )}
          </CardTitle>
          {scheduled.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/email-contacts")}
              className="text-[10px] font-semibold rounded-lg text-muted-foreground/60 hover:text-primary h-7 px-2"
            >
              {t("dashboard.scheduledEmails.viewAll")}
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-2">
        {scheduled.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/5 flex items-center justify-center mx-auto">
              <Mail className="h-6 w-6 text-cyan-400/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground/80 mb-0.5">
                {t("dashboard.scheduledEmails.noEmailsTitle")}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {t("dashboard.scheduledEmails.noEmailsDesc")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/email-contacts")}
              className="text-xs rounded-lg mt-2"
            >
              {t("dashboard.scheduledEmails.scheduleNew")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 px-0.5">
              <span className="font-semibold uppercase tracking-[0.1em]">
                {t("dashboard.scheduledEmails.upcoming", { count: data?.total || scheduled.length })}
              </span>
            </div>

            <ul className="flex flex-col gap-1.5">
              {scheduled.map((email, index) => {
                const days = getDaysUntil(email.scheduledAt);
                const isToday = days === 0;
                const config = statusConfig[email.status] || statusConfig.pending;
                const clickable = !!email.contactId;

                return (
                  <li key={email.id}>
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() =>
                        clickable &&
                        setLocation(`/email-contacts/view/${email.contactId}/scheduled`)
                      }
                      className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                        clickable ? "cursor-pointer" : "cursor-default"
                      } ${
                        isToday
                          ? "bg-gradient-to-r from-cyan-500/[0.06] to-transparent dark:from-cyan-500/10 border-cyan-200/40 dark:border-cyan-500/15 hover:from-cyan-500/[0.1]"
                          : "bg-muted/20 border-border/30 hover:bg-muted/40 hover:border-border/60"
                      }`}
                    >
                      <div
                        className={`shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br ${avatarColors[index % avatarColors.length]} flex items-center justify-center shadow-sm`}
                      >
                        <span className="text-white text-[11px] font-bold">
                          {getInitials(email)}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-semibold text-foreground/90 truncate leading-tight">
                            {email.subject ||
                              t("dashboard.scheduledEmails.noSubject", "No subject")}
                          </p>
                          <Badge
                            className={`${config.color} shrink-0 text-[9px] px-1.5 py-0 h-[18px] rounded-md capitalize border-0 font-semibold`}
                          >
                            <span
                              className={`w-1 h-1 rounded-full ${config.dot} mr-1`}
                            />
                            {t(`dashboard.scheduledEmails.${email.status}`)}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                          {getContactName(email)}
                        </p>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-0.5 font-mono">
                        <span
                          className={`text-[11px] font-semibold leading-none ${
                            isToday
                              ? "text-cyan-600 dark:text-cyan-400"
                              : "text-foreground/70"
                          }`}
                        >
                          {formatTime(email.scheduledAt)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 leading-none">
                          {isToday
                            ? t("dashboard.scheduledEmails.today")
                            : formatDate(email.scheduledAt)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/email-contacts")}
              className="w-full mt-1 rounded-xl text-xs font-semibold border-dashed border-border/60 hover:bg-muted/30"
            >
              {t("dashboard.scheduledEmails.scheduleNew")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
