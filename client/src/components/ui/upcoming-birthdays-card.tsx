import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CakeIcon, CheckCircle, XCircle, ChevronRight, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";

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

export function UpcomingBirthdaysCard() {
  const [, setLocation] = useLocation();

  // Fetch contacts from the existing email-contacts endpoint
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['/api/email-contacts'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/email-contacts?limit=1000`);
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchOnWindowFocus: false,
  });

  // Extract contacts array from response data
  const contacts: Contact[] = contactsData?.contacts || [];

  // Filter contacts who have birthdays for birthday-specific features
  const customersWithBirthdays = contacts.filter(contact => contact.birthday);

  const upcomingBirthdays = customersWithBirthdays.filter(contact => {
    if (!contact.birthday) return false;
    // Parse the stored birthday to get month and day
    const [, month, day] = contact.birthday.split('-').map(Number);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

    // Create birthday date for this year
    const thisYearBirthday = new Date(today.getFullYear(), month - 1, day);
    thisYearBirthday.setHours(0, 0, 0, 0);

    // If birthday already passed this year, use next year
    const nextBirthday = thisYearBirthday < today
      ? new Date(today.getFullYear() + 1, month - 1, day)
      : thisYearBirthday;
    nextBirthday.setHours(0, 0, 0, 0);

    const daysUntilBirthday = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilBirthday >= 0 && daysUntilBirthday <= 30;
  }).sort((a, b) => {
    // Sort by days until birthday (closest first)
    const getDaysUntil = (birthday: string) => {
      const [, month, day] = birthday.split('-').map(Number);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisYearBirthday = new Date(today.getFullYear(), month - 1, day);
      thisYearBirthday.setHours(0, 0, 0, 0);
      const nextBirthday = thisYearBirthday < today
        ? new Date(today.getFullYear() + 1, month - 1, day)
        : thisYearBirthday;
      nextBirthday.setHours(0, 0, 0, 0);
      return Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };
    return getDaysUntil(a.birthday!) - getDaysUntil(b.birthday!);
  }).slice(0, 5);

  const getContactName = (contact: Contact) => {
    if (contact.firstName && contact.lastName) {
      return `${contact.firstName} ${contact.lastName}`;
    } else if (contact.firstName) {
      return contact.firstName;
    } else if (contact.lastName) {
      return contact.lastName;
    }
    return contact.email;
  };

  if (isLoading) {
    return (
      <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur rounded-2xl h-full border border-gray-100/80 dark:border-gray-800/60 shadow-sm">
        <CardHeader className="pb-4 border-b border-gray-100/70 dark:border-gray-800/60">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-900/30">
              <CakeIcon className="h-5 w-5 text-pink-500" />
            </span>
            Upcoming Birthdays
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 dark:bg-gray-900/60 backdrop-blur rounded-2xl h-full border border-gray-100/80 dark:border-gray-800/60 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-4 border-b border-gray-100/70 dark:border-gray-800/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-900/30">
              <CakeIcon className="h-5 w-5 text-pink-500" />
            </span>
            Upcoming Birthdays
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/birthdays')}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-full"
          >
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {upcomingBirthdays.length === 0 ? (
          <div className="text-center py-8">
            <CakeIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              No birthdays in the next 30 days
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/birthdays')}
              className="text-xs"
            >
              Manage Birthdays
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-3">
              <span>{upcomingBirthdays.length} upcoming</span>
              <span>Next 30 days</span>
            </div>
            <div className="space-y-3">
              {upcomingBirthdays.map((contact) => {
                const getDaysUntil = (birthday: string) => {
                  const [, month, day] = birthday.split('-').map(Number);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const thisYearBirthday = new Date(today.getFullYear(), month - 1, day);
                  thisYearBirthday.setHours(0, 0, 0, 0);
                  const nextBirthday = thisYearBirthday < today
                    ? new Date(today.getFullYear() + 1, month - 1, day)
                    : thisYearBirthday;
                  nextBirthday.setHours(0, 0, 0, 0);
                  return Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                };
                const daysUntil = contact.birthday ? getDaysUntil(contact.birthday) : 0;

                return (
                  <div
                    key={contact.id}
                    onClick={() => setLocation(`/email-contacts/view/${contact.id}`)}
                    className="flex items-center justify-between p-3 bg-gray-50/80 dark:bg-gray-800/60 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200/80 dark:hover:border-gray-700/60"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {getContactName(contact)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {contact.birthday && (() => {
                          // Parse date to display month/day
                          const [, month, day] = contact.birthday.split('-').map(Number);
                          const displayDate = new Date(2000, month - 1, day);
                          const dateStr = displayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                          const dayText = daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;
                          return `${dateStr} • ${dayText}`;
                        })()}
                      </p>
                    </div>
                    {contact.birthdayUnsubscribedAt ? (
                      <span title="Unsubscribed from birthday emails">
                        <AlertTriangle className="h-4 w-4 text-orange-500 ml-2" />
                      </span>
                    ) : contact.birthdayEmailEnabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 ml-2" />
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/birthdays')}
              className="w-full mt-4"
            >
              Manage Birthday Settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
