'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

function Calendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown"
      hideNavigation
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col sm:flex-row gap-4',
        month: 'w-full',
        month_caption: 'relative mb-1 flex h-8 items-center justify-center z-20',
        caption_label: 'sr-only',
        dropdowns: 'flex items-center justify-center gap-1.5',
        dropdown_root: 'relative rounded-xl border border-gray-200 bg-[#F8F6F2] shadow-xs',
        months_dropdown: 'h-9 rounded-xl px-3 pr-7 text-sm font-semibold text-[#4F4F4F] focus:outline-none',
        years_dropdown: 'h-9 rounded-xl px-3 pr-7 text-sm font-semibold text-[#4F4F4F] focus:outline-none',
        weekday: 'size-8 p-0 text-xs font-medium text-muted-foreground/80',
        day_button:
          'cursor-pointer relative flex size-8 items-center justify-center whitespace-nowrap rounded-md p-0 text-foreground transition-200 group-[[data-selected]:not(.range-middle)]:[transition-property:color,background-color,border-radius,box-shadow] group-[[data-selected]:not(.range-middle)]:duration-150 group-data-disabled:pointer-events-none focus-visible:z-10 hover:not-in-data-selected:bg-accent group-data-selected:bg-primary hover:not-in-data-selected:text-foreground group-data-selected:text-primary-foreground group-data-disabled:text-foreground/30 group-data-disabled:line-through group-data-outside:text-foreground/30 group-data-selected:group-data-outside:text-primary-foreground outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] group-[.range-start:not(.range-end)]:rounded-e-none group-[.range-end:not(.range-start)]:rounded-s-none group-[.range-middle]:rounded-none group-[.range-middle]:group-data-selected:bg-accent group-[.range-middle]:group-data-selected:text-foreground',
        day: 'group size-8 px-0 py-px text-sm',
        range_start: 'range-start',
        range_end: 'range-end',
        range_middle: 'range-middle',
        today:
          '*:after:pointer-events-none *:after:absolute *:after:bottom-1 *:after:start-1/2 *:after:z-10 *:after:size-[3px] *:after:-translate-x-1/2 rtl:*:after:translate-x-1/2 *:after:rounded-full *:after:bg-primary [&[data-selected]:not(.range-middle)>*]:after:bg-background [&[data-disabled]>*]:after:bg-foreground/30 *:after:transition-colors',
        outside: 'text-muted-foreground data-selected:bg-accent/50 data-selected:text-muted-foreground',
        hidden: 'invisible',
        week_number: 'size-8 p-0 text-xs font-medium text-muted-foreground/80',
        ...classNames,
      }}
      components={{
        Chevron: (props) => {
          if (props.orientation === 'up') {
            return <ChevronUp className="h-4 w-4" />;
          }
          return <ChevronDown className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
