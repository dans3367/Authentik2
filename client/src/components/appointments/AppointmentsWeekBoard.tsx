import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Plus,
  TrendingUp,
  ArrowRight,
  Download,
  FileText,
  List as ListIcon,
} from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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

type SidebarFilterKey = "upcoming" | "today" | "confirmed" | "notConfirmed" | "reminders" | "remindersNotSent";
type ListTabKey = "all" | "selected";
type BoardViewMode = "list" | "calendar" | "week";

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

const STATUS_CALENDAR_CHIP: Record<string, string> = {
  scheduled: "border-l-rose-500 bg-rose-50/80 text-rose-950 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-100 dark:hover:bg-rose-950/50",
  confirmed: "border-l-emerald-500 bg-emerald-50/80 text-emerald-950 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50",
  cancelled: "border-l-slate-400 bg-slate-100/80 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800",
  completed: "border-l-emerald-500 bg-emerald-50/80 text-emerald-950 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50",
  no_show: "border-l-amber-500 bg-amber-50/80 text-amber-950 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50",
  in_progress: "border-l-emerald-500 bg-emerald-50/80 text-emerald-950 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50",
};

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

// Collapsed state persists across visits so the board stays minified if the user left it that way.
const COLLAPSE_KEY = "appointments-board-collapsed";

interface AppointmentsWeekBoardProps {
  appointments: AppointmentWithCustomer[];
  onViewAppointment: (appointment: AppointmentWithCustomer) => void;
  onAddAppointment?: (date: Date) => void;
  onExportCsv?: () => void;
  onManageTemplates?: () => void;
  onViewCalendar?: () => void;
}

export function AppointmentsWeekBoard({
  appointments,
  onViewAppointment,
  onAddAppointment,
  onExportCsv,
  onManageTemplates,
  onViewCalendar,
}: AppointmentsWeekBoardProps) {
  const { t, i18n } = useTranslation();
  // date-fns formats weekday/month names in English by default; map the active
  // i18n language to a date-fns locale so the calendar reads in that language.
  const dfLocale = i18n.language?.toLowerCase().startsWith("es") ? es : undefined;
  const [selectedFilter, setSelectedFilter] = useState<SidebarFilterKey>("upcoming");
  const [listTab, setListTab] = useState<ListTabKey>("selected");
  const [viewMode, setViewMode] = useState<BoardViewMode>("list");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(8);
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);

  // Minified view — hides the list/calendar/week body, leaving the header + stats bar.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(COLLAPSE_KEY) === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSE_KEY, String(collapsed)); } catch {}
  }, [collapsed]);

  const now = useMemo(() => new Date(), [appointments]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(() => new Date());
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(() => new Date());

  const providerOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    let hasUnassigned = false;
    for (const a of appointments) {
      if (a.provider?.id) {
        const name = a.provider.name || a.provider.email || t('reminders.board.unnamedProvider');
        if (!map.has(a.provider.id)) map.set(a.provider.id, { id: a.provider.id, name });
      } else {
        hasUnassigned = true;
      }
    }
    const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    return { list, hasUnassigned };
  }, [appointments]);

  const scopedAppointments = useMemo(() => {
    if (selectedProviderIds.length === 0) return appointments;
    const set = new Set(selectedProviderIds);
    const includeUnassigned = set.has("unassigned");
    return appointments.filter(a =>
      a.providerId ? set.has(a.providerId) : includeUnassigned
    );
  }, [appointments, selectedProviderIds]);

  const isProviderFiltered = selectedProviderIds.length > 0;

  const toggleProvider = (id: string) => {
    setSelectedProviderIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    keys.add(format(now, "yyyy-MM"));
    keys.add(selectedMonth);
    for (const a of appointments) {
      const d = new Date(a.appointmentDate);
      if (!isNaN(d.getTime())) keys.add(format(d, "yyyy-MM"));
    }
    return Array.from(keys)
      .sort((a, b) => (a < b ? 1 : -1))
      .map(key => {
        const [year, month] = key.split("-").map(Number);
        const date = new Date(year, month - 1, 1);
        return { value: key, label: format(date, "MMMM yyyy", { locale: dfLocale }), date };
      });
  }, [appointments, now, selectedMonth, dfLocale]);

  const selectedMonthDate = useMemo(() => {
    const match = monthOptions.find(m => m.value === selectedMonth);
    return match?.date ?? startOfMonth(now);
  }, [monthOptions, selectedMonth, now]);

  const isCurrentMonth = useMemo(
    () => isSameMonth(selectedMonthDate, now),
    [selectedMonthDate, now]
  );

  const effectiveListTab = isCurrentMonth ? listTab : "all";

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);

    const [year, month] = value.split("-").map(Number);
    const nextMonthDate = new Date(year, month - 1, 1);
    if (!isSameMonth(nextMonthDate, now)) {
      setListTab("all");
    }
  };

  const shiftSelectedMonth = (monthDelta: number) => {
    handleMonthChange(format(addMonths(selectedMonthDate, monthDelta), "yyyy-MM"));
  };

  useEffect(() => {
    if (!isCurrentMonth && listTab !== "all") setListTab("all");
  }, [isCurrentMonth, listTab]);

  // When the displayed month changes, reset the selected day to a sensible
  // default — unless the change was driven by the day stepper crossing a month
  // boundary, in which case the stepped day is kept (guard below).
  const skipDayResetRef = useRef(false);
  const selectedDaySectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (skipDayResetRef.current) {
      skipDayResetRef.current = false;
      return;
    }
    setSelectedCalendarDate(isCurrentMonth ? now : selectedMonthDate);
  }, [isCurrentMonth, now, selectedMonthDate]);

  const totalThisMonth = useMemo(() => {
    const s = startOfMonth(now);
    const e = endOfMonth(now);
    return scopedAppointments.filter(a => {
      const d = new Date(a.appointmentDate);
      return d >= s && d <= e;
    }).length;
  }, [scopedAppointments, now]);

  const totalLastMonth = useMemo(() => {
    const lastMonth = subMonths(now, 1);
    const s = startOfMonth(lastMonth);
    const e = endOfMonth(lastMonth);
    return scopedAppointments.filter(a => {
      const d = new Date(a.appointmentDate);
      return d >= s && d <= e;
    }).length;
  }, [scopedAppointments, now]);

  const pctDelta = totalLastMonth > 0
    ? Math.round(((totalThisMonth - totalLastMonth) / totalLastMonth) * 100)
    : null;

  const monthAppointments = useMemo(() => {
    const monthStart = startOfMonth(selectedMonthDate);
    const monthEnd = endOfMonth(selectedMonthDate);
    return scopedAppointments
      .filter(a => {
        const d = new Date(a.appointmentDate);
        return d >= monthStart && d <= monthEnd;
      })
      .sort(
        (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
      );
  }, [scopedAppointments, selectedMonthDate]);

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
  const confirmedCount = useMemo(
    () => monthAppointments.filter(a => a.status === "confirmed").length,
    [monthAppointments]
  );
  const notConfirmedCount = useMemo(
    () => monthAppointments.filter(a => a.status !== "confirmed").length,
    [monthAppointments]
  );
  const remindersCount = useMemo(
    () => monthAppointments.filter(a => a.reminderSent).length,
    [monthAppointments]
  );
  const remindersNotSentCount = useMemo(
    () => monthAppointments.filter(a => !a.reminderSent).length,
    [monthAppointments]
  );

  const filterItems: { key: SidebarFilterKey; label: string; count: number; dotClass: string }[] = [
    { key: "upcoming", label: t('reminders.board.stats.upcoming'), count: upcomingCount, dotClass: "bg-rose-500" },
    { key: "today", label: t('reminders.board.stats.today'), count: todayCount, dotClass: "bg-slate-400" },
    { key: "confirmed", label: t('reminders.board.stats.confirmed'), count: confirmedCount, dotClass: "bg-emerald-500" },
    { key: "notConfirmed", label: t('reminders.board.stats.notConfirmed'), count: notConfirmedCount, dotClass: "bg-amber-500" },
    { key: "reminders", label: t('reminders.board.stats.remindersSent'), count: remindersCount, dotClass: "bg-rose-500" },
    { key: "remindersNotSent", label: t('reminders.board.stats.remindersNotSent'), count: remindersNotSentCount, dotClass: "bg-slate-400" },
  ];

  const filterCounts: Record<SidebarFilterKey, number> = {
    upcoming: upcomingCount,
    today: todayCount,
    confirmed: confirmedCount,
    notConfirmed: notConfirmedCount,
    reminders: remindersCount,
    remindersNotSent: remindersNotSentCount,
  };

  const selectedFilterItem = filterItems.find(item => item.key === selectedFilter) ?? filterItems[0];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthAppointments.filter(a => {
      if (effectiveListTab === "selected") {
        const appointmentDate = new Date(a.appointmentDate);
        if (selectedFilter === "upcoming" && appointmentDate < startOfDay(now)) return false;
        if (selectedFilter === "today" && !isToday(appointmentDate)) return false;
        if (selectedFilter === "confirmed" && a.status !== "confirmed") return false;
        if (selectedFilter === "notConfirmed" && a.status === "confirmed") return false;
        if (selectedFilter === "reminders" && !a.reminderSent) return false;
        if (selectedFilter === "remindersNotSent" && a.reminderSent) return false;
      }
      if (!q) return true;
      return (
        getCustomerNameForSort(a.customer).toLowerCase().includes(q) ||
        (a.customer?.email || "").toLowerCase().includes(q) ||
        (a.title || "").toLowerCase().includes(q) ||
        (a.serviceType || "").toLowerCase().includes(q)
      );
    });
  }, [monthAppointments, effectiveListTab, selectedFilter, search, now]);

  const visible = filtered.slice(0, pageSize);
  const calendarDays = useMemo(() => {
    const calendarStart = startOfWeek(startOfMonth(selectedMonthDate), { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(endOfMonth(selectedMonthDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [selectedMonthDate]);

  const weekdayLabels = useMemo(() => {
    const weekStart = startOfWeek(new Date(2024, 0, 7), { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, index) =>
      format(addDays(weekStart, index), "EEE", { locale: dfLocale })
    );
  }, [dfLocale]);

  const weekStart = useMemo(() => startOfWeek(selectedWeekDate, { weekStartsOn: 0 }), [selectedWeekDate]);
  const weekEnd = useMemo(() => endOfWeek(selectedWeekDate, { weekStartsOn: 0 }), [selectedWeekDate]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const weekRangeLabel = useMemo(() => {
    if (isSameMonth(weekStart, weekEnd)) {
      return `${format(weekStart, "MMM d", { locale: dfLocale })} – ${format(weekEnd, "d, yyyy", { locale: dfLocale })}`;
    }
    if (weekStart.getFullYear() === weekEnd.getFullYear()) {
      return `${format(weekStart, "MMM d", { locale: dfLocale })} – ${format(weekEnd, "MMM d, yyyy", { locale: dfLocale })}`;
    }
    return `${format(weekStart, "MMM d, yyyy", { locale: dfLocale })} – ${format(weekEnd, "MMM d, yyyy", { locale: dfLocale })}`;
  }, [weekStart, weekEnd, dfLocale]);

  const weekFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rangeStart = startOfDay(weekStart);
    const rangeEnd = endOfDay(weekEnd);
    return scopedAppointments.filter(a => {
      const d = new Date(a.appointmentDate);
      if (d < rangeStart || d > rangeEnd) return false;
      if (effectiveListTab === "selected") {
        if (selectedFilter === "upcoming" && d < startOfDay(now)) return false;
        if (selectedFilter === "today" && !isToday(d)) return false;
        if (selectedFilter === "confirmed" && a.status !== "confirmed") return false;
        if (selectedFilter === "notConfirmed" && a.status === "confirmed") return false;
        if (selectedFilter === "reminders" && !a.reminderSent) return false;
        if (selectedFilter === "remindersNotSent" && a.reminderSent) return false;
      }
      if (!q) return true;
      return (
        getCustomerNameForSort(a.customer).toLowerCase().includes(q) ||
        (a.customer?.email || "").toLowerCase().includes(q) ||
        (a.title || "").toLowerCase().includes(q) ||
        (a.serviceType || "").toLowerCase().includes(q)
      );
    });
  }, [scopedAppointments, weekStart, weekEnd, effectiveListTab, selectedFilter, search, now]);

  const weekAppointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentWithCustomer[]>();
    for (const appointment of weekFiltered) {
      const key = dayKey(new Date(appointment.appointmentDate));
      const dayAppointments = map.get(key) ?? [];
      dayAppointments.push(appointment);
      map.set(key, dayAppointments);
    }
    for (const dayAppointments of map.values()) {
      dayAppointments.sort(
        (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
      );
    }
    return map;
  }, [weekFiltered]);

  const calendarAppointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentWithCustomer[]>();
    for (const appointment of filtered) {
      const key = dayKey(new Date(appointment.appointmentDate));
      const dayAppointments = map.get(key) ?? [];
      dayAppointments.push(appointment);
      map.set(key, dayAppointments);
    }
    return map;
  }, [filtered]);

  const selectedDayAppointments = useMemo(() => {
    const appointmentsForDay = calendarAppointmentsByDay.get(dayKey(selectedCalendarDate)) ?? [];
    return [...appointmentsForDay].sort(
      (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
    );
  }, [calendarAppointmentsByDay, selectedCalendarDate]);

  const formatAppointmentCount = (count: number) =>
    t(
      count === 1
        ? 'reminders.board.calendar.appointmentSingular'
        : 'reminders.board.calendar.appointmentPlural',
      { count }
    );

  // Select a calendar day and, when it has appointments, bring the Selected-day
  // panel (stacked below the grid) into view so the list is visible without the
  // user manually scrolling down.
  const selectCalendarDay = (day: Date) => {
    setSelectedCalendarDate(day);
    const hasAppointments = (calendarAppointmentsByDay.get(dayKey(day))?.length ?? 0) > 0;
    if (!hasAppointments) return;
    requestAnimationFrame(() => {
      const el = selectedDaySectionRef.current;
      if (!el) return;
      // Only pull it up when it's sitting low/below the fold, so we don't yank
      // the page when the panel is already comfortably on screen.
      if (el.getBoundingClientRect().top > window.innerHeight * 0.5) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const handleCalendarDayKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, day: Date) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCalendarDay(day);
    }
  };

  // Select a day, following it into another month when the stepper crosses a
  // month boundary so the grid and appointment data stay in sync.
  const goToDay = (date: Date) => {
    if (!isSameMonth(date, selectedMonthDate)) {
      skipDayResetRef.current = true;
      handleMonthChange(format(date, "yyyy-MM"));
    }
    setSelectedCalendarDate(date);
  };

  return (
    <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border">
            <div className="flex items-center gap-2">
              {viewMode === "week" ? (
                <CalendarRange className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              ) : viewMode === "calendar" ? (
                <CalendarDays className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              ) : (
                <ListIcon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              )}
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {viewMode === "week"
                  ? t('reminders.board.week.title')
                  : viewMode === "calendar"
                  ? t('reminders.board.calendar.title')
                  : t('reminders.board.appointmentsList')}
              </h2>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-900 dark:bg-slate-100 px-1.5 text-[11px] font-medium text-white dark:text-slate-900 tabular-nums">
                {viewMode === "week"
                  ? weekFiltered.length
                  : viewMode === "calendar"
                  ? filtered.length
                  : monthAppointments.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!collapsed && (
              <>
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger className="h-9 w-[150px] rounded-lg">
                  <SelectValue placeholder={t('reminders.board.selectMonth')} />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                      {isSameMonth(m.date, now) ? t('reminders.board.currentSuffix') : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="inline-flex h-9 items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <ListIcon className="h-3.5 w-3.5" />
                  {t('reminders.board.viewModes.list')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("week")}
                  aria-pressed={viewMode === "week"}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
                    viewMode === "week"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <CalendarRange className="h-3.5 w-3.5" />
                  {t('reminders.board.viewModes.week')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  aria-pressed={viewMode === "calendar"}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
                    viewMode === "calendar"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t('reminders.board.viewModes.calendar')}
                </button>
              </div>
              <div className="relative min-w-[220px] flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('reminders.board.searchPlaceholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 w-full sm:w-56 rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 rounded-lg relative">
                    <Filter className="h-4 w-4 mr-2" />
                    {t('reminders.board.filters')}
                    {isProviderFiltered && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-slate-500 dark:text-slate-400">
                        {t('reminders.board.provider')}
                      </p>
                      {isProviderFiltered && (
                        <button
                          type="button"
                          onClick={() => setSelectedProviderIds([])}
                          className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          {t('reminders.board.clear')}
                        </button>
                      )}
                    </div>
                    {providerOptions.list.length === 0 && !providerOptions.hasUnassigned ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('reminders.board.noProviders')}
                      </p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto -mx-1 pr-1">
                        {providerOptions.hasUnassigned && (
                          <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                            <Checkbox
                              checked={selectedProviderIds.includes("unassigned")}
                              onCheckedChange={() => toggleProvider("unassigned")}
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300 italic">
                              {t('reminders.board.unassigned')}
                            </span>
                          </label>
                        )}
                        {providerOptions.list.map(p => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedProviderIds.includes(p.id)}
                              onCheckedChange={() => toggleProvider(p.id)}
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                              {p.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {isProviderFiltered
                        ? t('reminders.board.selectedCount', { count: selectedProviderIds.length })
                        : t('reminders.board.showingAllProviders')}
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
              </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 shrink-0 rounded-lg p-0"
                onClick={() => setCollapsed(c => !c)}
                aria-label={collapsed ? t('reminders.board.expand') : t('reminders.board.collapse')}
                title={collapsed ? t('reminders.board.expand') : t('reminders.board.collapse')}
              >
                {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Slim stats top bar — total + status filters (replaces the left sidebar) */}
          <div className="flex items-center gap-4 overflow-x-auto px-5 py-3 border-b border-border bg-slate-50/60 dark:bg-slate-900/30">
            <div className="flex-none">
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-slate-500 dark:text-slate-400">
                {t('reminders.board.totalAppointments')}
              </p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                  {isCurrentMonth ? totalThisMonth : monthAppointments.length}
                </span>
                <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                  {isCurrentMonth
                    ? t('reminders.board.thisMonth')
                    : t('reminders.board.inMonth', { month: format(selectedMonthDate, 'MMMM', { locale: dfLocale }) })}
                </span>
                {isCurrentMonth && pctDelta !== null && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    <TrendingUp className="h-3 w-3" />
                    {pctDelta >= 0 ? `+${pctDelta}` : pctDelta}%
                  </span>
                )}
              </div>
            </div>

            <div className="h-10 w-px flex-none bg-border" />

            <div className="flex items-center gap-2">
              {filterItems.map(item => {
                const active = item.key === selectedFilter;
                const disabled = !isCurrentMonth;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSelectedFilter(item.key);
                      setListTab("selected");
                    }}
                    disabled={disabled}
                    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      disabled
                        ? "border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-default"
                        : active
                        ? "border-rose-200 bg-rose-50 text-slate-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-slate-100"
                        : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        disabled ? "bg-slate-300 dark:bg-slate-700" : item.dotClass
                      }`}
                    />
                    {item.label}
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        disabled
                          ? "text-slate-400 dark:text-slate-600"
                          : active
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {isCurrentMonth ? item.count : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!collapsed && (
          <>
          <div className="flex items-center gap-1 px-5 py-3 border-b border-border overflow-x-auto">
            <TabPill active={effectiveListTab === "all"} onClick={() => setListTab("all")} count={monthAppointments.length}>
              {t('reminders.board.tabs.all')}
            </TabPill>
            <TabPill
              active={effectiveListTab === "selected"}
              onClick={() => setListTab("selected")}
              count={filterCounts[selectedFilter]}
              disabled={!isCurrentMonth}
            >
              {selectedFilterItem.label}
            </TabPill>
          </div>

          {viewMode === "week" ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {weekRangeLabel}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatAppointmentCount(weekFiltered.length)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 rounded-lg p-0"
                    onClick={() => setSelectedWeekDate(d => subWeeks(d, 1))}
                    aria-label={t('reminders.board.week.previousWeek')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs"
                    onClick={() => setSelectedWeekDate(new Date())}
                  >
                    {t('reminders.board.week.currentWeek')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 rounded-lg p-0"
                    onClick={() => setSelectedWeekDate(d => addWeeks(d, 1))}
                    aria-label={t('reminders.board.week.nextWeek')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 min-w-[840px]">
                  {weekDays.map(day => {
                    const key = dayKey(day);
                    const dayAppointments = weekAppointmentsByDay.get(key) ?? [];
                    const today = isToday(day);
                    return (
                      <div
                        key={key}
                        className="group flex min-h-[460px] flex-col border-r border-border last:border-r-0"
                      >
                        <div
                          className={`relative border-b border-border px-3 py-2 text-center ${
                            today
                              ? "bg-rose-50/70 dark:bg-rose-950/20"
                              : "bg-slate-50/70 dark:bg-slate-900/40"
                          }`}
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {format(day, "EEE", { locale: dfLocale })}
                          </div>
                          <div
                            className={`mt-0.5 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-1.5 text-sm font-semibold tabular-nums ${
                              today
                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                : "text-slate-900 dark:text-slate-100"
                            }`}
                          >
                            {format(day, "d")}
                          </div>
                          {onAddAppointment && (
                            <button
                              type="button"
                              onClick={() => onAddAppointment(day)}
                              aria-label={t('reminders.board.calendar.addEvent')}
                              title={t('reminders.board.calendar.addEvent')}
                              className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-900 dark:hover:text-slate-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex-1 space-y-2 p-2">
                          {dayAppointments.length === 0 ? (
                            onAddAppointment ? (
                              <button
                                type="button"
                                onClick={() => onAddAppointment(day)}
                                className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-200 dark:border-slate-800 py-2 text-[11px] text-slate-400 dark:text-slate-500 transition hover:border-slate-300 hover:text-slate-600 dark:hover:border-slate-700 dark:hover:text-slate-300"
                              >
                                <Plus className="h-3 w-3" />
                                {t('reminders.board.calendar.addEvent')}
                              </button>
                            ) : (
                              <div className="pt-6 text-center text-[11px] text-slate-300 dark:text-slate-600">
                                —
                              </div>
                            )
                          ) : (
                            dayAppointments.map(appointment => {
                              const appointmentDate = new Date(appointment.appointmentDate);
                              const chipClass =
                                STATUS_CALENDAR_CHIP[appointment.status] ||
                                "border-l-slate-400 bg-slate-100/80 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800";
                              const name = getCustomerName(appointment.customer);
                              return (
                                <button
                                  key={appointment.id}
                                  type="button"
                                  onClick={() => onViewAppointment(appointment)}
                                  className={`block w-full rounded-md border-l-2 px-2 py-1.5 text-left transition-colors ${chipClass}`}
                                >
                                  <div className="text-[11px] font-semibold tabular-nums">
                                    {format(appointmentDate, "h:mm a", { locale: dfLocale })}
                                  </div>
                                  <div className="mt-0.5 truncate text-xs font-medium">
                                    {appointment.serviceType || appointment.title}
                                  </div>
                                  <div className="truncate text-[11px] opacity-70">
                                    {name}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : viewMode === "calendar" ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {format(selectedMonthDate, "MMMM yyyy", { locale: dfLocale })}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatAppointmentCount(filtered.length)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 rounded-lg p-0"
                    onClick={() => shiftSelectedMonth(-1)}
                    aria-label={t('reminders.board.calendar.previousMonth')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs"
                    onClick={() => handleMonthChange(format(now, "yyyy-MM"))}
                  >
                    {t('reminders.board.calendar.currentMonth')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 rounded-lg p-0"
                    onClick={() => shiftSelectedMonth(1)}
                    aria-label={t('reminders.board.calendar.nextMonth')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col">
                <div className="overflow-x-auto">
                  <div className="min-w-[720px]">
                    <div className="grid grid-cols-7 border-b border-border bg-slate-50/80 dark:bg-slate-900/40">
                      {weekdayLabels.map(label => (
                        <div
                          key={label}
                          className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {calendarDays.map(day => {
                        const key = dayKey(day);
                        const dayAppointments = calendarAppointmentsByDay.get(key) ?? [];
                        const outsideMonth = !isSameMonth(day, selectedMonthDate);
                        const selected = isSameDay(day, selectedCalendarDate);
                        const today = isToday(day);

                        return (
                          <div
                            key={key}
                            role="button"
                            tabIndex={0}
                            onClick={() => selectCalendarDay(day)}
                            onKeyDown={(event) => handleCalendarDayKeyDown(event, day)}
                            className={`group min-h-[128px] border-r border-b border-slate-100 dark:border-slate-800 p-2 text-left outline-none transition-colors ${
                              outsideMonth
                                ? "bg-slate-50/60 dark:bg-slate-950/30 text-slate-400 dark:text-slate-600"
                                : "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                            } ${
                              selected
                                ? "ring-2 ring-inset ring-slate-900 dark:ring-slate-100"
                                : "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                                  today
                                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                    : selected
                                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                                    : ""
                                }`}
                              >
                                {format(day, "d")}
                              </span>
                              <div className="flex items-center gap-1">
                                {dayAppointments.length > 0 && (
                                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                                    {dayAppointments.length}
                                  </span>
                                )}
                                {onAddAppointment && (
                                  <button
                                    type="button"
                                    onClick={event => {
                                      event.stopPropagation();
                                      setSelectedCalendarDate(day);
                                      onAddAppointment(day);
                                    }}
                                    aria-label={t('reminders.board.calendar.addEvent')}
                                    title={t('reminders.board.calendar.addEvent')}
                                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-900 dark:hover:text-slate-100"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 space-y-1 overflow-hidden">
                              {dayAppointments.slice(0, 3).map(appointment => {
                                const appointmentDate = new Date(appointment.appointmentDate);
                                const chipClass =
                                  STATUS_CALENDAR_CHIP[appointment.status] ||
                                  "border-l-slate-400 bg-slate-100/80 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800";

                                return (
                                  <button
                                    key={appointment.id}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedCalendarDate(day);
                                      onViewAppointment(appointment);
                                    }}
                                    className={`flex w-full items-center gap-1 rounded-md border-l-2 px-2 py-1 text-left text-[11px] leading-4 transition-colors ${chipClass}`}
                                    aria-label={`${format(appointmentDate, "h:mm a", { locale: dfLocale })} ${appointment.title}`}
                                  >
                                    <span className="shrink-0 font-semibold tabular-nums">
                                      {format(appointmentDate, "h:mm a", { locale: dfLocale })}
                                    </span>
                                    <span className="min-w-0 truncate">
                                      {appointment.serviceType || appointment.title}
                                    </span>
                                  </button>
                                );
                              })}
                              {dayAppointments.length > 3 && (
                                <div className="px-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                  {t('reminders.board.calendar.more', { count: dayAppointments.length - 3 })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <aside ref={selectedDaySectionRef} className="scroll-mt-4 border-t border-border">
                  <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                        {t('reminders.board.calendar.selectedDay')}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                        {format(selectedCalendarDate, "EEEE, MMM d", { locale: dfLocale })}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatAppointmentCount(selectedDayAppointments.length)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 rounded-lg p-0"
                          onClick={() => goToDay(addDays(selectedCalendarDate, -1))}
                          aria-label={t('reminders.board.calendar.previousDay')}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 rounded-lg p-0"
                          onClick={() => goToDay(addDays(selectedCalendarDate, 1))}
                          aria-label={t('reminders.board.calendar.nextDay')}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      {onAddAppointment && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 gap-1.5 rounded-lg"
                          onClick={() => onAddAppointment(selectedCalendarDate)}
                        >
                          <Plus className="h-4 w-4" />
                          {t('reminders.board.calendar.addEvent')}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto p-4">
                    {selectedDayAppointments.length === 0 ? (
                      <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 px-4 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {t('reminders.board.calendar.noAppointments')}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {selectedDayAppointments.map(appointment => {
                          const appointmentDate = new Date(appointment.appointmentDate);
                          const dotClass = STATUS_DOT[appointment.status] || "bg-slate-400";
                          const name = getCustomerName(appointment.customer);

                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              onClick={() => onViewAppointment(appointment)}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                                  {format(appointmentDate, "h:mm a", { locale: dfLocale })}
                                </span>
                                <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                              </div>
                              <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                                {appointment.serviceType || appointment.title}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                {name}
                              </p>
                              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                <span>{appointment.duration}m</span>
                                <span className="truncate">
                                  {appointment.provider?.name || appointment.provider?.email || t('reminders.board.unassigned')}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('reminders.board.noMatch')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                  <TableHead className="px-4 sm:px-6 text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    {t('reminders.board.table.contact')}
                  </TableHead>
                  <TableHead className="px-4 sm:px-6 text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    {t('reminders.board.table.when')}
                  </TableHead>
                  <TableHead className="hidden md:table-cell px-4 sm:px-6 text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    {t('reminders.board.table.type')}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell px-4 sm:px-6 text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    {t('reminders.board.table.provider')}
                  </TableHead>
                  <TableHead className="px-4 sm:px-6 text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    {t('reminders.board.table.status')}
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
                      <TableCell className="px-4 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${avatarClass}`}
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
                            {/* On mobile the Type column is hidden, so surface it here */}
                            <div className="md:hidden text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {apt.serviceType || apt.title}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                            {format(aptDate, "h:mm a", { locale: dfLocale })}
                          </span>
                          {isToday(aptDate) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[10px] font-medium">
                              {t('reminders.board.todayBadge')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {format(aptDate, "MMM d", { locale: dfLocale })}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell px-4 sm:px-6 py-3 sm:py-4 text-sm text-slate-700 dark:text-slate-300">
                        {apt.serviceType || apt.title}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell px-4 sm:px-6 py-3 sm:py-4">
                        {apt.provider?.name || apt.provider?.email ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                                AVATAR_PALETTE[
                                  hashString(apt.provider.name || apt.provider.email || "") %
                                    AVATAR_PALETTE.length
                                ]
                              }`}
                            >
                              {getInitials(apt.provider.name || apt.provider.email || "?")}
                            </div>
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                              {apt.provider.name || apt.provider.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm italic text-slate-400 dark:text-slate-500">
                            {t('reminders.board.unassigned')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 sm:px-6 py-3 sm:py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${pillClass}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                          {t(`reminders.appointments.${
                            apt.status === 'no_show' ? 'noShow' : apt.status
                          }`, { defaultValue: apt.status.replace("_", " ") })}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-t border-border text-sm">
            <div className="text-slate-500 dark:text-slate-400">
              {viewMode === "week" ? (
                <>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatAppointmentCount(weekFiltered.length)}
                  </span>{" "}
                  · {weekRangeLabel}
                </>
              ) : viewMode === "calendar" ? (
                <>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatAppointmentCount(filtered.length)}
                  </span>{" "}
                  · {format(selectedMonthDate, "MMMM yyyy", { locale: dfLocale })}
                </>
              ) : (
                <>
                  {t('reminders.board.showing')} <span className="font-medium text-slate-700 dark:text-slate-300">{visible.length}</span>{" "}
                  {t('reminders.board.of')} <span className="font-medium text-slate-700 dark:text-slate-300">{filtered.length}</span>
                  {filtered.length > pageSize && (
                    <button
                      type="button"
                      onClick={() => setPageSize(p => p + 8)}
                      className="ml-3 text-slate-900 dark:text-slate-100 hover:underline"
                    >
                      {t('reminders.board.showMore')}
                    </button>
                  )}
                </>
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
                  {t('reminders.board.exportCsv')}
                </button>
              )}
              {onManageTemplates && (
                <button
                  type="button"
                  onClick={onManageTemplates}
                  className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t('reminders.board.manageTemplates')}
                </button>
              )}
              {onViewCalendar && (
                <button
                  type="button"
                  onClick={onViewCalendar}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100 hover:underline"
                >
                  {t('reminders.board.viewFullCalendar')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          </>
          )}
        </CardContent>
      </Card>
  );
}

function TabPill({
  active,
  count,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        disabled
          ? "text-slate-400 dark:text-slate-600 cursor-default"
          : active
          ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      {children}
      <span
        className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-md px-1.5 text-[11px] tabular-nums ${
          disabled
            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600"
            : active
            ? "bg-white/15 text-white dark:bg-slate-900/15 dark:text-slate-900"
            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
        }`}
      >
        {disabled ? "—" : count}
      </span>
    </button>
  );
}

export default AppointmentsWeekBoard;
