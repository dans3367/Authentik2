"use client"

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Gift, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  birthday: string | null;
}

export default function UpdateProfilePage() {
  const [contact, setContact] = useState<Contact | null>(null);
  const [birthday, setBirthday] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location] = useLocation();

  // Extract token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid link - missing token');
      setLoading(false);
      return;
    }

    fetchContactInfo();
  }, [token]);

  const fetchContactInfo = async () => {
    try {
      const response = await fetch(`/api/profile-form?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load profile information');
      }

      setContact(data.contact);
      if (data.contact.birthday) {
        // Parse date as local to avoid timezone shifts
        const [year, month, day] = data.contact.birthday.split('-').map(Number);
        setBirthday(new Date(year, month - 1, day));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!birthday) {
      setError('Please select your birthday');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formattedBirthday = format(birthday, 'yyyy-MM-dd');
      
      const response = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          birthday: formattedBirthday,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update birthday');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update birthday');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !contact) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-red-500 text-4xl mb-4">⚠️</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid Link</h2>
              <p className="text-gray-600">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">🎉 Birthday Added!</h2>
              <p className="text-gray-600 mb-4">
                Thank you for adding your birthday! You'll now receive special offers and birthday surprises.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>Your birthday:</strong> {birthday && format(birthday, 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🎂</div>
            <h1 className="text-2xl font-bold text-gray-900">Add Your Birthday</h1>
            <p className="text-gray-600 mt-2">
              Help us celebrate your special day with exclusive offers and surprises!
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-500" />
                Birthday Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact && (
                <div className="mb-6">
                  <p className="text-sm text-gray-600">
                    Hi {contact.firstName ? `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''}` : contact.email}!
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    We'd love to send you special birthday offers and promotions.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="birthday">Your Birthday</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !birthday && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {birthday ? format(birthday, "PPP") : "Select your birthday"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={birthday}
                        onSelect={setBirthday}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">What you'll receive:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>🎁 Exclusive birthday discounts</li>
                    <li>🎉 Special birthday promotions</li>
                    <li>📧 Personalized birthday messages</li>
                    <li>🌟 Early access to birthday-themed content</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
                  disabled={submitting || !birthday}
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding Birthday...
                    </>
                  ) : (
                    <>
                      🎂 Add My Birthday
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-4 text-xs text-gray-500 text-center">
                <p>Your privacy is important to us. We'll only use your birthday to send you special offers and birthday wishes.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

