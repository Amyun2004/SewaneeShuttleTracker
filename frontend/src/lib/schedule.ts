// Timetable math for /schedule.
//
// Run times are minutes after midnight of the *service day*: the 12:08 am
// Friday-night run is 1448, not 8. Weekdays are ISO: 1 = Monday ... 7 = Sunday.
import type { ScheduleRun } from "@/api/types";

export const WEEKDAYS = [
  { iso: 1, short: "Mon", long: "Monday" },
  { iso: 2, short: "Tue", long: "Tuesday" },
  { iso: 3, short: "Wed", long: "Wednesday" },
  { iso: 4, short: "Thu", long: "Thursday" },
  { iso: 5, short: "Fri", long: "Friday" },
  { iso: 6, short: "Sat", long: "Saturday" },
  { iso: 7, short: "Sun", long: "Sunday" },
] as const;

export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

export function dayName(iso: number): string {
  return WEEKDAYS[iso - 1].long;
}

/** 588 → "9:48 am", 1448 → "12:08 am". */
export function formatClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${h24 < 12 ? "am" : "pm"}`;
}

export function formatWait(minutes: number): string {
  if (minutes < 1) return "leaving now";
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

export interface NextDeparture {
  run: ScheduleRun;
  /** ISO weekday whose timetable this run belongs to. */
  serviceDay: number;
  /** Minutes from now until it leaves the first stop. */
  minutesAway: number;
  /** Calendar days from today it leaves (0 = today, 1 = tomorrow). */
  daysAhead: number;
}

/** The soonest run leaving at or after `now`, looking up to a week ahead. */
export function nextDeparture(
  runs: ScheduleRun[],
  now: Date
): NextDeparture | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = isoWeekday(now);
  let best: NextDeparture | null = null;

  // offset -1 is yesterday's timetable: its after-midnight runs leave today.
  for (let offset = -1; offset <= 7; offset++) {
    const day = ((today - 1 + offset + 7) % 7) + 1;
    for (const run of runs) {
      if (!run.service_days.includes(day)) continue;
      const leaves = offset * 1440 + run.start_minutes; // after today's midnight
      const away = leaves - nowMin;
      if (away < 0) continue;
      if (!best || away < best.minutesAway) {
        best = {
          run,
          serviceDay: day,
          minutesAway: away,
          daysAhead: Math.floor(leaves / 1440),
        };
      }
    }
  }
  return best;
}

/** How far into `day`'s timetable we are right now, or null when `day` is
 *  neither today nor yesterday (nothing on it has happened yet). */
export function serviceMinutesNow(day: number, now: Date): number | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = isoWeekday(now);
  if (day === today) return nowMin;
  const yesterday = today === 1 ? 7 : today - 1;
  if (day === yesterday) return nowMin + 1440;
  return null;
}