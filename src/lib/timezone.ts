/**
 * Universal Multi-Country Timezone Utility for The Accounts / HisabX
 * Supports auto-detection of device time zone, shop business timezone settings,
 * and robust date/time formatting across all currencies and locales.
 */

export interface TimezoneOption {
  value: string;
  label: string;
  flag: string;
  offset: string;
  country: string;
}

export const POPULAR_TIMEZONES: TimezoneOption[] = [
  { value: "auto", label: "Auto (Device / Local Timezone)", flag: "🌐", offset: "Local", country: "Auto" },
  { value: "Asia/Karachi", label: "Pakistan Standard Time (PKT)", flag: "🇵🇰", offset: "UTC+05:00", country: "Pakistan" },
  { value: "Asia/Dubai", label: "UAE / Gulf Standard Time (GST)", flag: "🇦🇪", offset: "UTC+04:00", country: "UAE" },
  { value: "Asia/Riyadh", label: "Saudi Arabia Standard Time (AST)", flag: "🇸🇦", offset: "UTC+03:00", country: "Saudi Arabia" },
  { value: "Asia/Muscat", label: "Oman Standard Time (GST)", flag: "🇴🇲", offset: "UTC+04:00", country: "Oman" },
  { value: "Asia/Qatar", label: "Qatar Standard Time (AST)", flag: "🇶🇦", offset: "UTC+03:00", country: "Qatar" },
  { value: "Asia/Kuwait", label: "Kuwait Standard Time (AST)", flag: "🇰🇼", offset: "UTC+03:00", country: "Kuwait" },
  { value: "Asia/Bahrain", label: "Bahrain Standard Time (AST)", flag: "🇧🇭", offset: "UTC+03:00", country: "Bahrain" },
  { value: "Europe/London", label: "United Kingdom (GMT / BST)", flag: "🇬🇧", offset: "UTC+00:00 / +01:00", country: "UK" },
  { value: "America/New_York", label: "US Eastern Time (EST / EDT)", flag: "🇺🇸", offset: "UTC-05:00 / -04:00", country: "USA (NY/FL)" },
  { value: "America/Chicago", label: "US Central Time (CST / CDT)", flag: "🇺🇸", offset: "UTC-06:00 / -05:00", country: "USA (Chicago/TX)" },
  { value: "America/Denver", label: "US Mountain Time (MST / MDT)", flag: "🇺🇸", offset: "UTC-07:00 / -06:00", country: "USA (Denver/AZ)" },
  { value: "America/Los_Angeles", label: "US Pacific Time (PST / PDT)", flag: "🇺🇸", offset: "UTC-08:00 / -07:00", country: "USA (CA/WA)" },
  { value: "America/Toronto", label: "Canada Eastern Time (EST / EDT)", flag: "🇨🇦", offset: "UTC-05:00 / -04:00", country: "Canada" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST)", flag: "🇮🇳", offset: "UTC+05:30", country: "India" },
  { value: "Asia/Dhaka", label: "Bangladesh Standard Time (BST)", flag: "🇧🇩", offset: "UTC+06:00", country: "Bangladesh" },
  { value: "Asia/Kuala_Lumpur", label: "Malaysia Standard Time (MYT)", flag: "🇲🇾", offset: "UTC+08:00", country: "Malaysia" },
  { value: "Asia/Singapore", label: "Singapore Standard Time (SGT)", flag: "🇸🇬", offset: "UTC+08:00", country: "Singapore" },
  { value: "Asia/Bangkok", label: "Thailand Standard Time (ICT)", flag: "🇹🇭", offset: "UTC+07:00", country: "Thailand" },
  { value: "Europe/Berlin", label: "Central European Time (CET / CEST)", flag: "🇩🇪", offset: "UTC+01:00 / +02:00", country: "Germany / EU" },
  { value: "Europe/Paris", label: "France / Western Europe (CET / CEST)", flag: "🇫🇷", offset: "UTC+01:00 / +02:00", country: "France" },
  { value: "Europe/Istanbul", label: "Turkey Standard Time (TRT)", flag: "🇹🇷", offset: "UTC+03:00", country: "Turkey" },
  { value: "Africa/Cairo", label: "Egypt Standard Time (EET)", flag: "🇪🇬", offset: "UTC+02:00", country: "Egypt" },
  { value: "Africa/Johannesburg", label: "South Africa Standard Time (SAST)", flag: "🇿🇦", offset: "UTC+02:00", country: "South Africa" },
  { value: "Australia/Sydney", label: "Australia Eastern Time (AEST / AEDT)", flag: "🇦🇺", offset: "UTC+10:00 / +11:00", country: "Australia" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)", flag: "🌐", offset: "UTC+00:00", country: "Universal" },
];

/**
 * Returns the resolved IANA timezone string (e.g. "Asia/Karachi").
 * If the provided timezone is "auto", null, or empty, it returns the client device's browser timezone.
 */
export function getResolvedTimezone(shopTimezone?: string | null): string {
  if (shopTimezone && shopTimezone !== "auto") {
    return shopTimezone;
  }

  if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (userTz) return userTz;
    } catch (e) {
      // Fallback
    }
  }

  return "Asia/Karachi";
}

/**
 * Parse any date input safely into a valid JavaScript Date object
 */
export function safeParseDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a date into a localized date string in the target timezone
 * Example: "Aug 21, 2026" or "21/08/2026"
 */
export function formatDate(
  input: string | number | Date | null | undefined,
  timezone?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = safeParseDate(input);
  if (!d) return "-";

  const tz = getResolvedTimezone(timezone);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  };

  try {
    return new Intl.DateTimeFormat("en-US", defaultOptions).format(d);
  } catch (e) {
    return d.toLocaleDateString();
  }
}

/**
 * Formats a date into a localized time string in the target timezone
 * Example: "01:45 PM" or "13:45:00"
 */
export function formatTime(
  input: string | number | Date | null | undefined,
  timezone?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = safeParseDate(input);
  if (!d) return "-";

  const tz = getResolvedTimezone(timezone);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  };

  try {
    return new Intl.DateTimeFormat("en-US", defaultOptions).format(d);
  } catch (e) {
    return d.toLocaleTimeString();
  }
}

/**
 * Formats a date into a complete localized date & time string in the target timezone
 * Example: "Aug 21, 2026, 01:45 PM"
 */
export function formatDateTime(
  input: string | number | Date | null | undefined,
  timezone?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = safeParseDate(input);
  if (!d) return "-";

  const tz = getResolvedTimezone(timezone);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  };

  try {
    return new Intl.DateTimeFormat("en-US", defaultOptions).format(d);
  } catch (e) {
    return d.toLocaleString();
  }
}

/**
 * Returns today's date formatted as YYYY-MM-DD in the target timezone.
 * Critical for input[type="date"] and daily sales aggregations without UTC day drift.
 */
export function getTodayDateString(timezone?: string | null): string {
  const tz = getResolvedTimezone(timezone);
  const now = new Date();

  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(now); // en-CA produces YYYY-MM-DD
  } catch (e) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

/**
 * Formats any date into YYYY-MM-DD string in the target timezone.
 * Critical for reliable date matching across UTC database records and local time.
 */
export function getDateStringInTimezone(
  input: string | number | Date | null | undefined,
  timezone?: string | null
): string {
  const d = safeParseDate(input);
  if (!d) return "";

  const tz = getResolvedTimezone(timezone);
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(d); // produces YYYY-MM-DD
  } catch (e) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}

/**
 * Checks if a given timestamp falls on "Today" in the target business timezone.
 */
export function isTodayInTimezone(
  input: string | number | Date | null | undefined,
  timezone?: string | null
): boolean {
  if (!input) return false;
  const dateStr = getDateStringInTimezone(input, timezone);
  const todayStr = getTodayDateString(timezone);
  return dateStr === todayStr;
}

/**
 * Checks if a given timestamp falls within the last N days in the target business timezone.
 */
export function isWithinDaysInTimezone(
  input: string | number | Date | null | undefined,
  days: number,
  timezone?: string | null
): boolean {
  const d = safeParseDate(input);
  if (!d) return false;
  const now = new Date();
  
  // Calculate difference in milliseconds
  const diffMs = now.getTime() - d.getTime();
  const daysInMs = days * 24 * 60 * 60 * 1000;
  return diffMs >= -300000 && diffMs <= daysInMs;
}

/**
 * Get current preview of date and time in the specified timezone
 */
export function getCurrentTimezonePreview(timezone?: string | null): {
  time: string;
  date: string;
  resolvedTimezone: string;
} {
  const tz = getResolvedTimezone(timezone);
  const now = new Date();

  return {
    time: formatTime(now, tz, { second: "2-digit" }),
    date: formatDate(now, tz, { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    resolvedTimezone: tz,
  };
}
