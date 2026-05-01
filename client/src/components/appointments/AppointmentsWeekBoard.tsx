import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [selectedFilter, setSelectedFilter] = useState<SidebarFilterKey>("upcoming");
  const [listTab, setListTab] = useState<ListTabKey>("selected");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(8);
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);

  const now = useMemo(() => new Date(), [appointments]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));

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

  useEffect(() => {
    if (!isCurrentMonth && listTab !== "all") setListTab("all");
  }, [isCurrentMonth, listTab]);

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

  const last7Days = useMemo(() => {
    const days: { label: string; date: Date; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(now, i);
      const count = scopedAppointments.filter(a => isSameDay(new Date(a.appointmentDate), d)).length;
      days.push({ label: format(d, "EEE"), date: d, count });
    }
    return days;
  }, [scopedAppointments, now]);

  const avgLast7 = last7Days.length > 0
    ? last7Days.reduce((sum, d) => sum + d.count, 0) / last7Days.length
    : 0;

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* LEFT: Stats sidebar */}
      <Card className="shadow-sm">
        <CardContent className="p-6 flex flex-col gap-6">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-slate-500 dark:text-slate-400">
              {t('reminders.board.totalAppointments')}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {isCurrentMonth ? totalThisMonth : monthAppointments.length}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {isCurrentMonth
                  ? t('reminders.board.thisMonth')
                  : t('reminders.board.inMonth', { month: format(selectedMonthDate, 'MMMM') })}
              </span>
            </div>
            {isCurrentMonth && pctDelta !== null && (
              <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                {pctDelta >= 0 ? `+${pctDelta}` : pctDelta}% {t('reminders.board.vsLastMonth')}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 -mx-2">
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
                  className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    disabled
                      ? "text-slate-400 dark:text-slate-600 cursor-default"
                      : active
                      ? "bg-rose-50 dark:bg-rose-950/30 text-slate-900 dark:text-slate-100"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        disabled ? "bg-slate-300 dark:bg-slate-700" : item.dotClass
                      }`}
                    />
                    {item.label}
                  </span>
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      disabled
                        ? "text-slate-400 dark:text-slate-600"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {isCurrentMonth ? item.count : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-slate-500 dark:text-slate-400 mb-2">
              {t('reminders.board.allAppointments')}
            </p>
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-full h-9 rounded-lg">
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
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-baseline justify-between mb-2">
              <span
                className={`text-[11px] font-medium tracking-[0.15em] uppercase ${
                  isCurrentMonth
                    ? "text-slate-500 dark:text-slate-400"
                    : "text-slate-400 dark:text-slate-600"
                }`}
              >
                {t('reminders.board.bookingsLast7Days')}
              </span>
              <span
                className={`text-[11px] tabular-nums ${
                  isCurrentMonth
                    ? "text-slate-500 dark:text-slate-400"
                    : "text-slate-400 dark:text-slate-600"
                }`}
              >
                {t('reminders.board.avg')} {isCurrentMonth ? avgLast7.toFixed(1) : "—"}
              </span>
            </div>
            {isCurrentMonth ? (
              <>
                <MiniLineChart data={last7Days.map(d => d.count)} />
                <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                  {last7Days.map((d, i) => (
                    <span key={i}>{d.label}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[56px] flex items-center justify-center rounded-md border border-dashed border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 dark:text-slate-600">
                  {t('reminders.board.currentMonthOnly')}
                </span>
              </div>
            )}
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
                {t('reminders.board.appointmentsList')}
              </h2>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-900 dark:bg-slate-100 px-1.5 text-[11px] font-medium text-white dark:text-slate-900 tabular-nums">
                {monthAppointments.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('reminders.board.searchPlaceholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 w-56 rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
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
            </div>
          </div>

          <div className="flex items-center gap-1 px-5 py-3 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
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

          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('reminders.board.noMatch')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    {t('reminders.board.table.contact')}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    {t('reminders.board.table.when')}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    {t('reminders.board.table.type')}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
                    {t('reminders.board.table.provider')}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 h-10">
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
                              {t('reminders.board.todayBadge')}
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
                        {apt.provider?.name || apt.provider?.email ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${
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
                      <TableCell className="py-4">
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-800 text-sm">
            <div className="text-slate-500 dark:text-slate-400">
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
        </CardContent>
      </Card>
    </div>
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
