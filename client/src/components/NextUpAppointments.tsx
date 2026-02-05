import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, ArrowRight, Timer } from "lucide-react";
import { addHours, isWithinInterval, formatDistanceToNow, format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { AppointmentWithCustomer, getCustomerName as getCustomerNameUtils } from "@/utils/appointment-utils";

interface NextUpAppointmentsProps {
  appointments: AppointmentWithCustomer[];
  onViewDetails: (appointment: AppointmentWithCustomer) => void;
}

export function NextUpAppointments({ appointments, onViewDetails }: NextUpAppointmentsProps) {
  const [now, setNow] = useState(new Date());
  const [hoursRange, setHoursRange] = useState(48);

  useEffect(() => {
    // Initial update
    setNow(new Date());

    // Update every 5 minutes (300000 ms)
    const interval = setInterval(() => {
      setNow(new Date());
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  // Filter appointments for the selected hour range
  const nextUp = appointments.filter(apt => {
    const aptDate = new Date(apt.appointmentDate);
    // Ensure date is valid
    if (isNaN(aptDate.getTime())) return false;

    return isWithinInterval(aptDate, {
      start: now,
      end: addHours(now, hoursRange)
    }) && apt.status !== 'cancelled' && apt.status !== 'completed' && apt.status !== 'no_show';
  }).sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());

  if (nextUp.length === 0) return null;



  return (
    <Card className="mb-6 border-l-4 border-l-blue-500 bg-blue-50/10 dark:bg-blue-900/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Timer className="h-5 w-5 text-blue-500" />
            Next Up ({hoursRange}h)
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline-block">Time Range:</span>
            <Select value={hoursRange.toString()} onValueChange={(val) => setHoursRange(parseInt(val))}>
              <SelectTrigger className="w-[110px] h-8 bg-background">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 Hours</SelectItem>
                <SelectItem value="24">24 Hours</SelectItem>
                <SelectItem value="36">36 Hours</SelectItem>
                <SelectItem value="48">48 Hours</SelectItem>
                <SelectItem value="64">64 Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {nextUp.map(apt => {
            const aptDate = new Date(apt.appointmentDate);
            const countdown = formatDistanceToNow(aptDate, { addSuffix: true });

            return (
              <Card key={apt.id} className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                        Upcoming
                      </Badge>
                      {apt.status === 'confirmed' ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
                          Confirmed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">
                          Unconfirmed
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs font-mono whitespace-nowrap ml-2">
                      {countdown}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={apt.title}>
                      {apt.title}
                    </h4>
                    {apt.serviceType && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {apt.serviceType}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{getCustomerNameUtils(apt.customer)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{format(aptDate, 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{format(aptDate, 'h:mm a')} ({apt.duration} min)</span>
                    </div>
                  </div>

                  <Button
                    className="w-full mt-2"
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetails(apt)}
                  >
                    Details
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
