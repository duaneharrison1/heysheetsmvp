import * as React from 'react';
import { format, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, subDays, subWeeks, subMonths } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';

export type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_7_days' | 'last_28_days' | 'this_month' | 'last_month' | 'this_year';

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange, preset?: DateRangePreset) => void;
  className?: string;
}

const presets: { label: string; value: DateRangePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'Last 7 Days', value: 'last_7_days' },
  { label: 'Last 28 Days', value: 'last_28_days' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Year', value: 'this_year' },
];

function getPresetRange(preset: DateRangePreset): DateRange {
  const now = new Date();
  const today = startOfDay(now);

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const yesterday = subDays(today, 1);
      return { from: yesterday, to: yesterday };
    }
    case 'this_week': {
      // Week till today (Sunday to today)
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      return { from: weekStart, to: today };
    }
    case 'last_7_days': {
      // Last 7 days including today
      return { from: subDays(today, 6), to: today };
    }
    case 'last_28_days': {
      // Last 28 days including today
      return { from: subDays(today, 27), to: today };
    }
    case 'this_month': {
      // Month till today
      const monthStart = startOfMonth(today);
      return { from: monthStart, to: today };
    }
    case 'last_month': {
      // Entire last month
      const lastMonthStart = startOfMonth(subMonths(today, 1));
      const lastMonthEnd = endOfMonth(lastMonthStart);
      return { from: lastMonthStart, to: lastMonthEnd };
    }
    case 'this_year': {
      // Year till today
      const yearStart = startOfYear(today);
      return { from: yearStart, to: today };
    }
    default:
      return { from: today, to: today };
  }
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedPreset, setSelectedPreset] = React.useState<DateRangePreset | null>('last_28_days');
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(new Date());
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Initialize with default range if not provided
  React.useEffect(() => {
    if (!value && onChange) {
      const defaultRange = getPresetRange('last_28_days');
      onChange(defaultRange, 'last_28_days');
    }
  }, []);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = getPresetRange(preset);
    setSelectedPreset(preset);
    setCalendarMonth(range.from);
    onChange?.(range, preset);
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      setSelectedPreset(null);
      onChange?.({ from: range.from, to: range.to });
    } else if (range?.from) {
      // Single date selected, use as both from and to
      setSelectedPreset(null);
      onChange?.({ from: range.from, to: range.from });
    }
  };

  const formatDateRange = () => {
    if (!value) return 'Select date range';
    const { from, to } = value;
    if (from.getTime() === to.getTime()) {
      return format(from, 'dd MMM yyyy');
    }
    return `${format(from, 'dd MMM yyyy')} - ${format(to, 'dd MMM yyyy')}`;
  };

  return (
    <div className={cn('relative', className)}>
      <Button
        ref={triggerRef}
        variant="outline"
        onClick={() => setOpen(!open)}
        className={cn(
          'justify-start text-left font-normal min-w-[240px]',
          !value && 'text-muted-foreground'
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {formatDateRange()}
      </Button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 left-auto mt-2 z-50 bg-popover border border-border rounded-lg shadow-lg flex max-w-[92vw]"
          style={{ transformOrigin: 'right top' }}
        >
          {/* Presets sidebar */}
          <div className="w-40 border-r border-border p-2">
            {presets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetClick(preset.value)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                  selectedPreset === preset.value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-foreground'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={value ? { from: value.from, to: value.to } : undefined}
              onSelect={handleCalendarSelect as any}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              numberOfMonths={1}
              className="rounded-md"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export { getPresetRange };
