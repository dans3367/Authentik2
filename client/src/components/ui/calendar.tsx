import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CalendarProps {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  disabled?: { after?: Date; before?: Date }
  fromYear?: number
  toYear?: number
  className?: string
  hideYear?: boolean
}

const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function Calendar({ selected, onSelect, disabled, fromYear = 1900, toYear = new Date().getFullYear(), className, hideYear = false }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selected?.getMonth() ?? new Date().getMonth())
  const [currentYear, setCurrentYear] = React.useState(selected?.getFullYear() ?? new Date().getFullYear())

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
  const firstDayWeekday = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const handleDateClick = (day: number) => {
    const date = new Date(currentYear, currentMonth, day)
    if (disabled?.after && date > disabled.after) return
    if (disabled?.before && date < disabled.before) return
    onSelect?.(date)
  }

  const isDateDisabled = (day: number) => {
    const date = new Date(currentYear, currentMonth, day)
    if (disabled?.after && date > disabled.after) return true
    if (disabled?.before && date < disabled.before) return true
    return false
  }

  const isSelected = (day: number) => {
    if (!selected) return false
    return selected.getDate() === day && 
           selected.getMonth() === currentMonth && 
           selected.getFullYear() === currentYear
  }

  // Generate calendar days
  const calendarDays = []
  
  // Previous month's trailing days
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate()
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthLastDay - i,
      isCurrentMonth: false,
      isPrevMonth: true
    })
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: true,
      isPrevMonth: false
    })
  }

  // Next month's leading days
  const remainingDays = 42 - calendarDays.length
  for (let day = 1; day <= remainingDays; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: false,
      isPrevMonth: false
    })
  }

  return (
    <div className={cn("p-4 bg-white rounded-2xl border shadow-sm", className)}>
      {/* Header with navigation and dropdowns */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1 hover:bg-gray-100 rounded"
          type="button"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>

        <div className="flex items-center gap-2">
          {/* Month Dropdown */}
          <div className="relative">
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {months.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Year Dropdown - hide if hideYear is true */}
          {!hideYear && (
            <div className="relative">
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i).map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        <button
          onClick={nextMonth}
          className="p-1 hover:bg-gray-100 rounded"
          type="button"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-0 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-normal text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {calendarDays.map((calendarDay, index) => {
          const { day, isCurrentMonth } = calendarDay
          const disabled = isCurrentMonth && isDateDisabled(day)
          const selected = isCurrentMonth && isSelected(day)

          return (
            <button
              key={index}
              type="button"
              onClick={() => isCurrentMonth && !disabled && handleDateClick(day)}
              disabled={disabled || !isCurrentMonth}
              className={cn(
                "h-9 w-full text-sm font-normal transition-colors",
                "hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                {
                  "text-gray-400": !isCurrentMonth,
                  "text-gray-900": isCurrentMonth && !selected && !disabled,
                  "text-gray-400 cursor-not-allowed": disabled,
                  "bg-black text-white hover:bg-black rounded-lg": selected,
                }
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
