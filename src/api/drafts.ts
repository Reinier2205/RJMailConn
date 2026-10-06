/**
 * Draft Email Endpoints - Email Draft Creation (NO SENDING)
 *
 * Creates Gmail drafts using the Gmail API. This system NEVER sends email.
 */

import { Environment } from "../index";
import { TokenStorage } from "../auth/tokens";
import { GoogleOAuthHandler } from "../google/auth";
import { auditLog } from "../database/audit";

export interface DraftMessageInput {
  subject: string;
  body: string;
  toRecipients: string[];
  ccRecipients?: string[];
  bccRecipients?: string[];
  importance?: "low" | "normal" | "high";
}

export interface ReplyDraftInput {
  messageId: string;
  body: string;
  replyAll?: boolean;
}

export interface DraftResult {
  success: boolean;
  draftId?: string;
  webLink?: string;
  error?: string;
}

export class DraftValidationError extends Error {
  constructor(message: string, public field?: string, public value?: any) {
    super(message);
    this.name = "DraftValidationError";
  }
}

export class DraftHandler {
  private readonly env: Environment;
  private readonly tokenStorage: TokenStorage;
  private readonly oauthHandler: GoogleOAuthHandler;

  constructor(env: Environment) {
    this.env = env;
    this.tokenStorage = new TokenStorage(env);
    this.oauthHandler = new GoogleOAuthHandler(env);
  }

  // ─── Public handlers ────────────────────────────────────────────────────────

  async handleCreateDraft(request: Request): Promise<Response> {
    try {
      const draftInput = await this.parseAndValidateDraft(request);
      const result = await this.createDraft(draftInput);

      await auditLog(this.env.DB, {
        operation: "create",
        resourceType: "draft",
        resourceId: result.draftId || null,
        result: result.success ? "success" : "failure",
        requestedBy: "api",
        details: { action: "create_draft", subject: draftInput.subject, recipientCount: draftInput.toRecipients.length, error: result.error },
      });

      return result.success
        ? new Response(JSON.stringify({ success: true, draftId: result.draftId, webLink: result.webLink, message: "Draft saved to Gmail Drafts folder" }), { status: 201, headers: { "Content-Type": "application/json" } })
        : new Response(JSON.stringify({ success: false, error: result.error }), { status: 400, headers: { "Content-Type": "application/json" } });

    } catch (error) {
      return this.handleError(error, "Draft creation failed");
    }
  }

  async handleCreateReplyDraft(request: Request): Promise<Response> {
    try {
      const replyInput = await this.parseAndValidateReply(request);
      const result = await this.createReplyDraft(replyInput);

      await auditLog(this.env.DB, {
        operation: "create",
        resourceType: "draft",
        resourceId: result.draftId || null,
        result: result.success ? "success" : "failure",
        requestedBy: "api",
        details: { action: "create_reply_draft", originalMessageId: replyInput.messageId, replyAll: replyInput.replyAll, error: result.error },
      });

      return result.success
        ? new Response(JSON.stringify({ success: true, draftId: result.draftId, webLink: result.webLink, message: "Reply draft saved to Gmail Drafts folder" }), { status: 201, headers: { "Content-Type": "application/json" } })
        : new Response(JSON.stringify({ success: false, error: result.error }), { status: 400, headers: { "Content-Type": "application/json" } });

    } catch (error) {
      return this.handleError(error, "Reply draft creation failed");
    }
  }

  // ─── Gmail API calls ────────────────────────────────────────────────────────

  private async createDraft(input: DraftMessageInput): Promise<DraftResult> {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) return { success: false, error: "No valid access token - re-authentication required" };

      const to = input.toRecipients.join(", ");
      const cc = input.ccRecipients?.join(", ") ?? "";
      const lines = [
        `To: ${to}`,
        cc ? `Cc: ${cc}` : null,
        `Subject: ${input.subject}`,
        `Content-Type: text/html; charset=UTF-8`,
        "",
        input.body,
      ].filter(Boolean).join("\r\n");

      const encoded = this.encodeRfc2822(lines);

      const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { raw: encoded } }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return { success: false, error: `Gmail draft creation failed: ${resp.status} ${err}` };
      }

      const data = await resp.json() as any;
      return { success: true, draftId: data.id, webLink: "https://mail.google.com/mail/#drafts" };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  private async createReplyDraft(input: ReplyDraftInput): Promise<DraftResult> {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) return { success: false, error: "No valid access token - re-authentication required" };

      // Fetch original message headers for threading
      const msgResp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${input.messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgResp.ok) return { success: false, error: "Original message not found" };

      const msgData = await msgResp.json() as any;
      const h: Record<string, string> = {};
      for (const hdr of msgData.payload?.headers ?? []) h[hdr.name.toLowerCase()] = hdr.value;

      const replyTo = h["from"] ?? "";
      const subject = h["subject"]?.startsWith("Re:") ? h["subject"] : `Re: ${h["subject"] ?? ""}`;
      const msgId = h["message-id"] ?? "";
      const refs = h["references"] ? `${h["references"]} ${msgId}` : msgId;

      const lines = [
        `To: ${replyTo}`,
        `Subject: ${subject}`,
        `In-Reply-To: ${msgId}`,
        `References: ${refs}`,
        `Content-Type: text/html; charset=UTF-8`,
        "",
        input.body,
      ].join("\r\n");

      const encoded = this.encodeRfc2822(lines);

      const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { raw: encoded, threadId: msgData.threadId } }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return { success: false, error: `Gmail reply draft failed: ${resp.status} ${err}` };
      }

      const data = await resp.json() as any;
      return { success: true, draftId: data.id, webLink: "https://mail.google.com/mail/#drafts" };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  private async parseAndValidateDraft(request: Request): Promise<DraftMessageInput> {
    let body: any;
    try { body = await request.json(); } catch { throw new DraftValidationError("Invalid JSON in request body"); }

    if (!body.subject || typeof body.subject !== "string") throw new DraftValidationError("Subject is required", "subject");
    if (!body.body || typeof body.body !== "string") throw new DraftValidationError("Body is required", "body");
    if (!Array.isArray(body.toRecipients) || body.toRecipients.length === 0) throw new DraftValidationError("At least one recipient required", "toRecipients");

    return {
      subject: body.subject.trim(),
      body: body.body.trim(),
      toRecipients: this.validateEmailList(body.toRecipients, "toRecipients"),
      ccRecipients: body.ccRecipients ? this.validateEmailList(body.ccRecipients, "ccRecipients") : undefined,
      bccRecipients: body.bccRecipients ? this.validateEmailList(body.bccRecipients, "bccRecipients") : undefined,
      importance: ["low", "normal", "high"].includes(body.importance) ? body.importance : "normal",
    };
  }

  private async parseAndValidateReply(request: Request): Promise<ReplyDraftInput> {
    let body: any;
    try { body = await request.json(); } catch { throw new DraftValidationError("Invalid JSON in request body"); }

    if (!body.messageId || typeof body.messageId !== "string") throw new DraftValidationError("messageId is required", "messageId");
    if (!body.body || typeof body.body !== "string") throw new DraftValidationError("body is required", "body");

    return { messageId: body.messageId.trim(), body: body.body.trim(), replyAll: Boolean(body.replyAll) };
  }

  private validateEmailList(emails: any[], field: string): string[] {
    return emails.map((email, i) => {
      if (typeof email !== "string") throw new DraftValidationError(`${field}[${i}] must be a string`, field);
      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new DraftValidationError(`Invalid email: ${email}`, field);
      return trimmed;
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async getValidAccessToken(): Promise<string | null> {
    const valid = await this.oauthHandler.validateTokens();
    if (!valid) return null;
    return this.tokenStorage.getAccessToken();
  }

  private encodeRfc2822(raw: string): string {
    return btoa(unescape(encodeURIComponent(raw)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  private handleError(error: unknown, context: string): Response {
    const message = error instanceof DraftValidationError ? error.message : (error instanceof Error ? error.message : "Unknown error");
    const status = error instanceof DraftValidationError ? 400 : 500;
    return new Response(
      JSON.stringify({ success: false, error: context, message, field: error instanceof DraftValidationError ? error.field : undefined }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
}
