'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parse, isValid } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  className?: string;
  allowFutureDates?: boolean;
}

export function DatePicker({ value, onChange, placeholder = 'MM/DD/YYYY', error, className, allowFutureDates = false }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [textValue, setTextValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync textValue when value prop changes (e.g. from calendar selection)
  React.useEffect(() => {
    if (value) {
      const d = parse(value, 'yyyy-MM-dd', new Date());
      if (isValid(d)) {
        setTextValue(format(d, 'MM/dd/yyyy'));
      }
    } else {
      setTextValue('');
    }
  }, [value]);

  const date = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  // Disable future dates only if allowFutureDates is false
  const disabledMatcher = allowFutureDates ? undefined : (date: Date) => {
    return date > new Date();
  };

  const handleSelect = (selected: Date | undefined) => {
    // Prevent future dates from being selected only if allowFutureDates is false
    if (!allowFutureDates && selected && selected > new Date()) {
      return;
    }
    onChange(selected ? format(selected, 'yyyy-MM-dd') : '');
    setOpen(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextValue(raw);

    // Auto-format: add slashes as user types digits
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 8) {
      const mm = digits.slice(0, 2);
      const dd = digits.slice(2, 4);
      const yyyy = digits.slice(4, 8);
      const parsed = parse(`${yyyy}-${mm}-${dd}`, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) {
        // Prevent future dates
        if (parsed <= new Date()) {
          onChange(format(parsed, 'yyyy-MM-dd'));
          setTextValue(`${mm}/${dd}/${yyyy}`);
        }
      }
    } else if (raw === '') {
      onChange('');
    }
  };

  const handleTextBlur = () => {
    // On blur, try to parse whatever the user typed
    if (!textValue) {
      onChange('');
      return;
    }
    // Try common formats
    const formats = ['MM/dd/yyyy', 'M/d/yyyy', 'MM-dd-yyyy', 'yyyy-MM-dd'];
    for (const fmt of formats) {
      const parsed = parse(textValue, fmt, new Date());
      if (isValid(parsed) && parsed.getFullYear() > 1900) {
        // Check if date is in the future
        if (parsed > new Date()) {
          // If future date, revert to the current value
          if (value) {
            const d = parse(value, 'yyyy-MM-dd', new Date());
            setTextValue(isValid(d) ? format(d, 'MM/dd/yyyy') : '');
          } else {
            setTextValue('');
          }
          return;
        }
        onChange(format(parsed, 'yyyy-MM-dd'));
        return;
      }
    }
    // If nothing parsed, revert to the current value
    if (value) {
      const d = parse(value, 'yyyy-MM-dd', new Date());
      setTextValue(isValid(d) ? format(d, 'MM/dd/yyyy') : '');
    } else {
      setTextValue('');
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    setTextValue('');
  };

  return (
    <div className={cn('relative', className)}>
      <div className={cn(
        "relative flex items-center w-full h-13 bg-gray-50 rounded-xl border shadow-xs shadow-black/5 focus-within:ring-2 focus-within:ring-[#7FA5A3] focus-within:border-transparent transition-all",
        error ? 'border-red-400' : 'border-gray-200',
      )}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-center pl-4 pr-2 h-full text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <CalendarIcon className="w-5 h-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={handleSelect} {...(disabledMatcher && { disabled: disabledMatcher })} autoFocus />
          </PopoverContent>
        </Popover>

        <input
          ref={inputRef}
          type="text"
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          placeholder={placeholder}
          className="flex-1 h-full bg-transparent text-base outline-none placeholder:text-gray-400 pr-9"
        />

        {date && (
          <button
            type="button"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={handleReset}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-1 ml-1">This field is required</p>}
    </div>
  );
}
