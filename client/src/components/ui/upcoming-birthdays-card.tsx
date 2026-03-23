import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppSelector } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CakeIcon,
  CheckCircle,
  XCircle,
  ChevronRight,
  AlertTriangle,
  PartyPopper,
  Gift,
} from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "active" | "unsubscribed" | "bounced" | "pending";
  birthday?: string | null;
  birthdayEmailEnabled?: boolean;
  birthdayUnsubscribedAt?: Date | null;
}

function getInitials(contact: Contact): string {
  if (contact.firstName && contact.lastName) {
    return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
  }
  if (contact.firstName) return contact.firstName[0].toUpperCase();
  if (contact.lastName) return contact.lastName[0].toUpperCase();
  return contact.email[0].toUpperCase();
}

const avatarColors = [
  "from-pink-400 to-rose-500",
  "from-violet-400 to-purple-500",
  "from-blue-400 to-indigo-500",
  "from-teal-400 to-cyan-500",
  "from-amber-400 to-orange-500",
];

export function UpcomingBirthdaysCard() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["/api/email-contacts", { shopId: selectedShopId }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/email-contacts?limit=1000`);
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const contacts: Contact[] = contactsData?.contacts || [];
  const customersWithBirthdays = contacts.filter((contact) => contact.birthday);

  const upcomingBirthdays = customersWithBirthdays
    .filter((contact) => {
      if (!contact.birthday) return false;
      const [, month, day] = contact.birthday.split("-").map(Number);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisYearBirthday = new Date(today.getFullYear(), month - 1, day);
      thisYearBirthday.setHours(0, 0, 0, 0);
      const nextBirthday =
        thisYearBirthday < today
          ? new Date(today.getFullYear() + 1, month - 1, day)
          : thisYearBirthday;
      nextBirthday.setHours(0, 0, 0, 0);
      const daysUntilBirthday = Math.ceil(
        (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilBirthday >= 0 && daysUntilBirthday <= 30;
    })
    .sort((a, b) => {
      const getDaysUntil = (birthday: string) => {
        const [, month, day] = birthday.split("-").map(Number);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thisYearBirthday = new Date(today.getFullYear(), month - 1, day);
        thisYearBirthday.setHours(0, 0, 0, 0);
        const nextBirthday =
          thisYearBirthday < today
            ? new Date(today.getFullYear() + 1, month - 1, day)
            : thisYearBirthday;
        nextBirthday.setHours(0, 0, 0, 0);
        return Math.ceil(
          (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
      };
      return getDaysUntil(a.birthday!) - getDaysUntil(b.birthday!);
    })
    .slice(0, 5);

  const getContactName = (contact: Contact) => {
    if (contact.firstName && contact.lastName)
      return `${contact.firstName} ${contact.lastName}`;
    if (contact.firstName) return contact.firstName;
    if (contact.lastName) return contact.lastName;
    return contact.email;
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center">
              <CakeIcon className="h-4 w-4 text-pink-500" />
            </div>
            {t("dashboard.birthdays.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-pink-200 border-t-pink-500" />
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
            <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center">
              <CakeIcon className="h-4 w-4 text-pink-500" />
            </div>
            {t("dashboard.birthdays.title")}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/birthdays")}
            className="text-xs rounded-full text-muted-foreground hover:text-primary"
            data-testid="button-view-all-birthdays"
          >
            {t("dashboard.birthdays.viewAll")}
            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {upcomingBirthdays.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center mx-auto">
              <Gift className="h-7 w-7 text-pink-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                {t("dashboard.birthdays.noBirthdaysTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.birthdays.noBirthdaysDesc")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/birthdays")}
              className="text-xs rounded-full mt-2"
            >
              {t("dashboard.birthdays.manage")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-medium">
                {t("dashboard.birthdays.upcoming", { count: upcomingBirthdays.length })}
              </span>
              <span>{t("dashboard.birthdays.next30Days")}</span>
            </div>
            <div className="space-y-2">
              {upcomingBirthdays.map((contact, index) => {
                const getDaysUntil = (birthday: string) => {
                  const [, month, day] = birthday.split("-").map(Number);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const thisYearBirthday = new Date(
                    today.getFullYear(),
                    month - 1,
                    day
                  );
                  thisYearBirthday.setHours(0, 0, 0, 0);
                  const nextBirthday =
                    thisYearBirthday < today
                      ? new Date(today.getFullYear() + 1, month - 1, day)
                      : thisYearBirthday;
                  nextBirthday.setHours(0, 0, 0, 0);
                  return Math.ceil(
                    (nextBirthday.getTime() - today.getTime()) /
                    (1000 * 60 * 60 * 24)
                  );
                };
                const daysUntil = contact.birthday
                  ? getDaysUntil(contact.birthday)
                  : 0;
                const isToday = daysUntil === 0;

                return (
                  <div
                    key={contact.id}
                    onClick={() =>
                      setLocation(`/email-contacts/view/${contact.id}`)
                    }
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${isToday
                        ? "bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-200/50 dark:border-pink-500/20 hover:shadow-md"
                        : "bg-muted/30 hover:bg-muted/60"
                      }`}
                  >
                    {/* Avatar with initials */}
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[index % avatarColors.length]
                        } flex items-center justify-center flex-shrink-0 shadow-sm`}
                    >
                      <span className="text-white text-sm font-bold">
                        {getInitials(contact)}
                      </span>
                    </div>

                    {/* Name & Date */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {getContactName(contact)}
                        </p>
                        {isToday && (
                          <PartyPopper className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {contact.birthday &&
                          (() => {
                            const [, month, day] = contact.birthday
                              .split("-")
                              .map(Number);
                            const displayDate = new Date(2000, month - 1, day);
                            const dateStr = displayDate.toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                              }
                            );
                            const dayText = isToday
                              ? t("dashboard.birthdays.today")
                              : daysUntil === 1
                                ? t("dashboard.birthdays.tomorrow")
                                : t("dashboard.birthdays.inDays", { count: daysUntil });
                            return `${dateStr} • ${dayText}`;
                          })()}
                      </p>
                    </div>

                    {/* Status indicator */}
                    {contact.birthdayUnsubscribedAt ? (
                      <span title={t("dashboard.birthdays.unsubscribedTitle")}>
                        <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      </span>
                    ) : contact.birthdayEmailEnabled ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    )}                  </div>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/birthdays")}
              className="w-full mt-2 rounded-lg text-xs"
            >
              {t("dashboard.birthdays.manageBirthdaySettings")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
