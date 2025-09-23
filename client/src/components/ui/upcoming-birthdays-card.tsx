import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CakeIcon, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "active" | "unsubscribed" | "bounced" | "pending";
  birthday?: string | null;
  birthdayEmailEnabled?: boolean;
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
    const birthday = new Date(contact.birthday);
    const today = new Date();
    const daysUntilBirthday = Math.ceil((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilBirthday >= 0 && daysUntilBirthday <= 30;
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
      <Card className="bg-white dark:bg-gray-800 rounded-xl h-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CakeIcon className="h-5 w-5" />
            Upcoming Birthdays
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800 rounded-xl h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CakeIcon className="h-5 w-5" />
            Upcoming Birthdays
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/birthdays')}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {upcomingBirthdays.length === 0 ? (
          <div className="text-center py-8">
            <CakeIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
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
              {upcomingBirthdays.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {getContactName(contact)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {contact.birthday && new Date(contact.birthday).toLocaleDateString()}
                    </p>
                  </div>
                  {contact.birthdayEmailEnabled ? (
                    <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 ml-2" />
                  )}
                </div>
              ))}
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
