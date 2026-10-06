/**
 * Google Calendar API Client
 *
 * Retrieves and creates calendar events using the Google Calendar REST API.
 * Implements complete pagination, retry logic, and rate-limit handling.
 */

import { Environment } from '../index';
import { TokenStorage } from '../auth/tokens';
import { GoogleOAuthHandler } from './auth';
import { RetrievalStatus } from './gmail';

export interface CalendarEvent {
  id: string;               // Google event ID (used as graph_event_id equivalent)
  subject: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  location: string;
  organiser: string;
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction' | 'none';
  isCancelled: boolean;
  bodyPreview: string;
}

export interface CalendarRetrievalResult {
  status: RetrievalStatus;
  items: CalendarEvent[];
  itemsChecked: number;
  pagesChecked: number;
  paginationComplete: boolean;
  error?: string;
}

export interface CreateEventInput {
  subject: string;
  startTime: string;    // ISO 8601 e.g. 2026-10-07T09:00:00
  endTime: string;
  timezone: string;     // IANA e.g. Africa/Johannesburg
  location?: string;
  body?: string;
  attendees?: string[]; // email addresses
}

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';
const MAX_RESULTS_PER_PAGE = 250;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Google Calendar API client for a single authenticated user
 */
export class GoogleCalendarClient {
  private readonly tokenStorage: TokenStorage;
  private readonly oauthHandler: GoogleOAuthHandler;

  constructor(env: Environment) {
    this.tokenStorage = new TokenStorage(env);
    this.oauthHandler = new GoogleOAuthHandler(env);
  }

  /**
   * Fetch upcoming events from the primary calendar, paginating fully.
   * @param timeMin  - start of range (defaults to now)
   * @param timeMax  - end of range (defaults to 30 days from now)
   */
  async getEvents(timeMin?: Date, timeMax?: Date): Promise<CalendarRetrievalResult> {
    const items: CalendarEvent[] = [];
    let pagesChecked = 0;
    let pageToken: string | undefined;

    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        return {
          status: 'unauthorized',
          items: [],
          itemsChecked: 0,
          pagesChecked: 0,
          paginationComplete: false,
          error: 'No valid access token - re-authentication required',
        };
      }

      const min = (timeMin ?? new Date()).toISOString();
      const max = (timeMax ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).toISOString();

      do {
        const url = new URL(`${CALENDAR_BASE}/calendars/primary/events`);
        url.searchParams.set('maxResults', String(MAX_RESULTS_PER_PAGE));
        url.searchParams.set('timeMin', min);
        url.searchParams.set('timeMax', max);
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('orderBy', 'startTime');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const response = await this.fetchWithRetry(url.toString(), accessToken);

        if (!response.ok) {
          const status = this.mapHttpStatus(response.status);
          return {
            status,
            items,
            itemsChecked: items.length,
            pagesChecked,
            paginationComplete: false,
            error: `Calendar API error: ${response.status}`,
          };
        }

        const data = await response.json() as any;
        pagesChecked++;

        for (const item of data.items ?? []) {
          const event = this.parseEvent(item);
          if (event) items.push(event);
        }

        pageToken = data.nextPageToken ?? undefined;

      } while (pageToken);

      return {
        status: 'complete',
        items,
        itemsChecked: items.length,
        pagesChecked,
        paginationComplete: true,
      };

    } catch (error) {
      return {
        status: 'failed',
        items,
        itemsChecked: items.length,
        pagesChecked,
        paginationComplete: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a new event on the primary calendar
   */
  async createEvent(input: CreateEventInput): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) return { success: false, error: 'No valid access token' };

      const body: any = {
        summary: input.subject,
        start: { dateTime: input.startTime, timeZone: input.timezone },
        end: { dateTime: input.endTime, timeZone: input.timezone },
      };

      if (input.location) body.location = input.location;
      if (input.body) body.description = input.body;
      if (input.attendees?.length) {
        body.attendees = input.attendees.map(email => ({ email }));
      }

      const response = await fetch(`${CALENDAR_BASE}/calendars/primary/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, error: `Create event failed: ${response.status} ${err}` };
      }

      const data = await response.json() as any;
      return { success: true, eventId: data.id };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Create event failed' };
    }
  }

  /**
   * Update an existing event on the primary calendar
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CreateEventInput>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) return { success: false, error: 'No valid access token' };

      // Fetch current event first to verify it exists
      const getResponse = await fetch(`${CALENDAR_BASE}/calendars/primary/events/${eventId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!getResponse.ok) {
        return { success: false, error: `Event not found: ${eventId}` };
      }

      const patch: any = {};
      if (updates.subject) patch.summary = updates.subject;
      if (updates.location) patch.location = updates.location;
      if (updates.body) patch.description = updates.body;
      if (updates.startTime && updates.timezone) {
        patch.start = { dateTime: updates.startTime, timeZone: updates.timezone };
      }
      if (updates.endTime && updates.timezone) {
        patch.end = { dateTime: updates.endTime, timeZone: updates.timezone };
      }

      const response = await fetch(`${CALENDAR_BASE}/calendars/primary/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, error: `Update event failed: ${response.status} ${err}` };
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Update event failed' };
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private parseEvent(item: any): CalendarEvent | null {
    try {
      // Skip declined or cancelled events if desired — we keep them for full picture
      const isCancelled = item.status === 'cancelled';

      const start = item.start?.dateTime ?? item.start?.date;
      const end = item.end?.dateTime ?? item.end?.date;
      const timezone = item.start?.timeZone ?? 'UTC';

      const organiser = item.organizer?.email ?? '';

      // Self-response status
      const selfAttendee = (item.attendees ?? []).find((a: any) => a.self);
      const responseStatus = selfAttendee?.responseStatus ?? 'none';

      return {
        id: item.id,
        subject: item.summary ?? '(no title)',
        startAt: new Date(start),
        endAt: new Date(end),
        timezone,
        location: item.location ?? '',
        organiser,
        responseStatus: responseStatus as CalendarEvent['responseStatus'],
        isCancelled,
        bodyPreview: item.description ?? '',
      };
    } catch {
      return null;
    }
  }

  private async fetchWithRetry(url: string, accessToken: string, attempt = 1): Promise<Response> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      await this.sleep(RETRY_DELAY_MS * attempt);
      return this.fetchWithRetry(url, accessToken, attempt + 1);
    }

    return response;
  }

  private mapHttpStatus(status: number): RetrievalStatus {
    if (status === 401 || status === 403) return 'unauthorized';
    if (status === 429) return 'rate_limited';
    if (status >= 500) return 'source_unavailable';
    return 'failed';
  }

  private async getValidAccessToken(): Promise<string | null> {
    const valid = await this.oauthHandler.validateTokens();
    if (!valid) return null;
    return this.tokenStorage.getAccessToken();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
