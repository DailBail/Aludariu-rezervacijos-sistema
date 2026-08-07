"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

const WEEKDAYS = ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"];

export default function HomePage() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(null);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3">
        <CalendarDays className="h-8 w-8 text-beer" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold">Aludariu rezervacijos sistema</h1>
          <p className="text-sm text-neutral-500">Pasirinkite datą rezervacijai</p>
        </div>
      </header>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="rounded-md p-2 hover:bg-neutral-100"
            aria-label="Ankstesnis mėnuo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold capitalize">
            {format(currentMonth, "yyyy MMMM")}
          </h2>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="rounded-md p-2 hover:bg-neutral-100"
            aria-label="Kitas mėnuo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-400">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const inMonth = isSameMonth(day, currentMonth);
            const selected = selectedDate && isSameDay(day, selectedDate);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={clsx(
                  "aspect-square rounded-md text-sm transition-colors",
                  !inMonth && "text-neutral-300",
                  inMonth && "text-neutral-800 hover:bg-beer-light/40",
                  isToday(day) && !selected && "font-bold text-beer-dark",
                  selected && "bg-beer text-white hover:bg-beer",
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </section>

      {selectedDate && (
        <p className="mt-6 text-center text-neutral-600">
          Pasirinkta data:{" "}
          <span className="font-semibold text-neutral-900">
            {format(selectedDate, "yyyy-MM-dd")}
          </span>
        </p>
      )}
    </main>
  );
}
