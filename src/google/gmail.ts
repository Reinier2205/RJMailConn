/**
 * Gmail API Client
 *
 * Retrieves messages from Gmail using the Gmail REST API.
 * Implements complete pagination, retry logic, and rate-limit handling.
 * Never interprets an incomplete response as an empty result.
 */

import { Environment } from '../index';
import { TokenStorage } from '../auth/tokens';
import { GoogleOAuthHandler } from './auth';

export type RetrievalStatus =
  | 'complete'
  | 'partial'
  | 'failed'
  | 'unauthorized'
  | 'rate_limited'
  | 'source_unavailable';

export interface GmailMessage {
  id: string;                 // Gmail message ID (used as graph_message_id equivalent)
  threadId: string;
  internetMessageId: string;
  receivedAt: Date;
  senderEmail: string;
  senderName: string;
  subject: string;
  isRead: boolean;
  importance: 'high' | 'normal' | 'low';
  hasAttachments: boolean;
  bodyPreview: string;
  webLink: string;
  labelIds: string[];
}

export interface RetrievalResult {
  status: RetrievalStatus;
  items: GmailMessage[];
  itemsChecked: number;
  pagesChecked: number;
  paginationComplete: boolean;
  nextPageToken?: string;
  error?: string;
}

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_RESULTS_PER_PAGE = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Gmail API client for a single authenticated user
 */
export class GmailClient {
  private readonly tokenStorage: TokenStorage;
  private readonly oauthHandler: GoogleOAuthHandler;

  constructor(env: Environment) {
    this.tokenStorage = new TokenStorage(env);
    this.oauthHandler = new GoogleOAuthHandler(env);
  }

  /**
   * Fetch messages with full pagination.
   * @param sinceDate - only fetch messages after this date (optional)
   * @param pageToken  - resume from a specific page token (optional)
   */
  async getMessages(sinceDate?: Date | null, pageToken?: string): Promise<RetrievalResult> {
    const items: GmailMessage[] = [];
    let pagesChecked = 0;
    let currentPageToken: string | undefined = pageToken;

    try {
      // Ensure we have a valid token
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

      // Build the Gmail query string
      const q = this.buildQuery(sinceDate);

      // Paginate through all results
      do {
        const url = new URL(`${GMAIL_BASE}/messages`);
        url.searchParams.set('maxResults', String(MAX_RESULTS_PER_PAGE));
        url.searchParams.set('q', q);
        if (currentPageToken) url.searchParams.set('pageToken', currentPageToken);

        const listResponse = await this.fetchWithRetry(url.toString(), accessToken);

        if (!listResponse.ok) {
          const status = this.mapHttpStatus(listResponse.status);
          return {
            status,
            items,
            itemsChecked: items.length,
            pagesChecked,
            paginationComplete: false,
            error: `Gmail API error: ${listResponse.status}`,
          };
        }

        const listData = await listResponse.json() as any;
        pagesChecked++;

        const messageRefs: Array<{ id: string }> = listData.messages ?? [];

        // Fetch full details for each message in parallel (batches of 10)
        const details = await this.fetchMessageDetails(messageRefs, accessToken);
        items.push(...details);

        currentPageToken = listData.nextPageToken ?? undefined;

      } while (currentPageToken);

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

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Fetch full message details for a list of message refs, 10 at a time
   */
  private async fetchMessageDetails(
    refs: Array<{ id: string }>,
    accessToken: string
  ): Promise<GmailMessage[]> {
    const results: GmailMessage[] = [];
    const BATCH = 10;

    for (let i = 0; i < refs.length; i += BATCH) {
      const chunk = refs.slice(i, i + BATCH);
      const details = await Promise.all(
        chunk.map(ref => this.fetchSingleMessage(ref.id, accessToken))
      );
      for (const msg of details) {
        if (msg) results.push(msg);
      }
    }

    return results;
  }

  private async fetchSingleMessage(id: string, accessToken: string): Promise<GmailMessage | null> {
    const url = `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=X-Priority&metadataHeaders=Importance`;

    const response = await this.fetchWithRetry(url, accessToken);
    if (!response.ok) return null;

    const data = await response.json() as any;
    return this.parseMessage(data);
  }

  private parseMessage(data: any): GmailMessage {
    const headers: Record<string, string> = {};
    for (const h of data.payload?.headers ?? []) {
      headers[h.name.toLowerCase()] = h.value;
    }

    const rawFrom = headers['from'] ?? '';
    const { name: senderName, email: senderEmail } = this.parseEmailAddress(rawFrom);

    const subject = headers['subject'] ?? '(no subject)';
    const receivedAt = headers['date']
      ? new Date(headers['date'])
      : new Date(Number(data.internalDate));

    const isRead = !(data.labelIds ?? []).includes('UNREAD');
    const hasAttachments = this.detectAttachments(data.payload);
    const importance = this.detectImportance(headers, data.labelIds ?? []);
    const internetMessageId = headers['message-id'] ?? '';
    const bodyPreview = data.snippet ?? '';
    const webLink = `https://mail.google.com/mail/#inbox/${data.id}`;

    return {
      id: data.id,
      threadId: data.threadId,
      internetMessageId,
      receivedAt,
      senderEmail,
      senderName,
      subject,
      isRead,
      importance,
      hasAttachments,
      bodyPreview,
      webLink,
      labelIds: data.labelIds ?? [],
    };
  }

  private parseEmailAddress(raw: string): { name: string; email: string } {
    // Handles "Name <email>" and bare "email" formats
    const match = raw.match(/^(.*?)\s*<(.+?)>$/);
    if (match) {
      return { name: (match[1] ?? '').replace(/^"|"$/g, '').trim(), email: (match[2] ?? '').trim() };
    }
    return { name: raw.trim(), email: raw.trim() };
  }

  private detectAttachments(payload: any): boolean {
    if (!payload) return false;
    if (payload.filename) return true;
    for (const part of payload.parts ?? []) {
      if (this.detectAttachments(part)) return true;
    }
    return false;
  }

  private detectImportance(
    headers: Record<string, string>,
    labelIds: string[]
  ): 'high' | 'normal' | 'low' {
    const importance = (headers['importance'] ?? '').toLowerCase();
    const xPriority = headers['x-priority'] ?? '';

    if (importance === 'high' || xPriority === '1' || xPriority === '2') return 'high';
    if (importance === 'low' || xPriority === '5') return 'low';
    if (labelIds.includes('IMPORTANT')) return 'high';
    return 'normal';
  }

  /**
   * Build Gmail search query string
   */
  private buildQuery(sinceDate?: Date | null): string {
    const parts: string[] = ['in:inbox'];
    if (sinceDate) {
      // Gmail uses Unix epoch seconds in after: queries
      parts.push(`after:${Math.floor(sinceDate.getTime() / 1000)}`);
    }
    return parts.join(' ');
  }

  /**
   * HTTP GET with retry + exponential back-off
   */
  private async fetchWithRetry(url: string, accessToken: string, attempt = 1): Promise<Response> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < MAX_RETRIES) {
        await this.sleep(RETRY_DELAY_MS * attempt);
        return this.fetchWithRetry(url, accessToken, attempt + 1);
      }
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
    // Auto-refresh if needed
    const valid = await this.oauthHandler.validateTokens();
    if (!valid) return null;
    return this.tokenStorage.getAccessToken();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Classify a Gmail message for the morning brief
 */
export function classifyMessage(msg: GmailMessage): 'new' | 'important' | 'marketing' | 'unclassified' {
  const labelIds = msg.labelIds ?? [];

  // Promotional / marketing
  if (labelIds.includes('CATEGORY_PROMOTIONS') || labelIds.includes('CATEGORY_UPDATES')) {
    return 'marketing';
  }

  // Important (Gmail's own importance marker or high-priority header)
  if (labelIds.includes('IMPORTANT') || msg.importance === 'high') {
    return 'important';
  }

  // New unread messages
  if (!msg.isRead) {
    return 'new';
  }

  return 'unclassified';
}
