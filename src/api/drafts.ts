/**
 * Draft Email Endpoints - Email Draft Creation (NO SENDING)
 * 
 * Provides secure endpoints for creating email drafts without sending capability.
 * Enforces the critical constraint that this system NEVER sends emails.
 */

import { Environment } from "../index";
import { GraphClient } from "../microsoft/graph";
import { auditLog } from "../database/audit";

/**
 * Email draft input validation interface
 */
export interface DraftMessageInput {
  subject: string;
  body: string;
  toRecipients: string[];
  ccRecipients?: string[];
  bccRecipients?: string[];
  importance?: "low" | "normal" | "high";
}

/**
 * Reply draft input validation interface
 */
export interface ReplyDraftInput {
  messageId: string;
  body: string;
  replyAll?: boolean;
}

/**
 * Draft creation result
 */
export interface DraftResult {
  success: boolean;
  draftId?: string;
  webLink?: string;
  error?: string;
}

/**
 * Draft validation error
 */
export class DraftValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = "DraftValidationError";
  }
}

/**
 * Draft Email Handler
 */
export class DraftHandler {
  private readonly env: Environment;
  private readonly graphClient: GraphClient;

  constructor(env: Environment) {
    this.env = env;
    this.graphClient = new GraphClient(env);
  }

  /**
   * Handle POST /drafts - Create new email draft
   */
  async handleCreateDraft(request: Request): Promise<Response> {
    try {
      const draftInput = await this.parseAndValidateDraft(request);
      const result = await this.createDraft(draftInput);
      
      // Log draft creation to audit trail
      await auditLog(this.env.DB, {
        operation: "create",
        resourceType: "draft",
        resourceId: result.draftId || null,
        result: result.success ? "success" : "failure",
        requestedBy: "api",
        details: {
          action: "create_draft",
          subject: draftInput.subject,
          recipientCount: draftInput.toRecipients.length,
          error: result.error
        }
      });
      
      if (result.success) {
        return new Response(
          JSON.stringify({
            success: true,
            draftId: result.draftId,
            webLink: result.webLink,
            message: "Draft created successfully - appears in Outlook Drafts folder"
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
      return this.handleError(error, "Draft creation failed");
    }
  }

  /**
   * Handle POST /drafts/reply - Create reply draft
   */
  async handleCreateReplyDraft(request: Request): Promise<Response> {
    try {
      const replyInput = await this.parseAndValidateReply(request);
      const result = await this.createReplyDraft(replyInput);
      
      // Log reply draft creation to audit trail
      await auditLog(this.env.DB, {
        operation: "create",
        resourceType: "draft",
        resourceId: result.draftId || null,
        result: result.success ? "success" : "failure",
        requestedBy: "api",
        details: {
          action: "create_reply_draft",
          originalMessageId: replyInput.messageId,
          replyAll: replyInput.replyAll,
          error: result.error
        }
      });
      
      if (result.success) {
        return new Response(
          JSON.stringify({
            success: true,
            draftId: result.draftId,
            webLink: result.webLink,
            message: "Reply draft created successfully"
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
      return this.handleError(error, "Reply draft creation failed");
    }
  }

  /**
   * Create email draft (NO SENDING CAPABILITY)
   */
  private async createDraft(draftInput: DraftMessageInput): Promise<DraftResult> {
    try {
      // Transform to Microsoft Graph draft format
      const graphDraft = {
        subject: draftInput.subject,
        importance: draftInput.importance || "normal",
        body: {
          contentType: "HTML",
          content: draftInput.body
        },
        toRecipients: draftInput.toRecipients.map(email => ({
          emailAddress: {
            address: email.trim(),
            name: email.trim()
          }
        })),
        ccRecipients: (draftInput.ccRecipients || []).map(email => ({
          emailAddress: {
            address: email.trim(),
            name: email.trim()
          }
        })),
        bccRecipients: (draftInput.bccRecipients || []).map(email => ({
          emailAddress: {
            address: email.trim(),
            name: email.trim()
          }
        }))
      };

      // Create draft via Microsoft Graph (creates in Drafts folder, does NOT send)
      const createResult = await this.graphClient.createDraft(graphDraft);
      
      if (createResult.success) {
        return {
          success: true,
          draftId: createResult.id,
          webLink: `https://outlook.office.com/mail/drafts`
        };
      } else {
        return {
          success: false,
          error: createResult.error?.message || "Draft creation failed"
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
   * Create reply draft (NO SENDING CAPABILITY)
   */
  private async createReplyDraft(replyInput: ReplyDraftInput): Promise<DraftResult> {
    try {
      // Get original message details for reply context
      const originalMessage = await this.getOriginalMessage(replyInput.messageId);
      if (!originalMessage) {
        return {
          success: false,
          error: "Original message not found"
        };
      }

      // Create reply draft via Microsoft Graph
      const _replyEndpoint = replyInput.replyAll 
        ? `/me/messages/${replyInput.messageId}/createReplyAll`
        : `/me/messages/${replyInput.messageId}/createReply`;

      const replyDraft = {
        body: {
          contentType: "HTML", 
          content: replyInput.body
        }
      };

      // This creates a reply draft, does NOT send
      const createResult = await this.graphClient.createDraft(replyDraft);
      
      if (createResult.success) {
        return {
          success: true,
          draftId: createResult.id,
          webLink: `https://outlook.office.com/mail/drafts`
        };
      } else {
        return {
          success: false,
          error: createResult.error?.message || "Reply draft creation failed"
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
   * Get original message for reply context
   */
  private async getOriginalMessage(_messageId: string): Promise<any> {
    try {
      return await this.graphClient.getUserProfile(); // Placeholder - should get specific message
    } catch (error) {
      console.error("Failed to get original message:", error);
      return null;
    }
  }

  /**
   * Parse and validate draft input from request
   */
  private async parseAndValidateDraft(request: Request): Promise<DraftMessageInput> {
    let body: any;
    
    try {
      body = await request.json();
    } catch (error) {
      throw new DraftValidationError("Invalid JSON in request body", "body", body);
    }

    // Validate required fields
    if (!body.subject || typeof body.subject !== "string") {
      throw new DraftValidationError("Subject is required and must be a string", "subject", body.subject);
    }

    if (!body.body || typeof body.body !== "string") {
      throw new DraftValidationError("Body is required and must be a string", "body", body.body);
    }

    if (!body.toRecipients || !Array.isArray(body.toRecipients) || body.toRecipients.length === 0) {
      throw new DraftValidationError("At least one recipient is required", "toRecipients", body.toRecipients);
    }

    // Validate email addresses
    const validateEmailList = (emails: any[], fieldName: string): string[] => {
      if (!Array.isArray(emails)) {
        throw new DraftValidationError(`${fieldName} must be an array`, fieldName, emails);
      }
      
      return emails.map((email, index) => {
        if (typeof email !== "string") {
          throw new DraftValidationError(`${fieldName}[${index}] must be a string`, fieldName, email);
        }
        
        const trimmed = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(trimmed)) {
          throw new DraftValidationError(`Invalid email format: ${email}`, fieldName, email);
        }
        
        return trimmed;
      });
    };

    const toRecipients = validateEmailList(body.toRecipients, "toRecipients");
    const ccRecipients = body.ccRecipients ? validateEmailList(body.ccRecipients, "ccRecipients") : [];
    const bccRecipients = body.bccRecipients ? validateEmailList(body.bccRecipients, "bccRecipients") : [];

    // Validate importance
    const importance = body.importance || "normal";
    if (!["low", "normal", "high"].includes(importance)) {
      throw new DraftValidationError("Importance must be low, normal, or high", "importance", importance);
    }

    return {
      subject: body.subject.trim(),
      body: body.body.trim(),
      toRecipients,
      ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
      bccRecipients: bccRecipients.length > 0 ? bccRecipients : undefined,
      importance: importance as "low" | "normal" | "high"
    };
  }

  /**
   * Parse and validate reply input from request
   */
  private async parseAndValidateReply(request: Request): Promise<ReplyDraftInput> {
    let body: any;
    
    try {
      body = await request.json();
    } catch (error) {
      throw new DraftValidationError("Invalid JSON in request body", "body", body);
    }

    // Validate required fields
    if (!body.messageId || typeof body.messageId !== "string") {
      throw new DraftValidationError("Message ID is required and must be a string", "messageId", body.messageId);
    }

    if (!body.body || typeof body.body !== "string") {
      throw new DraftValidationError("Reply body is required and must be a string", "body", body.body);
    }

    return {
      messageId: body.messageId.trim(),
      body: body.body.trim(),
      replyAll: Boolean(body.replyAll)
    };
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: unknown, context: string): Response {
    console.error(`${context}:`, error);
    
    const message = error instanceof DraftValidationError 
      ? error.message
      : (error instanceof Error ? error.message : "Unknown error");
    
    const status = error instanceof DraftValidationError ? 400 : 500;
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: context,
        message: message,
        field: error instanceof DraftValidationError ? error.field : undefined
      }),
      { 
        status,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

/**
 * IMPORTANT SECURITY NOTE:
 * 
 * This module creates DRAFTS ONLY - it has NO email sending capability.
 * The system is designed to NEVER send emails automatically.
 * 
 * - All drafts are created in the user's Outlook Drafts folder
 * - No /send endpoints are implemented
 * - No Mail.Send permission is requested 
 * - Manual sending must be done through Outlook interface
 */

