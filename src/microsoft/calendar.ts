/**
 * Calendar Event Endpoints - Calendar Event Management
 * 
 * Provides secure endpoints for creating and updating calendar events
 * with proper validation and audit logging.
 */


/**
 * Calendar event creation input interface
 */
export interface CreateCalendarEventInput {
  subject: string;
  startTime: string;  // ISO 8601 datetime string
  endTime: string;    // ISO 8601 datetime string
  timezone: string;   // IANA timezone identifier
  location?: string;
  body?: string;
  attendees?: string[];
  isAllDay?: boolean;
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere";
  sensitivity?: "normal" | "personal" | "private" | "confidential";
}

/**
 * Calendar event update input interface
 */
export interface UpdateCalendarEventInput {
  subject?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  location?: string;
  body?: string;
  attendees?: string[];
  isAllDay?: boolean;
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere";
  sensitivity?: "normal" | "personal" | "private" | "confidential";
}

/**
 * Calendar event operation result
 */
export interface CalendarEventResult {
  success: boolean;
  eventId?: string;
  webLink?: string;
  error?: string;
}

/**
 * Calendar Event Handler
 */
export class CalendarEventHandler {
  private readonly env: Environment;
  private readonly graphClient: GraphClient;

  constructor(env: Environment) {
    this.env = env;
    this.graphClient = new GraphClient(env);
  }

  /**
   * Handle POST /calendar/events - Create new calendar event
   */
  async handleCreateEvent(request: Request): Promise<Response> {
    try {
      const eventInput = await this.parseAndValidateCreateEvent(request);
      const result = await this.createCalendarEvent(eventInput);
      
      // Log event creation to audit trail
      await auditLog(this.env.DB, {
        operation: "create",
        resourceType: "calendar_event",
        resourceId: result.eventId || null,
        result: result.success ? "success" : "failure",
        requestedBy: "api",
        details: {
          action: "create_calendar_event",
          subject: eventInput.subject,
          startTime: eventInput.startTime,
          endTime: eventInput.endTime,
          timezone: eventInput.timezone,
          attendeeCount: eventInput.attendees?.length || 0,
          error: result.error
        }
      });
      
      if (result.success) {
        return new Response(
          JSON.stringify({
            success: true,
            eventId: result.eventId,
            webLink: result.webLink,
            message: "Calendar event created successfully"
          }),
          { 
            status: 201,
            headers: { "Content-Type": "application/json" }
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: result.error
          }),
          { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      
    } catch (error) {
      return this.handleError(error, "Calendar event creation failed");
    }
  }

  /**
   * Handle PATCH /calendar/events/:id - Update existing calendar event
   */
  async handleUpdateEvent(request: Request, eventId: string): Promise<Response> {
    try {
      const updateInput = await this.parseAndValidateUpdateEvent(request);
      const result = await this.updateCalendarEvent(eventId, updateInput);
      
      // Log event update to audit trail
      await auditLog(this.env.DB, {
        operation: "update",
        resourceType: "calendar_event",
        resourceId: eventId,
        result: result.success ? "success" : "failure",
        requestedBy: "api",
        details: {
          action: "update_calendar_event",
          eventId: eventId,
          updatedFields: Object.keys(updateInput),
          error: result.error
        }
      });
      
      if (result.success) {
        return new Response(
          JSON.stringify({
            success: true,
            eventId: eventId,
            webLink: result.webLink,
            message: "Calendar event updated successfully"
          }),
          { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: result.error
          }),
          { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      
    } catch (error) {
      return this.handleError(error, "Calendar event update failed");
    }
  }

  /**
   * Create calendar event via Microsoft Graph
   */
  private async createCalendarEvent(eventInput: CreateCalendarEventInput): Promise<CalendarEventResult> {
    try {
      // Transform to Microsoft Graph event format
      const graphEvent = this.transformToGraphEvent(eventInput);

      // Create event via Microsoft Graph
      const createResult = await this.graphClient.createCalendarEvent(graphEvent);
      
      if (createResult.success) {
        return {
          success: true,
          eventId: createResult.id,
          webLink: `https://outlook.office.com/calendar/`
        };
      } else {
        return {
          success: false,
          error: createResult.error?.message || "Calendar event creation failed"
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Update calendar event via Microsoft Graph
   */
  private async updateCalendarEvent(eventId: string, updateInput: UpdateCalendarEventInput): Promise<CalendarEventResult> {
    try {
      // First, verify the event exists (requirement 10.2)
      const existingEvent = await this.getExistingEvent(eventId);
      if (!existingEvent) {
        return {
          success: false,
          error: "Calendar event not found"
        };
      }

      // Transform update input to Microsoft Graph format
      const graphUpdate = this.transformUpdateToGraphEvent(updateInput);

      // Update event via Microsoft Graph
      const updateResult = await this.graphClient.updateCalendarEvent(eventId, graphUpdate);
      
      if (updateResult.success) {
        return {
          success: true,
          webLink: `https://outlook.office.com/calendar/`
        };
      } else {
        return {
          success: false,
          error: updateResult.error?.message || "Calendar event update failed"
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Get existing calendar event to verify ID (requirement 10.2)
   */
  private async getExistingEvent(eventId: string): Promise<any> {
    try {
      const result = await this.graphClient.getCalendarEvent(eventId);
      if (result.success) {
        return result.event;
      } else {
        console.error("Failed to get existing event:", result.error);
        return null;
      }
    } catch (error) {
      console.error("Failed to get existing event:", error);
      return null;
    }
  }

  /**
   * Transform input to Microsoft Graph event format
   */
  private transformToGraphEvent(eventInput: CreateCalendarEventInput): any {
    const graphEvent: any = {
      subject: eventInput.subject,
      body: {
        contentType: "HTML",
        content: eventInput.body || ""
      },
      start: {
        dateTime: eventInput.startTime,
        timeZone: eventInput.timezone
      },
      end: {
        dateTime: eventInput.endTime,
        timeZone: eventInput.timezone
      },
      isAllDay: Boolean(eventInput.isAllDay),
      showAs: eventInput.showAs || "busy",
      sensitivity: eventInput.sensitivity || "normal"
    };

    // Add location if provided
    if (eventInput.location) {
      graphEvent.location = {
        displayName: eventInput.location
      };
    }

    // Add attendees if provided
    if (eventInput.attendees && eventInput.attendees.length > 0) {
      graphEvent.attendees = eventInput.attendees.map(email => ({
        emailAddress: {
          address: email.trim(),
          name: email.trim()
        },
        type: "required"
      }));
    }

    return graphEvent;
  }

  /**
   * Transform update input to Microsoft Graph event format
   */
  private transformUpdateToGraphEvent(updateInput: UpdateCalendarEventInput): any {
    const graphUpdate: any = {};

    if (updateInput.subject !== undefined) {
      graphUpdate.subject = updateInput.subject;
    }

    if (updateInput.body !== undefined) {
      graphUpdate.body = {
        contentType: "HTML",
        content: updateInput.body
      };
    }

    if (updateInput.startTime !== undefined && updateInput.timezone !== undefined) {
      graphUpdate.start = {
        dateTime: updateInput.startTime,
        timeZone: updateInput.timezone
      };
    }

    if (updateInput.endTime !== undefined && updateInput.timezone !== undefined) {
      graphUpdate.end = {
        dateTime: updateInput.endTime,
        timeZone: updateInput.timezone
      };
    }

    if (updateInput.location !== undefined) {
      graphUpdate.location = {
        displayName: updateInput.location
      };
    }

    if (updateInput.isAllDay !== undefined) {
      graphUpdate.isAllDay = updateInput.isAllDay;
    }

    if (updateInput.showAs !== undefined) {
      graphUpdate.showAs = updateInput.showAs;
    }

    if (updateInput.sensitivity !== undefined) {
      graphUpdate.sensitivity = updateInput.sensitivity;
    }

    if (updateInput.attendees !== undefined) {
      graphUpdate.attendees = updateInput.attendees.map(email => ({
        emailAddress: {
          address: email.trim(),
          name: email.trim()
        },
        type: "required"
      }));
    }

    return graphUpdate;
  }

  /**
   * Parse and validate calendar event creation input
   */
  private async parseAndValidateCreateEvent(request: Request): Promise<CreateCalendarEventInput> {
    let body: any;
    
    try {
      body = await request.json();
    } catch (error) {
      throw new CalendarValidationError("Invalid JSON in request body", "body", body);
    }

    // Validate required fields (requirement 10.1)
    if (!body.subject || typeof body.subject !== "string") {
      throw new CalendarValidationError("Subject is required and must be a string", "subject", body.subject);
    }

    if (!body.startTime || typeof body.startTime !== "string") {
      throw new CalendarValidationError("Start time is required and must be an ISO 8601 string", "startTime", body.startTime);
    }

    if (!body.endTime || typeof body.endTime !== "string") {
      throw new CalendarValidationError("End time is required and must be an ISO 8601 string", "endTime", body.endTime);
    }

    if (!body.timezone || typeof body.timezone !== "string") {
      throw new CalendarValidationError("Timezone is required and must be an IANA timezone identifier", "timezone", body.timezone);
    }

    // Validate subject
    const subject = validateSubject(body.subject);

    // Validate timezone
    if (!isValidTimezone(body.timezone.trim())) {
      throw new CalendarValidationError("Invalid timezone identifier", "timezone", body.timezone);
    }
    const timezone = body.timezone.trim();

    // Validate and parse datetime fields
    const startInfo = validateDateTime(body.startTime, timezone, "startTime");
    const endInfo = validateDateTime(body.endTime, timezone, "endTime");

    // Validate timing constraints (requirement 10.5)
    validateEventTiming(startInfo.date, endInfo.date);

    // Validate optional fields
    const location = body.location && typeof body.location === "string" ? body.location.trim() : undefined;
    const bodyContent = body.body && typeof body.body === "string" ? body.body.trim() : undefined;
    const isAllDay = body.isAllDay !== undefined ? Boolean(body.isAllDay) : false;

    // Validate attendees if provided
    let attendees: string[] | undefined = undefined;
    if (body.attendees) {
      if (!Array.isArray(body.attendees)) {
        throw new CalendarValidationError("Attendees must be an array of email addresses", "attendees", body.attendees);
      }
      attendees = this.validateEmailList(body.attendees, "attendees");
    }

    // Validate showAs enum
    const validShowAs = ["free", "tentative", "busy", "oof", "workingElsewhere"];
    if (body.showAs && !validShowAs.includes(body.showAs)) {
      throw new CalendarValidationError(`ShowAs must be one of: ${validShowAs.join(", ")}`, "showAs", body.showAs);
    }

    // Validate sensitivity enum
    const validSensitivity = ["normal", "personal", "private", "confidential"];
    if (body.sensitivity && !validSensitivity.includes(body.sensitivity)) {
      throw new CalendarValidationError(`Sensitivity must be one of: ${validSensitivity.join(", ")}`, "sensitivity", body.sensitivity);
    }

    return {
      subject,
      startTime: body.startTime,
      endTime: body.endTime,
      timezone,
      location,
      body: bodyContent,
      attendees,
      isAllDay,
      showAs: body.showAs,
      sensitivity: body.sensitivity
    };
  }

  /**
   * Parse and validate calendar event update input
   */
  private async parseAndValidateUpdateEvent(request: Request): Promise<UpdateCalendarEventInput> {
    let body: any;
    
    try {
      body = await request.json();
    } catch (error) {
      throw new CalendarValidationError("Invalid JSON in request body", "body", body);
    }

    const updateInput: UpdateCalendarEventInput = {};

    // Validate subject if provided
    if (body.subject !== undefined) {
      if (typeof body.subject !== "string") {
        throw new CalendarValidationError("Subject must be a string", "subject", body.subject);
      }
      updateInput.subject = validateSubject(body.subject);
    }

    // Validate timezone if provided (needed for time validation)
    let timezone: string | undefined = undefined;
    if (body.timezone !== undefined) {
      if (typeof body.timezone !== "string") {
        throw new CalendarValidationError("Timezone must be a string", "timezone", body.timezone);
      }
      if (!isValidTimezone(body.timezone.trim())) {
        throw new CalendarValidationError("Invalid timezone identifier", "timezone", body.timezone);
      }
      timezone = body.timezone.trim();
      updateInput.timezone = timezone;
    }

    // Validate datetime fields if provided
    if (body.startTime !== undefined || body.endTime !== undefined) {
      // If either time field is provided, timezone must also be provided or already exist
      if (body.timezone === undefined) {
        throw new CalendarValidationError(
          "Timezone is required when updating start or end times", 
          "timezone", 
          body.timezone
        );
      }
    }

    if (body.startTime !== undefined) {
      if (typeof body.startTime !== "string") {
        throw new CalendarValidationError("Start time must be an ISO 8601 string", "startTime", body.startTime);
      }
      const startInfo = validateDateTime(body.startTime, timezone, "startTime");
      updateInput.startTime = body.startTime;
    }

    if (body.endTime !== undefined) {
      if (typeof body.endTime !== "string") {
        throw new CalendarValidationError("End time must be an ISO 8601 string", "endTime", body.endTime);
      }
      const endInfo = validateDateTime(body.endTime, timezone, "endTime");
      updateInput.endTime = body.endTime;
    }

    // Validate timing if both start and end are provided
    if (updateInput.startTime && updateInput.endTime) {
      const startDate = new Date(updateInput.startTime);
      const endDate = new Date(updateInput.endTime);
      validateEventTiming(startDate, endDate);
    }

    // Validate optional fields
    if (body.location !== undefined) {
      updateInput.location = typeof body.location === "string" ? body.location.trim() : "";
    }

    if (body.body !== undefined) {
      updateInput.body = typeof body.body === "string" ? body.body.trim() : "";
    }

    if (body.isAllDay !== undefined) {
      updateInput.isAllDay = Boolean(body.isAllDay);
    }

    // Validate attendees if provided
    if (body.attendees !== undefined) {
      if (!Array.isArray(body.attendees)) {
        throw new CalendarValidationError("Attendees must be an array of email addresses", "attendees", body.attendees);
      }
      updateInput.attendees = this.validateEmailList(body.attendees, "attendees");
    }

    // Validate enums if provided
    const validShowAs = ["free", "tentative", "busy", "oof", "workingElsewhere"];
    if (body.showAs !== undefined && !validShowAs.includes(body.showAs)) {
      throw new CalendarValidationError(`ShowAs must be one of: ${validShowAs.join(", ")}`, "showAs", body.showAs);
    }
    if (body.showAs !== undefined) {
      updateInput.showAs = body.showAs;
    }

    const validSensitivity = ["normal", "personal", "private", "confidential"];
    if (body.sensitivity !== undefined && !validSensitivity.includes(body.sensitivity)) {
      throw new CalendarValidationError(`Sensitivity must be one of: ${validSensitivity.join(", ")}`, "sensitivity", body.sensitivity);
    }
    if (body.sensitivity !== undefined) {
      updateInput.sensitivity = body.sensitivity;
    }

    return updateInput;
  }

  /**
   * Validate email list for attendees
   */
  private validateEmailList(emails: any[], fieldName: string): string[] {
    return emails.map((email, index) => {
      if (typeof email !== "string") {
        throw new CalendarValidationError(`${fieldName}[${index}] must be a string`, fieldName, email);
      }
      
      const trimmed = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!emailRegex.test(trimmed)) {
        throw new CalendarValidationError(`Invalid email format: ${email}`, fieldName, email);
      }
      
      return trimmed;
    });
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: unknown, context: string): Response {
    console.error(`${context}:`, error);
    
    const message = error instanceof CalendarValidationError 
      ? error.message
      : (error instanceof Error ? error.message : "Unknown error");
    
    const status = error instanceof CalendarValidationError ? 400 : 500;
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: context,
        message: message,
        field: error instanceof CalendarValidationError ? error.field : undefined
      }),
      { 
        status,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}