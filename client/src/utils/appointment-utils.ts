// Customer interface for appointment utilities
export interface Customer {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  phoneNumber?: string | null;
}

// Minimal assignable-user shape used for provider dropdowns
export interface AppointmentProvider {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  isActive?: boolean | null;
}

// Appointment interface for utilities (matches API response with null values)
export interface Appointment {
  id: string;
  tenantId?: string;
  userId?: string;
  providerId?: string | null;
  customerId: string;
  title: string;
  description?: string | null;
  appointmentDate: Date;
  duration: number;
  location?: string | null;
  serviceType?: string | null;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | string;
  notes?: string | null;
  reminderSent?: boolean | null;
  reminderSentAt?: Date | null;
  confirmationReceived?: boolean | null;
  confirmationReceivedAt?: Date | null;
  statusChangedBy?: string | null;
  confirmationToken?: string | null;
  declineReason?: string | null;
  reminderSettings?: string | null;
  recurrenceFrequency?: 'none' | 'daily' | 'weekly' | 'monthly' | string | null;
  recurrenceInterval?: number | null;
  recurrenceCount?: number | null;
  recurrenceEndDate?: Date | null;
  recurrenceSeriesId?: string | null;
  recurrenceParentId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Appointment reminder interface
export interface AppointmentReminder {
  id: string;
  appointmentId: string;
  reminderType: 'email' | 'sms' | 'push';
  reminderTiming: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom';
  customMinutesBefore?: number;
  scheduledFor: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  content?: string;
  errorMessage?: string;
  timezone?: string;
}

// Timing map for reminder calculations
export const TIMING_MAP: Record<string, number> = {
  '5m': 5,
  '30m': 30,
  '1h': 60,
  '5h': 300,
  '10h': 600,
};

// Appointment with customer and shop relation
export interface AppointmentWithCustomer extends Appointment {
  customer?: Customer;
  provider?: AppointmentProvider | null;
  shop?: { id: string; name: string } | null;
}

export interface AppointmentOverlapConflict {
  requestedStart: Date | string;
  requestedEnd: Date | string;
  conflictingAppointmentId: string;
  conflictingTitle: string;
  conflictingStart: Date | string;
  conflictingEnd: Date | string;
  conflictingDuration: number;
  conflictingStatus: string;
  conflictingCustomerName: string;
  conflictingCustomerEmail?: string | null;
  providerId?: string | null;
  providerName?: string | null;
}

export interface AppointmentOverlapErrorData {
  code: "APPOINTMENT_OVERLAP";
  message: string;
  conflicts: AppointmentOverlapConflict[];
}

export function isAppointmentOverlapError(
  error: unknown
): error is Error & { status: number; data: AppointmentOverlapErrorData } {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as {
    status?: unknown;
    data?: { code?: unknown; conflicts?: unknown };
  };
  return (
    maybeError.status === 409 &&
    maybeError.data?.code === "APPOINTMENT_OVERLAP" &&
    Array.isArray(maybeError.data?.conflicts)
  );
}

// Filter appointments that are upcoming (after current date)
export function filterUpcomingAppointments(
  appointments: AppointmentWithCustomer[],
  now: Date = new Date()
): AppointmentWithCustomer[] {
  return appointments.filter(a => new Date(a.appointmentDate) >= now);
}

// Filter appointments that are in the past (before current date)
export function filterPastAppointments(
  appointments: AppointmentWithCustomer[],
  now: Date = new Date()
): AppointmentWithCustomer[] {
  return appointments.filter(a => new Date(a.appointmentDate) < now);
}

// Sort appointments by date
export function sortAppointmentsByDate(
  appointments: AppointmentWithCustomer[],
  direction: 'asc' | 'desc' = 'asc'
): AppointmentWithCustomer[] {
  return [...appointments].sort((a, b) => {
    const comparison = new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime();
    return direction === 'asc' ? comparison : -comparison;
  });
}

// Get customer name for display
export function getCustomerName(customer?: Customer): string {
  if (!customer) return 'Unknown Customer';
  if (customer.firstName && customer.lastName) {
    return `${customer.firstName} ${customer.lastName}`;
  } else if (customer.firstName) {
    return customer.firstName;
  } else if (customer.lastName) {
    return customer.lastName;
  }
  return customer.email;
}

// Get customer name for sorting (returns empty string if no customer)
export function getCustomerNameForSort(customer?: Customer): string {
  if (!customer) return '';
  return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
}

// Get status badge color classes
export function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled': return 'bg-blue-100 text-blue-800';
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'completed': return 'bg-gray-100 text-gray-800';
    case 'no_show': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

// Format date and time for display
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(date));
}

// Convert date to local date-time string for input fields
export function toLocalDateTimeString(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Convert date to local date string (YYYY-MM-DD)
export function toLocalDateString(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Convert date to local time string (HH:MM)
export function toLocalTimeString(date: Date): string {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Merge date and time parts into a single Date object
export function mergeDateAndTime(current: Date, nextDate?: string, nextTime?: string): Date {
  const datePart = nextDate ?? toLocalDateString(current);
  const timePart = nextTime ?? toLocalTimeString(current);
  const merged = new Date(`${datePart}T${timePart}`);
  // Return current date if the merged result is invalid (e.g., partial time input)
  return isNaN(merged.getTime()) ? current : merged;
}

// Calculate pagination values
export interface PaginationResult {
  totalPages: number;
  startIndex: number;
  endIndex: number;
  currentItems: number;
}

export function calculatePagination(
  totalItems: number,
  currentPage: number,
  pageSize: number
): PaginationResult {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const currentItems = endIndex - startIndex;

  return {
    totalPages,
    startIndex,
    endIndex,
    currentItems,
  };
}

// Sort column type
export type SortColumn = 'customer' | 'title' | 'date' | 'status';
export type SortDirection = 'asc' | 'desc';

// Sort appointments by column
export function sortAppointments(
  appointments: AppointmentWithCustomer[],
  column: SortColumn,
  direction: SortDirection
): AppointmentWithCustomer[] {
  return [...appointments].sort((a, b) => {
    let comparison = 0;
    switch (column) {
      case 'customer': {
        const nameA = getCustomerNameForSort(a.customer);
        const nameB = getCustomerNameForSort(b.customer);
        comparison = nameA.localeCompare(nameB);
        break;
      }
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      case 'date':
        comparison = new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime();
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
    }
    return direction === 'asc' ? comparison : -comparison;
  });
}

// Filter appointments by search query
export function filterAppointmentsBySearch(
  appointments: AppointmentWithCustomer[],
  searchQuery: string
): AppointmentWithCustomer[] {
  if (!searchQuery) return appointments;

  const searchLower = searchQuery.toLowerCase();
  return appointments.filter(appointment => {
    const customerName = getCustomerNameForSort(appointment.customer).toLowerCase();
    const customerEmail = (appointment.customer?.email || '').toLowerCase();
    const title = (appointment.title || '').toLowerCase();
    const location = (appointment.location || '').toLowerCase();
    return customerName.includes(searchLower) ||
      customerEmail.includes(searchLower) ||
      title.includes(searchLower) ||
      location.includes(searchLower);
  });
}

// Filter appointments by status
export function filterAppointmentsByStatus(
  appointments: AppointmentWithCustomer[],
  status: string
): AppointmentWithCustomer[] {
  if (status === 'all') return appointments;
  return appointments.filter(appointment => appointment.status === status);
}

// Filter appointments by date range
export function filterAppointmentsByDateRange(
  appointments: AppointmentWithCustomer[],
  dateFrom?: Date,
  dateTo?: Date
): AppointmentWithCustomer[] {
  return appointments.filter(appointment => {
    const appointmentDate = new Date(appointment.appointmentDate);
    if (dateFrom && appointmentDate < dateFrom) {
      return false;
    }
    if (dateTo && appointmentDate > dateTo) {
      return false;
    }
    return true;
  });
}

// Combined filter function for appointments
export interface AppointmentFilters {
  searchQuery?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function filterAppointments(
  appointments: AppointmentWithCustomer[],
  filters: AppointmentFilters
): AppointmentWithCustomer[] {
  let filtered = appointments;

  if (filters.status && filters.status !== 'all') {
    filtered = filterAppointmentsByStatus(filtered, filters.status);
  }

  if (filters.dateFrom || filters.dateTo) {
    filtered = filterAppointmentsByDateRange(filtered, filters.dateFrom, filters.dateTo);
  }

  if (filters.searchQuery) {
    filtered = filterAppointmentsBySearch(filtered, filters.searchQuery);
  }

  return filtered;
}

// Compute scheduled time for reminder based on timing
export function computeScheduledFor(
  appointmentDate: Date,
  timing: '5m' | '30m' | '1h' | '5h' | '10h' | 'custom',
  customMinutesBefore?: number
): Date {
  const baseDate = new Date(appointmentDate);
  switch (timing) {
    case '5m':
      return new Date(baseDate.getTime() - 5 * 60 * 1000);
    case '30m':
      return new Date(baseDate.getTime() - 30 * 60 * 1000);
    case '1h':
      return new Date(baseDate.getTime() - 1 * 60 * 60 * 1000);
    case '5h':
      return new Date(baseDate.getTime() - 5 * 60 * 60 * 1000);
    case '10h':
      return new Date(baseDate.getTime() - 10 * 60 * 60 * 1000);
    case 'custom':
      if (customMinutesBefore) {
        return new Date(baseDate.getTime() - customMinutesBefore * 60 * 1000);
      }
      return new Date(baseDate.getTime() - 1 * 60 * 60 * 1000); // Default to 1h for custom if no minutes specified
    default:
      return new Date(baseDate.getTime() - 1 * 60 * 60 * 1000); // Default to 1h
  }
}

// Check if appointment has sent reminder
export function hasAppointmentSentReminder(
  appointment: AppointmentWithCustomer,
  reminders: AppointmentReminder[]
): boolean {
  const appointmentReminders = reminders.filter(r => r.appointmentId === appointment.id);
  return appointmentReminders.some(r => r.status === 'sent') || !!appointment.reminderSent;
}

// Check if appointment has pending reminder
export function hasAppointmentPendingReminder(
  appointment: AppointmentWithCustomer,
  reminders: AppointmentReminder[]
): boolean {
  const appointmentReminders = reminders.filter(r => r.appointmentId === appointment.id);
  return appointmentReminders.some(r => r.status === 'pending');
}

// Get reminders for a specific appointment
export function getAppointmentReminders(
  appointmentId: string,
  reminders: AppointmentReminder[]
): AppointmentReminder[] {
  return reminders.filter(r => r.appointmentId === appointmentId);
}

// Timezone options for reminder scheduling
export const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "🇺🇸 Eastern Time (ET)" },
  { value: "America/Chicago", label: "🇺🇸 Central Time (CT)" },
  { value: "America/Denver", label: "🇺🇸 Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "🇺🇸 Pacific Time (PT)" },
  { value: "America/Anchorage", label: "🇺🇸 Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "🇺🇸 Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "🇺🇸 Arizona (MST)" },
  { value: "America/Toronto", label: "🇨🇦 Toronto (ET)" },
  { value: "America/Vancouver", label: "🇨🇦 Vancouver (PT)" },
  { value: "America/Mexico_City", label: "🇲🇽 Mexico City (CST)" },
  { value: "Europe/London", label: "🇬🇧 London (GMT/BST)" },
  { value: "Europe/Paris", label: "🇫🇷 Paris (CET)" },
  { value: "Europe/Berlin", label: "🇩🇪 Berlin (CET)" },
  { value: "Europe/Madrid", label: "🇪🇸 Madrid (CET)" },
  { value: "Asia/Tokyo", label: "🇯🇵 Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "🇨🇳 Shanghai (CST)" },
  { value: "Asia/Singapore", label: "🇸🇬 Singapore (SGT)" },
  { value: "Asia/Dubai", label: "🇦🇪 Dubai (GST)" },
  { value: "Australia/Sydney", label: "🇦🇺 Sydney (AEST)" },
  { value: "Australia/Perth", label: "🇦🇺 Perth (AWST)" },
  { value: "Pacific/Auckland", label: "🇳🇿 Auckland (NZST)" },
  { value: "UTC", label: "🌐 UTC" },
];

export function downloadAppointmentIcs(appointment: AppointmentWithCustomer) {
  const start = new Date(appointment.appointmentDate);
  const end = new Date(start.getTime() + (appointment.duration ?? 60) * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const escape = (s: string) => s.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Authentik//Appointments//EN',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@authentik`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escape(appointment.title)}`,
    appointment.location ? `LOCATION:${escape(appointment.location)}` : '',
    appointment.description ? `DESCRIPTION:${escape(appointment.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([lines], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `appointment-${appointment.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
