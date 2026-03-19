'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'

import { cn } from '@/src/utils/common.client'
import { buttonVariants } from '@/src/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        root: 'text-[var(--text-primary)]',
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex flex-col gap-4',
        month_caption: 'flex h-7 items-center justify-center',
        caption_label: 'text-sm font-medium text-[var(--text-primary)]',
        nav: 'absolute top-0 flex w-full items-center justify-between px-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 text-[var(--text-primary)] opacity-50 hover:opacity-100'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 text-[var(--text-primary)] opacity-50 hover:opacity-100'
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-center text-[0.8rem] font-normal text-[var(--text-secondary)]',
        week: 'mt-2 flex w-full',
        day: 'relative h-9 w-9 p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal text-[var(--text-primary)] hover:bg-[var(--option-bg-hover)] hover:text-[var(--text-primary)] aria-selected:opacity-100'
        ),
        selected:
          'bg-[var(--color-background-primary)] text-[var(--color-foreground-primary)] hover:bg-[var(--color-background-primary)] hover:text-[var(--color-foreground-primary)] focus:bg-[var(--color-background-primary)] focus:text-[var(--color-foreground-primary)]',
        today: 'bg-[var(--color-background-neutral-faded)] text-[var(--text-primary)]',
        outside: 'text-[var(--text-secondary)] opacity-50 aria-selected:opacity-30',
        disabled: 'text-[var(--text-secondary)] opacity-50',
        range_middle:
          'aria-selected:bg-[var(--color-background-primary-faded)] aria-selected:text-[var(--text-primary)]',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight
          return <Icon className="h-4 w-4 text-[var(--text-primary)]" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
