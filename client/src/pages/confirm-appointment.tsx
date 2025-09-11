import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Clock, 
  MapPin, 
  User,
  AlertTriangle,
  Loader2
} from "lucide-react";

interface AppointmentData {
  id: string;
  title: string;
  description?: string;
  appointmentDate: string;
  duration: number;
  location?: string;
  serviceType?: string;
  status: string;
  customer: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export default function ConfirmAppointmentPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/confirm-appointment/:id");
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appointmentId = params?.id;
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    if (!appointmentId || !token) {
      setError('Invalid confirmation link');
      setLoading(false);
      return;
    }

    fetchAppointment();
  }, [appointmentId, token]);

  const fetchAppointment = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/appointments/${appointmentId}?token=${token}`);
      
      if (!response.ok) {
        throw new Error('Appointment not found or invalid token');
      }
      
      const data = await response.json();
      setAppointment(data.appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!appointmentId || !token) return;
    
    try {
      setConfirming(true);
      const response = await fetch(`/api/appointments/${appointmentId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm appointment');
      }

      setConfirmed(true);
      if (appointment) {
        setAppointment({ ...appointment, status: 'confirmed' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm appointment');
    } finally {
      setConfirming(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getCustomerName = (customer: AppointmentData['customer']) => {
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    } else if (customer.firstName) {
      return customer.firstName;
    } else if (customer.lastName) {
      return customer.lastName;
    }
    return customer.email;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading appointment details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Link</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => window.close()} variant="outline">
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Appointment Not Found</h2>
            <p className="text-gray-600 mb-6">
              The appointment you're looking for could not be found.
            </p>
            <Button onClick={() => window.close()} variant="outline">
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Appointment Confirmation
            </h1>
            <p className="text-gray-600">
              Please review and confirm your appointment details
            </p>
          </div>

          {/* Confirmation Success */}
          {confirmed && (
            <Card className="mb-6 border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-800">
                      Appointment Confirmed!
                    </h3>
                    <p className="text-green-700">
                      Thank you for confirming your appointment. You will receive a confirmation email shortly.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appointment Details */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Appointment Details
                </CardTitle>
                <Badge className={getStatusColor(appointment.status)}>
                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title and Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {appointment.title}
                </h3>
                {appointment.description && (
                  <p className="text-gray-600">{appointment.description}</p>
                )}
              </div>

              <Separator />

              {/* Appointment Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Date & Time</p>
                    <p className="font-medium">{formatDateTime(appointment.appointmentDate)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Duration</p>
                    <p className="font-medium">{appointment.duration} minutes</p>
                  </div>
                </div>

                {appointment.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium">{appointment.location}</p>
                    </div>
                  </div>
                )}

                {appointment.serviceType && (
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Service Type</p>
                      <p className="font-medium">{appointment.serviceType}</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Customer Information */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Contact Information</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium">{getCustomerName(appointment.customer)}</p>
                  <p className="text-gray-600">{appointment.customer.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {appointment.status === 'scheduled' && !confirmed && (
              <Button 
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1"
                size="lg"
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Appointment
                  </>
                )}
              </Button>
            )}
            
            {appointment.status === 'confirmed' && (
              <Button disabled className="flex-1" size="lg">
                <CheckCircle className="h-4 w-4 mr-2" />
                Already Confirmed
              </Button>
            )}

            <Button 
              variant="outline" 
              onClick={() => window.close()}
              className="flex-1 sm:flex-none"
              size="lg"
            >
              Close
            </Button>
          </div>

          {/* Help Text */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Need to reschedule or have questions? Please contact us directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
