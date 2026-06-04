import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Loader2, Clock, ArrowLeft, CalendarX, CalendarPlus, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BookableSlot {
  startUtc: string;
  endUtc: string;
  label: string;
}
interface SlotsByDate {
  date: string;
  slots: BookableSlot[];
}
interface Branding {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
}
interface BookingData {
  provider: { name: string };
  branding: Branding;
  rules: { timezone: string; slotLengthMinutes: number };
  slotsByDate: SlotsByDate[];
}
interface BookingResult {
  id: string;
  startUtc: string;
  durationMinutes: number;
  providerName: string;
}

const visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function formatDateHeader(localDate: string): string {
  // localDate is the provider-local YYYY-MM-DD; render it as a friendly day label.
  return new Date(`${localDate}T00:00:00`).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
function formatSlotFull(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Calendar helpers ────────────────────────────────────────────────────────
interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
}
function compactUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
function escapeIcs(s: string): string {
  return s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
}
function downloadIcs(ev: CalendarEvent) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Authentik//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${ev.uid}@authentik`,
    `DTSTAMP:${compactUtc(new Date())}`,
    `DTSTART:${compactUtc(ev.start)}`,
    `DTEND:${compactUtc(ev.end)}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
    ev.description ? `DESCRIPTION:${escapeIcs(ev.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const blob = new Blob([lines], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appointment-${ev.uid}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${compactUtc(ev.start)}/${compactUtc(ev.end)}`,
  });
  if (ev.description) params.set("details", ev.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function outlookCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    startdt: ev.start.toISOString(),
    enddt: ev.end.toISOString(),
  });
  if (ev.description) params.set("body", ev.description);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export default function PublicBookingPage() {
  const [, params] = useRoute("/book/:slug");
  const slug = params?.slug;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BookingData | null>(null);

  const [selected, setSelected] = useState<BookableSlot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookingResult | null>(null);

  const loadSlots = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/public/booking/${slug}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load this booking page.");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const accent = data?.branding.primaryColor || "#3B82F6";

  const handleSubmit = async () => {
    if (!slug || !selected) return;
    setSubmitError(null);
    if (!name.trim() || !email.trim()) {
      setSubmitError("Please enter your name and email.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/public/booking/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startUtc: selected.startUtc, name, email, note: note || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setSuccess(body.appointment as BookingResult);
        return;
      }
      if (res.status === 409) {
        setSubmitError(body.message || "That time was just taken. Please pick another.");
        setSelected(null);
        await loadSlots();
        return;
      }
      setSubmitError(body.message || "Could not complete your booking.");
    } catch {
      setSubmitError("Could not complete your booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Centered>
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Loading availability…</p>
      </Centered>
    );
  }
  if (notFound) {
    return (
      <Centered>
        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking page unavailable</h2>
        <p className="text-gray-600">This link is invalid or no longer accepting bookings.</p>
      </Centered>
    );
  }
  if (error || !data) {
    return (
      <Centered>
        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-6">{error || "Please try again later."}</p>
        <Button variant="outline" onClick={loadSlots}>Retry</Button>
      </Centered>
    );
  }

  if (success) {
    const start = new Date(success.startUtc);
    const event: CalendarEvent = {
      uid: success.id,
      title: `Appointment with ${success.providerName}`,
      description: note.trim() || undefined,
      start,
      end: new Date(start.getTime() + success.durationMinutes * 60_000),
    };
    return (
      <Shell branding={data.branding}>
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: accent }} />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">You're booked!</h2>
            <p className="text-gray-600">
              {formatSlotFull(success.startUtc)} ({success.durationMinutes} min) with {success.providerName}.
            </p>
            <p className="text-sm text-gray-500 mt-2">Times shown in your timezone ({visitorTz}).</p>

            <div className="mt-6 flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" style={{ borderColor: accent, color: accent }}>
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Add to calendar
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-64">
                  <DropdownMenuItem onClick={() => window.open(googleCalendarUrl(event), "_blank", "noopener")}>
                    Google Calendar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(outlookCalendarUrl(event), "_blank", "noopener")}>
                    Outlook.com
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => downloadIcs(event)}>
                    Apple Calendar / iPhone (.ics)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadIcs(event)}>
                    Windows Calendar / Outlook (.ics)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadIcs(event)}>
                    Download .ics file
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const hasSlots = data.slotsByDate.length > 0;

  return (
    <Shell branding={data.branding}>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Book with {data.provider.name}</h1>
        <p className="text-gray-600 mt-1">
          Times shown in your timezone ({visitorTz}); provider is in {data.rules.timezone}.
        </p>
      </div>

      {submitError && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {submitError}
        </div>
      )}

      {/* Step 2: details form for the selected slot */}
      {selected ? (
        <Card>
          <CardContent className="p-6">
            <button
              onClick={() => setSelected(null)}
              className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to times
            </button>
            <div className="mb-4 flex items-center gap-2 font-medium text-gray-900">
              <Clock className="h-4 w-4" style={{ color: accent }} />
              {formatSlotFull(selected.startUtc)}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-sm">Your name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-sm">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-sm">Note (optional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
              </div>
              <Button
                className="mt-2 text-white"
                style={{ backgroundColor: accent }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Booking…</>
                ) : (
                  <><CheckCircle className="h-4 w-4 mr-2" />Confirm booking</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Step 1: pick a slot
        <Card>
          <CardContent className="p-6">
            {!hasSlots ? (
              <div className="py-8 text-center text-gray-600">
                <CalendarX className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                No open times right now. Please check back later.
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {data.slotsByDate.map((day) => (
                  <div key={day.date}>
                    <h3 className="mb-3 font-semibold text-gray-900">{formatDateHeader(day.date)}</h3>
                    <div className="flex flex-wrap gap-2">
                      {day.slots.map((slot) => (
                        <Button
                          key={slot.startUtc}
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelected(slot); setSubmitError(null); }}
                          style={{ borderColor: accent, color: accent }}
                        >
                          {formatSlotTime(slot.startUtc)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </Shell>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">{children}</CardContent>
      </Card>
    </div>
  );
}

function Shell({ branding, children }: { branding: Branding; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-xl mx-auto">
          <div className="mb-6 flex flex-col items-center">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.companyName} className="h-24 object-contain mb-2" />
            ) : (
              <div className="text-lg font-semibold text-gray-900 mb-2">{branding.companyName}</div>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
