/**
 * Calendar Models and Validation - Microsoft Graph Calendar Integration
 * 
 * Provides TypeScript interfaces, validation logic, and transformation
 * functions for calendar event data from Microsoft Graph API.
 */

/**
 * Response status for calendar events
 */
export type ResponseStatus = "none" | "accepted" | "declined" | "tentative";

/**
 * Internal calendar event model (matches database schema)
 */
export interface CalendarEvent {
  /** Internal database ID */
  id: string;
  
  /** Unique Microsoft Graph event ID */
  graph_event_id: string;
  
  /** Event subject/title */
  subject: string;
  
  /** Event start date and time */
  start_at: Date;
  
  /** Event end date and time */
  end_at: Date;
  
  /** IANA timezone identifier */
  timezone: string;
  
  /** Event location */
  location: string | null;
  
  /** Event organizer */
  organiser: string | null;
  
  /** User's response to the event */
  response_status: ResponseStatus;
  
  /** Whether event is cancelled */
  is_cancelled: boolean;
  
  /** Event body preview */
  body_preview: string | null;
  
  /** First time seen during sync */
  first_seen_at: Date;
  
  /** Last time seen during sync */
  last_seen_at: Date;
}

/**
 * Microsoft Graph calendar event response structure
 */
export interface GraphCalendarEvent {
  id: string;
  subject?: string;
  start?: {
    dateTime: string;
    timeZone?: string;
  };
  end?: {
    dateTime: string;
    timeZone?: string;
  };
  location?: {
    displayName?: string;
  };
  organizer?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  responseStatus?: {
    response?: string;
  };
  isCancelled?: boolean;
  bodyPreview?: string;
}

/**
 * Calendar event creation input
 */
export interface CreateCalendarEventInput {
  graph_event_id: string;
  subject: string;
  start_at: Date;
  end_at: Date;
  timezone: string;
  location?: string | null;
  organiser?: string | null;
  response_status?: ResponseStatus;
  is_cancelled?: boolean;
  body_preview?: string | null;
}

/**
 * Calendar event update input
 */
export interface UpdateCalendarEventInput {
  subject?: string;
  start_at?: Date;
  end_at?: Date;
  timezone?: string;
  location?: string | null;
  organiser?: string | null;
  response_status?: ResponseStatus;
  is_cancelled?: boolean;
  body_preview?: string | null;
  last_seen_at?: Date;
}

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
 * Validate response status
 */
export function validateResponseStatus(status: string | undefined): ResponseStatus {
  const normalized = status?.toLowerCase();
  
  switch (normalized) {
    case "accepted":
      return "accepted";
    case "declined": 
      return "declined";
    case "tentative":
      return "tentative";
    case "none":
    case "":
    case undefined:
    case null:
      return "none";
    default:
      console.warn(`Unknown response status: ${status}, defaulting to none`);
      return "none";
  }
}

/**
 * Validate and normalize event subject
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
 * Validate Graph event ID
 */
export function validateGraphEventId(id: string): string {
  if (!id || typeof id !== "string") {
    throw new CalendarValidationError("Graph event ID is required", "graph_event_id", id);
  }
  
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    throw new CalendarValidationError("Graph event ID cannot be empty", "graph_event_id", id);
  }
  
  return trimmed;
}

/**
 * Validate and parse datetime with timezone
 */
export function validateDateTime(
  dateTimeStr: string | undefined,
  timezone: string | undefined,
  fieldName: string
): { date: Date; timezone: string } {
  if (!dateTimeStr || typeof dateTimeStr !== "string") {
    throw new CalendarValidationError(`${fieldName} datetime is required`, fieldName, dateTimeStr);
  }
  
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) {
    throw new CalendarValidationError(`Invalid ${fieldName} datetime format`, fieldName, dateTimeStr);
  }
  
  // Default to UTC if no timezone provided
  const validTimezone = timezone && timezone.trim() ? timezone.trim() : "UTC";
  
  // Basic timezone validation (can be enhanced)
  if (!isValidTimezone(validTimezone)) {
    console.warn(`Invalid timezone ${validTimezone}, using UTC`);
    return { date, timezone: "UTC" };
  }
  
  return { date, timezone: validTimezone };
}

/**
 * Validate IANA timezone identifier (basic validation)
 */
export function isValidTimezone(timezone: string): boolean {
  // Basic validation - can be enhanced with full IANA timezone list
  const validPatterns = [
    /^UTC$/,
    /^[A-Za-z]+\/[A-Za-z_]+$/,  // e.g., America/New_York
    /^[A-Za-z]+\/[A-Za-z_]+\/[A-Za-z_]+$/,  // e.g., America/Argentina/Buenos_Aires
    /^GMT[+-]\d{1,2}$/  // e.g., GMT+2
  ];
  
  return validPatterns.some(pattern => pattern.test(timezone));
}

/**
 * Validate event timing constraints
 */
export function validateEventTiming(startAt: Date, endAt: Date): void {
  if (startAt >= endAt) {
    throw new CalendarValidationError(
      "Event start time must be before end time",
      "timing",
      { startAt: startAt.toISOString(), endAt: endAt.toISOString() }
    );
  }
  
  // Additional validation: events should not be longer than 30 days
  const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  if (endAt.getTime() - startAt.getTime() > maxDuration) {
    throw new CalendarValidationError(
      "Event duration cannot exceed 30 days",
      "timing",
      { startAt: startAt.toISOString(), endAt: endAt.toISOString() }
    );
  }
}

/**
 * Transform Microsoft Graph event to internal model
 */
export function transformGraphEvent(graphEvent: GraphCalendarEvent): CreateCalendarEventInput {
  try {
    // Validate and extract required fields
    const graphEventId = validateGraphEventId(graphEvent.id);
    const subject = validateSubject(graphEvent.subject);
    
    // Parse start datetime and timezone
    if (!graphEvent.start?.dateTime) {
      throw new CalendarValidationError("Event start datetime is required", "start", graphEvent.start);
    }
    
    const startInfo = validateDateTime(
      graphEvent.start.dateTime,
      graphEvent.start.timeZone,
      "start"
    );
    
    // Parse end datetime and timezone  
    if (!graphEvent.end?.dateTime) {
      throw new CalendarValidationError("Event end datetime is required", "end", graphEvent.end);
    }
    
    const endInfo = validateDateTime(
      graphEvent.end.dateTime,
      graphEvent.end.timeZone,
      "end"
    );
    
    // Validate timing constraints
    validateEventTiming(startInfo.date, endInfo.date);
    
    // Use start timezone as primary (most common pattern)
    const timezone = startInfo.timezone;
    
    // Process optional fields
    const location = graphEvent.location?.displayName?.trim() || null;
    const organiser = graphEvent.organizer?.emailAddress?.name?.trim() || 
                     graphEvent.organizer?.emailAddress?.address?.trim() || null;
    const responseStatus = validateResponseStatus(graphEvent.responseStatus?.response);
    const isCancelled = Boolean(graphEvent.isCancelled);
    const bodyPreview = graphEvent.bodyPreview?.trim() || null;
    
    return {
      graph_event_id: graphEventId,
      subject: subject,
      start_at: startInfo.date,
      end_at: endInfo.date,
      timezone: timezone,
      location: location,
      organiser: organiser,
      response_status: responseStatus,
      is_cancelled: isCancelled,
      body_preview: bodyPreview
    };
    
  } catch (error) {
    if (error instanceof CalendarValidationError) {
      throw error;
    }
    
    throw new CalendarValidationError(
      `Failed to transform Graph event: ${error instanceof Error ? error.message : "Unknown error"}`,
      "transform",
      graphEvent
    );
  }
}

/**
 * Validate complete calendar event input
 */
export function validateCalendarEventInput(input: CreateCalendarEventInput): CreateCalendarEventInput {
  const validated: CreateCalendarEventInput = {
    graph_event_id: validateGraphEventId(input.graph_event_id),
    subject: validateSubject(input.subject),
    start_at: input.start_at,
    end_at: input.end_at,
    timezone: input.timezone,
    location: input.location?.trim() || null,
    organiser: input.organiser?.trim() || null,
    response_status: input.response_status || "none",
    is_cancelled: Boolean(input.is_cancelled),
    body_preview: input.body_preview?.trim() || null
  };
  
  // Validate timing constraints
  validateEventTiming(validated.start_at, validated.end_at);
  
  // Validate timezone
  if (!isValidTimezone(validated.timezone)) {
    throw new CalendarValidationError("Invalid timezone identifier", "timezone", validated.timezone);
  }
  
  return validated;
}

/**
 * Create calendar event database record
 */
export function createCalendarEventRecord(input: CreateCalendarEventInput): CalendarEvent {
  const validated = validateCalendarEventInput(input);
  const now = new Date();
  
  return {
    id: crypto.randomUUID(),
    graph_event_id: validated.graph_event_id,
    subject: validated.subject,
    start_at: validated.start_at,
    end_at: validated.end_at,
    timezone: validated.timezone,
    location: validated.location ?? null,
    organiser: validated.organiser ?? null,
    response_status: validated.response_status ?? "none",
    is_cancelled: validated.is_cancelled ?? false,
    body_preview: validated.body_preview ?? null,
    first_seen_at: now,
    last_seen_at: now
  };
}

/**
 * Calendar repository interface for database operations
 */
export interface CalendarRepository {
  create(event: CalendarEvent): Promise<void>;
  findByGraphId(graphEventId: string): Promise<CalendarEvent | null>;
  updateLastSeen(graphEventId: string, timestamp: Date): Promise<void>;
  update(graphEventId: string, updates: UpdateCalendarEventInput): Promise<void>;
  findByDateRange(startDate: Date, endDate: Date, limit?: number, offset?: number): Promise<CalendarEvent[]>;
  findToday(limit?: number, offset?: number): Promise<CalendarEvent[]>;
  findUpcoming(days: number, limit?: number, offset?: number): Promise<CalendarEvent[]>;
  count(): Promise<number>;
  countByDateRange(startDate: Date, endDate: Date): Promise<number>;
}

/**
 * Batch calendar processing result
 */
export interface CalendarBatchResult {
  processed: number;
  created: number;
  updated: number;
  errors: number;
  errorMessages: string[];
}

/**
 * Process batch of Graph events with deduplication
 */
export async function processBatchEvents(
  graphEvents: GraphCalendarEvent[],
  repository: CalendarRepository
): Promise<CalendarBatchResult> {
  const result: CalendarBatchResult = {
    processed: 0,
    created: 0,
    updated: 0,
    errors: 0,
    errorMessages: []
  };
  
  for (const graphEvent of graphEvents) {
    try {
      result.processed++;
      
      // Transform Graph event to internal format
      const eventInput = transformGraphEvent(graphEvent);
      
      // Check if event already exists
      const existing = await repository.findByGraphId(eventInput.graph_event_id);
      
      if (existing) {
        // Update existing event
        await repository.updateLastSeen(eventInput.graph_event_id, new Date());
        
        // Check if we need to update other fields (subject, timing, etc.)
        const updates: UpdateCalendarEventInput = {
          subject: eventInput.subject,
          start_at: eventInput.start_at,
          end_at: eventInput.end_at,
          timezone: eventInput.timezone,
          location: eventInput.location,
          organiser: eventInput.organiser,
          response_status: eventInput.response_status,
          is_cancelled: eventInput.is_cancelled,
          body_preview: eventInput.body_preview,
          last_seen_at: new Date()
        };
        
        await repository.update(eventInput.graph_event_id, updates);
        result.updated++;
      } else {
        // Create new event
        const eventRecord = createCalendarEventRecord(eventInput);
        await repository.create(eventRecord);
        result.created++;
      }
      
    } catch (error) {
      result.errors++;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      result.errorMessages.push(`Event ${graphEvent.id}: ${errorMsg}`);
      console.error("Failed to process calendar event:", error);
    }
  }
  
  return result;
}

/**
 * Filter events for today
 */
export function filterTodayEvents(events: CalendarEvent[]): CalendarEvent[] {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  
  return events.filter(event => 
    !event.is_cancelled &&
    event.start_at < endOfDay &&
    event.end_at > startOfDay
  );
}

/**
 * Filter events for next N days
 */
export function filterUpcomingEvents(events: CalendarEvent[], days: number): CalendarEvent[] {
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + days);
  
  return events.filter(event =>
    !event.is_cancelled &&
    event.start_at > now &&
    event.start_at < futureDate
  ).sort((a, b) => a.start_at.getTime() - b.start_at.getTime());
}
