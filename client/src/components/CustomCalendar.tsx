import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';

interface ActivityIndicator {
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed';
  count: number;
}

interface CalendarProps {
  mode?: 'single' | 'range';
  selected?: Date | { from?: Date; to?: Date };
  onSelect?: (date: Date | { from?: Date; to?: Date } | undefined) => void;
  numberOfMonths?: number;
  activityData?: Record<string, ActivityIndicator[]>; // Date string -> activities
  className?: string;
  onRangeComplete?: () => void; // Called when range selection is complete
}

const getActivityColor = (type: string): string => {
  switch (type) {
    case 'clicked': return 'bg-green-500';
    case 'opened': return 'bg-blue-500';
    case 'delivered': return 'bg-green-300';
    case 'sent': return 'bg-gray-400';
    case 'bounced': case 'complained': return 'bg-red-500';
    case 'unsubscribed': return 'bg-orange-500';
    default: return 'bg-gray-300';
  }
};

const CustomCalendar: React.FC<CalendarProps> = ({
  mode = 'single',
  selected,
  onSelect,
  numberOfMonths = 1,
  activityData = {},
  className = ''
}) => {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const renderMonth = (monthDate: Date, monthIndex: number) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Get the first day of the week for the month (0 = Sunday)
    const firstDayOfWeek = monthStart.getDay();
    
    // Create empty cells for days before the month starts
    const emptyDays = Array.from({ length: firstDayOfWeek }, (_, i) => i);

    const handleDateClick = (date: Date) => {
      if (!onSelect) return;

      if (mode === 'single') {
        onSelect(date);
      } else if (mode === 'range') {
        const range = selected as { from?: Date; to?: Date } | undefined;
        if (!range?.from || (range.from && range.to)) {
          // Start new range
          onSelect({ from: date, to: undefined });
        } else if (range.from && !range.to) {
          // Complete range
          if (date < range.from) {
            onSelect({ from: date, to: range.from });
          } else {
            onSelect({ from: range.from, to: date });
          }
        }
      }
    };

    const isDateSelected = (date: Date): boolean => {
      if (mode === 'single') {
        return selected ? isSameDay(date, selected as Date) : false;
      } else {
        const range = selected as { from?: Date; to?: Date } | undefined;
        if (!range) return false;
        
        // Normalize dates to start of day for accurate comparison
        const normalizedDate = startOfDay(date);
        const normalizedFrom = range.from ? startOfDay(range.from) : null;
        const normalizedTo = range.to ? startOfDay(range.to) : null;
        
        if (normalizedFrom && normalizedTo) {
          return normalizedDate.getTime() >= normalizedFrom.getTime() && normalizedDate.getTime() <= normalizedTo.getTime();
        }
        return normalizedFrom && range.from ? isSameDay(date, range.from) : false;
      }
    };

    const isDateInRange = (date: Date): 'start' | 'end' | 'middle' | false => {
      if (mode !== 'range') return false;
      const range = selected as { from?: Date; to?: Date } | undefined;
      if (!range?.from) return false;
      
      // Handle single date selection (only 'from' is set)
      if (range.from && !range.to) {
        return isSameDay(date, range.from) ? 'start' : false;
      }
      
      // Handle complete range selection
      if (range.from && range.to) {
        if (isSameDay(date, range.from)) return 'start';
        if (isSameDay(date, range.to)) return 'end';
        
        // Use normalized dates for middle comparison
        const normalizedDate = startOfDay(date);
        const normalizedFrom = startOfDay(range.from);
        const normalizedTo = startOfDay(range.to);
        
        if (normalizedDate > normalizedFrom && normalizedDate < normalizedTo) {
          return 'middle';
        }
      }
      
      return false;
    };

    return (
      <div key={monthIndex} className="p-4">
        {/* Month header */}
        <div className="flex items-center justify-between mb-4">
          {monthIndex === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <h3 className="text-sm font-medium text-center flex-1">
            {format(monthDate, 'MMMM yyyy')}
          </h3>
          {monthIndex === numberOfMonths - 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-xs font-medium text-gray-500 text-center p-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before month starts */}
          {emptyDays.map(i => (
            <div key={`empty-${i}`} className="h-10" />
          ))}
          
          {/* Month days */}
          {days.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const activities = activityData[dateStr] || [];
            const isSelected = isDateSelected(date);
            const rangePosition = isDateInRange(date);
            const isCurrentMonth = isSameMonth(date, monthDate);
            const isTodayDate = isToday(date);

            // Determine styling based on range position and selection
            const getDateStyles = () => {
              const baseClasses = `
                relative h-10 text-sm rounded-md transition-colors
                ${isCurrentMonth ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}
              `;

              // Range mode styling
              if (mode === 'range' && rangePosition) {
                if (rangePosition === 'start' || rangePosition === 'end') {
                  return `${baseClasses} bg-primary text-primary-foreground`;
                } else if (rangePosition === 'middle') {
                  return `${baseClasses} bg-primary/20 text-primary border-0`;
                }
              }

              // Single mode or unselected dates
              if (isSelected && mode === 'single') {
                return `${baseClasses} bg-primary text-primary-foreground`;
              }

              // Default hover state
              return `${baseClasses} hover:bg-gray-100 dark:hover:bg-gray-800`;
            };

            return (
              <button
                key={dateStr}
                onMouseDown={(e) => {
                  // Prevent focus-induced scroll jumps in some browsers
                  e.preventDefault();
                }}
                onClick={() => handleDateClick(date)}
                className={getDateStyles()}
              >
                <span className="relative z-10">
                  {format(date, 'd')}
                </span>
                
                {/* Activity indicators */}
                {activities.length > 0 && (
                  <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                    {activities.slice(0, 4).map((activity, i) => (
                      <div
                        key={i}
                        className={`w-1 h-1 rounded-full ${getActivityColor(activity.type)}`}
                        title={`${activity.count} ${activity.type}`}
                      />
                    ))}
                    {activities.length > 4 && (
                      <div className="w-1 h-1 rounded-full bg-gray-600" title={`+${activities.length - 4} more`} />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const months = Array.from({ length: numberOfMonths }, (_, i) => addMonths(currentMonth, i));

  return (
    <div className={`bg-white dark:bg-gray-900 border rounded-lg min-w-0 ${className}`}>
      <div className={`grid ${numberOfMonths === 2 ? 'grid-cols-2' : 'grid-cols-1'} divide-x dark:divide-gray-700 w-full`}>
        {months.map((month, index) => renderMonth(month, index))}
      </div>
    </div>
  );
};

export default CustomCalendar;