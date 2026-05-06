// Timezone helpers for daily/weekly/monthly budget calculations.

export function browserTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}

/** ISO YYYY-MM-DD of `date` in the given IANA `tz`. */
export function localDateInTz(date: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  // en-CA already returns YYYY-MM-DD
  return fmt.format(date);
}

export function todayInTz(tz: string): string {
  return localDateInTz(new Date(), tz);
}

/** Start of the current week (ISO date) in `tz`. weekStart = "sunday" | "monday". */
export function startOfWeekInTz(tz: string, weekStart: "sunday" | "monday" = "sunday"): string {
  const today = todayInTz(tz); // YYYY-MM-DD
  const [y, m, d] = today.split("-").map(Number);
  // Treat as UTC to avoid host-tz drift; we only use day-of-week math.
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay(); // 0 Sun .. 6 Sat
  const offset = weekStart === "monday" ? (dow + 6) % 7 : dow;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return utc.toISOString().slice(0, 10);
}

export function startOfMonthInTz(tz: string): string {
  const today = todayInTz(tz);
  return today.slice(0, 8) + "01";
}

export const COMMON_TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
  "UTC", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Sydney",
];
