import { useMemo, useState } from "react";
import { format, isToday, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, subDays, isSameDay, isSameMonth } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Search, Filter, TrendingUp, ArrowRight, Download, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AppointmentWithCustomer,
  getCustomerName,
  getCustomerNameForSort,
} from "@/utils/appointment-utils";

const AVATAR_PALETTE = [
  "bg-sky-200 text-sky-900",
  "bg-pink-200 text-pink-900",
  "bg-emerald-200 text-emerald-900",
  "bg-teal-200 text-teal-900",
  "bg-amber-200 text-amber-900",
  "bg-violet-200 text-violet-900",
  "bg-rose-200 text-rose-900",
  "bg-indigo-200 text-indigo-900",
];

function hashString(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type TabKey = "all" | "today" | "scheduled" | "confirmed" | "reminders";

const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-rose-500",
  confirmed: "bg-emerald-500",
  cancelled: "bg-slate-400",
  completed: "bg-emerald-500",
  no_show: "bg-amber-500",
  in_progress: "bg-emerald-500",
};

const STATUS_PILL: Record<string, string> = {
  scheduled: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  confirmed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  no_show: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  in_progress: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

interface AppointmentsWeekBoardProps {
  appointments: AppointmentWithCustomer[];
  onViewAppointment: (appointment: AppointmentWithCustomer) => void;
  onExportCsv?: () => void;
  onManageTemplates?: () => void;
  onViewCalendar?: () => void;
}

export function AppointmentsWeekBoard({
  appointments,
  onViewAppointment,
  onExportCsv,
  onManageTemplates,
  onViewCalendar,
}: AppointmentsWeekBoardProps) {
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(8);

  const now = useMemo(() => new Date(), [appointments]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    keys.add(format(now, "yyyy-MM"));
    for (const a of appointments) {
      const d = new Date(a.appointmentDate);
      if (!isNaN(d.getTime())) keys.add(format(d, "yyyy-MM"));
    }
    return Array.from(keys)
      .sort((a, b) => (a < b ? 1 : -1))
      .map(key => {
        const [year, month] = key.split("-").map(Number);
        const date = new Date(year, month - 1, 1);
        return { value: key, label: format(date, "MMMM yyyy"), date };
      });
  }, [appointments, now]);

  const selectedMonthDate = useMemo(() => {
    const match = monthOptions.find(m => m.value === selectedMonth);
    return match?.date ?? startOfMonth(now);
  }, [monthOptions, selectedMonth, now]);

  const totalThisMonth = useMemo(() => {
    const s = startOfMonth(now);
    const e = endOfMonth(now);
    return appointments.filter(a => {
      const d = new Date(a.appointmentDate);
      return d >= s && d <= e;
    }).length;
  }, [appointments, now]);

  const totalLastMonth = useMemo(() => {
    const lastMonth = subMonths(now, 1);
    const s = startOfMonth(lastMonth);
    const e = endOfMonth(lastMonth);
    return appointments.filter(a => {
      const d = new Date(a.appointmentDate);
      return d >= s && d <= e;
    }).length;
  }, [appointments, now]);

  const pctDelta = totalLastMonth > 0
    ? Math.round(((totalThisMonth - totalLastMonth) / totalLastMonth) * 100)
    : null;

  const monthAppointments = useMemo(() => {
    const monthStart = startOfMonth(selectedMonthDate);
    const monthEnd = endOfMonth(selectedMonthDate);
    return appointments
      .filter(a => {
        const d = new Date(a.appointmentDate);
        return d >= monthStart && d <= monthEnd;
      })
      .sort(
        (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
      );
  }, [appointments, selectedMonthDate]);

  const upcomingCount = useMemo(
    () =>
      monthAppointments.filter(a => {
        const d = new Date(a.appointmentDate);
        return d >= startOfDay(now);
      }).length,
    [monthAppointments, now]
  );
  const todayCount = useMemo(
    () => monthAppointments.filter(a => isToday(new Date(a.appointmentDate))).length,
    [monthAppointments]
  );
  const scheduledCount = useMemo(
    () => monthAppointments.filter(a => a.status === "scheduled").length,
    [monthAppointments]
  );
  const confirmedCount = useMemo(
    () => monthAppointments.filter(a => a.status === "confirmed").length,
    [monthAppointments]
  );
  const remindersCount = useMemo(
    () => monthAppointments.filter(a => a.reminderSent).length,
    [monthAppointments]
  );

  const last7Days = useMemo(() => {
    const days: { label: string; date: Date; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(now, i);
      const count = appointments.filter(a => isSameDay(new Date(a.appointmentDate), d)).length;
      days.push({ label: format(d, "EEE"), date: d, count });
    }
    return days;
  }, [appointments, now]);

  const avgLast7 = last7Days.length > 0
    ? last7Days.reduce((sum, d) => sum + d.count, 0) / last7Days.length
    : 0;

  const filterItems: { key: TabKey; label: string; count: number; dotClass: string }[] = [
    { key: "all", label: "Upcoming", count: upcomingCount, dotClass: "bg-rose-500" },
    { key: "today", label: "Today", count: todayCount, dotClass: "bg-slate-400" },
    { key: "confirmed", label: "Confirmed", count: confirmedCount, dotClass: "bg-emerald-500" },
    { key: "reminders", label: "Reminders sent", count: remindersCount, dotClass: "bg-rose-500" },
  ];

  const tabCounts: Record<TabKey, number> = {
    all: monthAppointments.length,
    today: todayCount,
    scheduled: scheduledCount,
    confirmed: confirmedCount,
    reminders: remindersCount,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthAppointments.filter(a => {
      if (tab === "today" && !isToday(new Date(a.appointmentDate))) return false;
      if (tab === "scheduled" && a.status !== "scheduled") return false;
      if (tab === "confirmed" && a.status !== "confirmed") return false;
      if (tab === "reminders" && !a.reminderSent) return false;
      if (!q) return true;
      return (
        getCustomerNameForSort(a.customer).toLowerCase().includes(q) ||
        (a.customer?.email || "").toLowerCase().includes(q) ||
        (a.title || "").toLowerCase().includes(q) ||
        (a.serviceType || "").toLowerCase().includes(q)
      );
    });
  }, [monthAppointments, tab, search]);

  const visible = filtered.slice(0, pageSize);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* LEFT: Stats sidebar */}
      <Card className="shadow-sm">
        <CardContent className="p-6 flex flex-col gap-6">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-slate-500 dark:text-slate-400">
              Total Appointments
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {totalThisMonth}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">this month</span>
            </div>
            {pctDelta !== null && (
              <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                {pctDelta >= 0 ? `+${pctDelta}` : pctDelta}% vs. last month
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 -mx-2">
            {filterItems.map(item => {
              const active =
                (item.key === "all" && tab === "all") ||
                (item.key === "today" && tab === "today") ||
                (item.key === "confirmed" && tab === "confirmed") ||
                (item.key === "reminders" && tab === "reminders");
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-rose-50 dark:bg-rose-950/30 text-slate-900 dark:text-slate-100"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${item.dotClass}`} />
                    {item.label}
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-slate-500 dark:text-slate-400 mb-2">
              All Appointments
            </p>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full h-9 rounded-lg">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                    {isSameMonth(m.date, now) ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-slate-500 dark:text-slate-400">
                Bookings · Last 7 Days
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                avg {avgLast7.toFixed(1)}
              </span>
            </div>
            <MiniLineChart data={last7Days.map(d => d.count)} />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
              {last7Days.map((d, i) => (
                <span key={i}>{d.label}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RIGHT: Main table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Appointments list
              </h2>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-900 dark:bg-slate-100 px-1.5 text-[11px] font-medium text-white dark:text-slate-900 tabular-nums">
                {monthAppointments.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search patients or types..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 w-56 rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
              </div>
              <Button variant="outline" size="sm" className="h-9 rounded-lg">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1 px-5 py-3 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
            <TabPill active={tab === "all"} onClick={() => setTab("all")} count={tabCounts.all}>
              All
            </TabPill>
            <TabPill active={tab === "today"} onClick={() => setTab("today")} count={tabCounts.today}>
              Today
            </TabPill>
            <TabPill
              active={tab === "scheduled"}
              onClick={() => setTab("scheduled")}
              count={tabCounts.scheduled}
            >
              Scheduled
            </TabPill>
            <TabPill
              active={tab === "confirmed"}
              onClick={() => setTab("confirmed")}
              count={tabCounts.confirmed}
            >
              Confirmed
            </TabPill>
            <TabPill
              active={tab === "reminders"}
              onClick={() => setTab("reminders")}
              count={tabCounts.reminders}
            >
              Reminders
            </TabPill>
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No appointments match this view.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    Patient
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    When
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    Type
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(apt => {
                  const name = getCustomerName(apt.customer);
                  const initials = getInitials(name);
                  const avatarClass = AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length];
                  const aptDate = new Date(apt.appointmentDate);
                  const dotClass = STATUS_DOT[apt.status] || "bg-slate-400";
                  const pillClass = STATUS_PILL[apt.status] || "bg-slate-100 text-slate-600";

                  return (
                    <TableRow
                      key={apt.id}
                      onClick={() => onViewAppointment(apt)}
                      className="cursor-pointer border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold ${avatarClass}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {apt.customer?.email || name}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                            {format(aptDate, "h:mm a")}
                          </span>
                          {isToday(aptDate) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[10px] font-medium">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {format(aptDate, "MMM d")}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-700 dark:text-slate-300">
                        {apt.serviceType || apt.title}
                      </TableCell>
                      <TableCell className="py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${pillClass}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                          {apt.status.replace("_", " ")}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-800 text-sm">
            <div className="text-slate-500 dark:text-slate-400">
              Showing <span className="font-medium text-slate-700 dark:text-slate-300">{visible.length}</span>{" "}
              of <span className="font-medium text-slate-700 dark:text-slate-300">{filtered.length}</span>
              {filtered.length > pageSize && (
                <button
                  type="button"
                  onClick={() => setPageSize(p => p + 8)}
                  className="ml-3 text-slate-900 dark:text-slate-100 hover:underline"
                >
                  Show more
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              {onExportCsv && (
                <button
                  type="button"
                  onClick={onExportCsv}
                  className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              )}
              {onManageTemplates && (
                <button
                  type="button"
                  onClick={onManageTemplates}
                  className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Manage templates
                </button>
              )}
              {onViewCalendar && (
                <button
                  type="button"
                  onClick={onViewCalendar}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100 hover:underline"
                >
                  View full calendar
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TabPill({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      {children}
      <span
        className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-md px-1.5 text-[11px] tabular-nums ${
          active
            ? "bg-white/15 text-white dark:bg-slate-900/15 dark:text-slate-900"
            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function MiniLineChart({ data }: { data: number[] }) {
  const width = 232;
  const height = 56;
  const max = Math.max(1, ...data);
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * (height - 8) - 4;
    return [x, y] as [number, number];
  });
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id="miniChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(190 24 93)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(190 24 93)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#miniChartFill)" />
      <path
        d={linePath}
        fill="none"
        stroke="rgb(190 24 93)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default AppointmentsWeekBoard;
