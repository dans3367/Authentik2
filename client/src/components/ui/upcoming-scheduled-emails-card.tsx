import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

const statusConfig: Record<
  string,
  { color: string; dot: string; icon: React.ElementType }
> = {
  pending: {
    color:
      "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dot: "bg-amber-500",
    icon: Clock,
  },
  triggered: {
    color:
      "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dot: "bg-blue-500",
    icon: Send,
  },
  running: {
    color:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dot: "bg-emerald-500",
    icon: Loader2,
  },
};

const avatarColors = [
  "from-cyan-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-rose-400 to-pink-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
];

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
    if (email.contact.firstName)
      return email.contact.firstName[0].toUpperCase();
    if (email.contact.lastName)
      return email.contact.lastName[0].toUpperCase();
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
  return Math.ceil(
    (scheduledDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function UpcomingScheduledEmailsCard() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<{
    scheduled: ScheduledEmail[];
    total: number;
  }>({
    queryKey: ["/api/scheduled-emails/upcoming"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/scheduled-emails/upcoming?limit=5"
      );
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const scheduled = data?.scheduled || [];

  const formatTime = (dateStr: string) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(dateStr));

  const getMonthName = (dateStr: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short" })
      .format(new Date(dateStr))
      .toUpperCase();

  const getDayNumber = (dateStr: string) =>
    new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(
      new Date(dateStr)
    );

  const getDayLabel = (dateStr: string) => {
    const days = getDaysUntil(dateStr);
    if (days === 0) return t("dashboard.scheduledEmails.today");
    if (days === 1) return t("dashboard.scheduledEmails.tomorrow");
    return t("dashboard.scheduledEmails.inDays", { count: days });
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center">
              <CalendarClock className="h-4 w-4 text-cyan-500" />
            </div>
            {t("dashboard.scheduledEmails.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-200 border-t-cyan-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center">
              <CalendarClock className="h-4 w-4 text-cyan-500" />
            </div>
            {t("dashboard.scheduledEmails.title")}
          </CardTitle>
          {scheduled.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/email-contacts")}
              className="text-xs rounded-full text-muted-foreground hover:text-primary"
            >
              {t("dashboard.scheduledEmails.viewAll")}
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {scheduled.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center mx-auto">
              <Mail className="h-7 w-7 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                {t("dashboard.scheduledEmails.noEmailsTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.scheduledEmails.noEmailsDesc")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/email-contacts")}
              className="text-xs rounded-full mt-2"
            >
              {t("dashboard.scheduledEmails.scheduleNew")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-medium">
                {t("dashboard.scheduledEmails.upcoming", {
                  count: data?.total || scheduled.length,
                })}
              </span>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {scheduled.map((email, index) => {
                const days = getDaysUntil(email.scheduledAt);
                const isToday = days === 0;
                const config = statusConfig[email.status] || statusConfig.pending;

                return (
                  <div
                    key={email.id}
                    onClick={() =>
                      email.contactId
                        ? setLocation(
                            `/email-contacts/view/${email.contactId}/scheduled`
                          )
                        : undefined
                    }
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                      email.contactId ? "cursor-pointer" : ""
                    } ${
                      isToday
                        ? "bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200/50 dark:border-cyan-500/20 hover:shadow-md"
                        : "bg-muted/30 hover:bg-muted/60"
                    }`}
                  >
                    {/* Date Box */}
                    <div
                      className={`flex flex-col items-center justify-center w-12 h-14 rounded-xl flex-shrink-0 ${
                        isToday
                          ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/30"
                          : "bg-muted/80 border border-border/50"
                      }`}
                    >
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5 ${
                          isToday
                            ? "text-white/80"
                            : "text-destructive"
                        }`}
                      >
                        {getMonthName(email.scheduledAt)}
                      </span>
                      <span
                        className={`text-lg font-bold leading-none ${
                          isToday ? "text-white" : "text-foreground"
                        }`}
                      >
                        {getDayNumber(email.scheduledAt)}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {email.subject || "No subject"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(email.scheduledAt)}
                        </span>
                        <span className="text-border">&bull;</span>
                        <span className="truncate">
                          {getContactName(email)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge
                          className={`${config.color} text-[10px] px-2 py-0 h-5 rounded-md capitalize border-0 font-medium`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${config.dot} mr-1`}
                          />
                          {t(
                            `dashboard.scheduledEmails.${email.status}`
                          )}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {getDayLabel(email.scheduledAt)}
                        </span>
                      </div>
                    </div>

                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${
                        avatarColors[index % avatarColors.length]
                      } flex items-center justify-center flex-shrink-0 shadow-sm`}
                    >
                      <span className="text-white text-xs font-bold">
                        {getInitials(email)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/email-contacts")}
              className="w-full mt-2 rounded-lg text-xs"
            >
              {t("dashboard.scheduledEmails.scheduleNew")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
