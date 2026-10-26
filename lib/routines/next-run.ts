export type RoutineSchedule = {
  startDate: string;
  time: string;
  timezone: string;
  frequency: "once" | "daily" | "weekly" | "monthly";
  weekDays: Array<"MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU">;
};

type WallDate = { year: number; month: number; day: number; hour: number; minute: number };

function parseSchedule(schedule: RoutineSchedule): WallDate | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(schedule.startDate);
  const time = /^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/.exec(schedule.time.trim());
  if (!date || !time) return null;
  let hour = Number(time[1]);
  const minute = Number(time[2]);
  if (minute > 59 || hour > 23) return null;
  if (time[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (time[3].toLowerCase() === "pm" ? 12 : 0);
  }
  return { year: Number(date[1]), month: Number(date[2]), day: Number(date[3]), hour, minute };
}

function toUtc(wall: WallDate, timezone: string) {
  let timestamp = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  // Convert a wall-clock time in the requested timezone to an absolute instant.
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const renderedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const next = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute) - (renderedAsUtc - timestamp);
    if (next === timestamp) break;
    timestamp = next;
  }
  return new Date(timestamp);
}

function addDays(wall: WallDate, days: number): WallDate {
  const value = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days, wall.hour, wall.minute));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate(), hour: value.getUTCHours(), minute: value.getUTCMinutes() };
}

function addMonths(wall: WallDate, months: number): WallDate {
  const target = new Date(Date.UTC(wall.year, wall.month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return { ...wall, year: target.getUTCFullYear(), month: target.getUTCMonth() + 1, day: Math.min(wall.day, lastDay) };
}

const weekdayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function calculateNextRunAt(schedule: RoutineSchedule, now = new Date()): Date | null {
  try {
    const initial = parseSchedule(schedule);
    if (!initial) return null;
    let candidate = initial;
    for (let i = 0; i < 3660; i += 1) {
      const instant = toUtc(candidate, schedule.timezone);
      if (schedule.frequency === "once") return instant > now ? instant : null;
      const weekdayMatches = schedule.frequency !== "weekly" || (schedule.weekDays.length ? schedule.weekDays : [weekdayCodes[new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day)).getUTCDay()] as RoutineSchedule["weekDays"][number]]).includes(weekdayCodes[new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day)).getUTCDay()] as RoutineSchedule["weekDays"][number]);
      if (instant > now && weekdayMatches) return instant;
      candidate = schedule.frequency === "monthly" ? addMonths(candidate, 1) : addDays(candidate, 1);
    }
    return null;
  } catch {
    return null;
  }
}
