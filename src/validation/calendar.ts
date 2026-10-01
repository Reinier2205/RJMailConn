/**
 * Calendar Validation - Calendar Event Validation Utilities
 * 
 * Provides validation functions for calendar event data including
 * date/time validation, timezone checking, and event timing constraints.
 */

/**
 * Calendar validation error
 */
export class CalendarValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = "CalendarValidationError";
  }
}

/**
 * Validate and normalize subject line
 */
export function validateSubject(subject: string | undefined | null): string {
  if (subject === null || subject === undefined) {
    return "";
  }
  
  if (typeof subject !== "string") {
    return String(subject).trim();
  }
  
  return subject.trim();
}

/**
 * Validate ISO 8601 datetime string
 */
export interface DateTimeValidationResult {
  date: Date;
  iso: string;
}

export function validateDateTime(
  dateTime: string,
  _timezone: string | undefined,
  fieldName: string
): DateTimeValidationResult {
  if (!dateTime || typeof dateTime !== "string") {
    throw new CalendarValidationError(
      `${fieldName} is required and must be an ISO 8601 string`,
      fieldName,
      dateTime
    );
  }
  
  const date = new Date(dateTime);
  if (isNaN(date.getTime())) {
    throw new CalendarValidationError(
      `${fieldName} has invalid datetime format`,
      fieldName,
      dateTime
    );
  }
  
  return {
    date,
    iso: dateTime
  };
}

/**
 * Validate event timing constraints (requirement 10.5)
 * - End time must be after start time
 * - Event duration must be reasonable (not negative, not excessively long)
 */
export function validateEventTiming(startDate: Date, endDate: Date): void {
  if (endDate <= startDate) {
    throw new CalendarValidationError(
      "End time must be after start time",
      "endTime",
      { startDate, endDate }
    );
  }
  
  // Check for reasonable duration (max 30 days)
  const durationMs = endDate.getTime() - startDate.getTime();
  const maxDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  if (durationMs > maxDurationMs) {
    throw new CalendarValidationError(
      "Event duration cannot exceed 30 days",
      "endTime",
      { startDate, endDate, durationDays: durationMs / (24 * 60 * 60 * 1000) }
    );
  }
}

/**
 * Common IANA timezone identifiers
 * This is a subset of commonly used timezones.
 * For production, consider using a library like Intl or moment-timezone
 */
const VALID_TIMEZONES = new Set([
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Stockholm",
  "Europe/Copenhagen",
  "Europe/Helsinki",
  "Europe/Oslo",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Manila",
  "Asia/Jakarta",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Honolulu",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi"
]);

/**
 * Validate IANA timezone identifier
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== "string") {
    return false;
  }
  
  const trimmed = timezone.trim();
  
  // Check against known timezone list
  if (VALID_TIMEZONES.has(trimmed)) {
    return true;
  }
  
  // Try to validate using Intl.DateTimeFormat if available
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch (error) {
    return false;
  }
}
