/**
 * Email Models and Validation - Microsoft Graph Email Integration
 * 
 * Provides TypeScript interfaces, validation logic, and transformation
 * functions for email message data from Microsoft Graph API.
 */

/**
 * Email importance levels from Microsoft Graph
 */
export type EmailImportance = "low" | "normal" | "high";

/**
 * Email classification for Morning Brief categorization
 */
export type EmailClassification = "new" | "important" | "marketing" | "unclassified";

/**
 * Internal email message model (matches database schema)
 */
export interface EmailMessage {
  /** Internal database ID */
  id: string;
  
  /** Unique Microsoft Graph message ID */
  graph_message_id: string;
  
  /** Microsoft Graph conversation ID for threading */
  conversation_id: string | null;
  
  /** Standard Internet Message-ID header */
  internet_message_id: string | null;
  
  /** Timestamp when message was received */
  received_at: Date;
  
  /** Sender email address */
  sender_email: string;
  
  /** Sender display name */
  sender_name: string | null;
  
  /** Message subject line */
  subject: string;
  
  /** Read status */
  is_read: boolean;
  
  /** Message importance level */
  importance: EmailImportance;
  
  /** Whether message has attachments */
  has_attachments: boolean;
  
  /** Classification for Morning Brief */
  classification: EmailClassification;
  
  /** Truncated message body preview */
  body_preview: string | null;
  
  /** Outlook Web App link */
  web_link: string | null;
  
  /** First time seen during sync */
  first_seen_at: Date;
  
  /** Last time seen during sync */
  last_seen_at: Date;
}

/**
 * Microsoft Graph message response structure
 */
export interface GraphEmailMessage {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  receivedDateTime: string;
  sender?: {
    emailAddress?: {
      address?: string;
      name?: string;
    };
  };
  subject?: string;
  isRead: boolean;
  importance: string;
  hasAttachments: boolean;
  bodyPreview?: string;
  webLink?: string;
}

/**
 * Email message creation input
 */
export interface CreateEmailMessageInput {
  graph_message_id: string;
  conversation_id?: string | null;
  internet_message_id?: string | null;
  received_at: Date;
  sender_email: string;
  sender_name?: string | null;
  subject: string;
  is_read: boolean;
  importance: EmailImportance;
  has_attachments: boolean;
  classification?: EmailClassification;
  body_preview?: string | null;
  web_link?: string | null;
}

/**
 * Email message update input
 */
export interface UpdateEmailMessageInput {
  is_read?: boolean;
  classification?: EmailClassification;
  last_seen_at?: Date;
}

/**
 * Email validation error
 */
export class EmailValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = "EmailValidationError";
  }
}

/**
 * Validate email importance level
 */
export function validateImportance(importance: string): EmailImportance {
  const normalized = importance?.toLowerCase();
  
  switch (normalized) {
    case "low":
      return "low";
    case "normal":
    case "":
    case undefined:
    case null:
      return "normal";
    case "high":
      return "high";
    default:
      console.warn(`Unknown importance level: ${importance}, defaulting to normal`);
      return "normal";
  }
}

/**
 * Validate and normalize email address
 */
export function validateEmailAddress(email: string): string {
  if (!email || typeof email !== "string") {
    throw new EmailValidationError("Email address is required", "email", email);
  }
  
  const trimmed = email.trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new EmailValidationError("Invalid email format", "email", email);
  }
  
  return trimmed;
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
 * Validate Graph message ID
 */
export function validateGraphMessageId(id: string): string {
  if (!id || typeof id !== "string") {
    throw new EmailValidationError("Graph message ID is required", "graph_message_id", id);
  }
  
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    throw new EmailValidationError("Graph message ID cannot be empty", "graph_message_id", id);
  }
  
  return trimmed;
}

/**
 * Validate and parse received datetime
 */
export function validateReceivedDateTime(dateTime: string): Date {
  if (!dateTime || typeof dateTime !== "string") {
    throw new EmailValidationError("Received datetime is required", "received_at", dateTime);
  }
  
  const date = new Date(dateTime);
  if (isNaN(date.getTime())) {
    throw new EmailValidationError("Invalid received datetime format", "received_at", dateTime);
  }
  
  return date;
}

/**
 * Transform Microsoft Graph message to internal model
 */
export function transformGraphMessage(graphMessage: GraphEmailMessage): CreateEmailMessageInput {
  try {
    // Validate and extract required fields
    const graphMessageId = validateGraphMessageId(graphMessage.id);
    const receivedAt = validateReceivedDateTime(graphMessage.receivedDateTime);
    const subject = validateSubject(graphMessage.subject);
    
    // Extract sender information
    const senderEmail = graphMessage.sender?.emailAddress?.address;
    if (!senderEmail) {
      throw new EmailValidationError("Sender email is required", "sender_email", senderEmail);
    }
    
    const validatedSenderEmail = validateEmailAddress(senderEmail);
    const senderName = graphMessage.sender?.emailAddress?.name?.trim() || null;
    
    // Validate other fields
    const importance = validateImportance(graphMessage.importance);
    const isRead = Boolean(graphMessage.isRead);
    const hasAttachments = Boolean(graphMessage.hasAttachments);
    
    // Process optional fields
    const conversationId = graphMessage.conversationId?.trim() || null;
    const internetMessageId = graphMessage.internetMessageId?.trim() || null;
    const bodyPreview = graphMessage.bodyPreview?.trim() || null;
    const webLink = graphMessage.webLink?.trim() || null;
    
    return {
      graph_message_id: graphMessageId,
      conversation_id: conversationId,
      internet_message_id: internetMessageId,
      received_at: receivedAt,
      sender_email: validatedSenderEmail,
      sender_name: senderName,
      subject: subject,
      is_read: isRead,
      importance: importance,
      has_attachments: hasAttachments,
      classification: "unclassified", // Default classification
      body_preview: bodyPreview,
      web_link: webLink
    };
    
  } catch (error) {
    if (error instanceof EmailValidationError) {
      throw error;
    }
    
    throw new EmailValidationError(
      `Failed to transform Graph message: ${error instanceof Error ? error.message : "Unknown error"}`,
      "transform",
      graphMessage
    );
  }
}

/**
 * Classify email message for Morning Brief categorization
 */
export function classifyEmailMessage(message: CreateEmailMessageInput): EmailClassification {
  const subject = message.subject.toLowerCase();
  const senderEmail = message.sender_email.toLowerCase();
  const bodyPreview = message.body_preview?.toLowerCase() || "";
  
  // Important message indicators
  if (message.importance === "high") {
    return "important";
  }
  
  // Marketing message indicators
  const marketingKeywords = [
    "unsubscribe", "newsletter", "promotion", "sale", "discount",
    "marketing", "advertisement", "offer", "deal", "campaign"
  ];
  
  const marketingDomains = [
    "noreply", "no-reply", "donotreply", "marketing", "promo", "news"
  ];
  
  // Check for marketing keywords
  if (marketingKeywords.some(keyword => 
    subject.includes(keyword) || bodyPreview.includes(keyword)
  )) {
    return "marketing";
  }
  
  // Check for marketing sender patterns
  if (marketingDomains.some(domain => senderEmail.includes(domain))) {
    return "marketing";
  }
  
  // New vs existing message classification
  // For now, classify unread messages as "new"
  if (!message.is_read) {
    return "new";
  }
  
  return "unclassified";
}

/**
 * Validate complete email message input
 */
export function validateEmailMessageInput(input: CreateEmailMessageInput): CreateEmailMessageInput {
  const validated: CreateEmailMessageInput = {
    graph_message_id: validateGraphMessageId(input.graph_message_id),
    received_at: input.received_at,
    sender_email: validateEmailAddress(input.sender_email),
    subject: validateSubject(input.subject),
    is_read: Boolean(input.is_read),
    importance: validateImportance(input.importance),
    has_attachments: Boolean(input.has_attachments),
    classification: input.classification || "unclassified",
    conversation_id: input.conversation_id?.trim() || null,
    internet_message_id: input.internet_message_id?.trim() || null,
    sender_name: input.sender_name?.trim() || null,
    body_preview: input.body_preview?.trim() || null,
    web_link: input.web_link?.trim() || null
  };
  
  // Apply automatic classification if not provided or unclassified
  if (!validated.classification || validated.classification === "unclassified") {
    validated.classification = classifyEmailMessage(validated);
  }
  
  return validated;
}

/**
 * Create email message database record
 */
export function createEmailMessageRecord(input: CreateEmailMessageInput): EmailMessage {
  const validated = validateEmailMessageInput(input);
  const now = new Date();
  
  return {
    id: crypto.randomUUID(),
    graph_message_id: validated.graph_message_id,
    conversation_id: validated.conversation_id,
    internet_message_id: validated.internet_message_id,
    received_at: validated.received_at,
    sender_email: validated.sender_email,
    sender_name: validated.sender_name,
    subject: validated.subject,
    is_read: validated.is_read,
    importance: validated.importance,
    has_attachments: validated.has_attachments,
    classification: validated.classification,
    body_preview: validated.body_preview,
    web_link: validated.web_link,
    first_seen_at: now,
    last_seen_at: now
  };
}

/**
 * Email repository interface for database operations
 */
export interface EmailRepository {
  create(message: EmailMessage): Promise<void>;
  findByGraphId(graphMessageId: string): Promise<EmailMessage | null>;
  updateLastSeen(graphMessageId: string, timestamp: Date): Promise<void>;
  updateClassification(graphMessageId: string, classification: EmailClassification): Promise<void>;
  findRecent(limit: number, offset?: number): Promise<EmailMessage[]>;
  findUnread(limit: number, offset?: number): Promise<EmailMessage[]>;
  findByClassification(classification: EmailClassification, limit: number, offset?: number): Promise<EmailMessage[]>;
  count(): Promise<number>;
  countByClassification(classification: EmailClassification): Promise<number>;
}

/**
 * Batch email processing result
 */
export interface EmailBatchResult {
  processed: number;
  created: number;
  updated: number;
  errors: number;
  errorMessages: string[];
}

/**
 * Process batch of Graph messages with deduplication
 */
export async function processBatchMessages(
  graphMessages: GraphEmailMessage[],
  repository: EmailRepository
): Promise<EmailBatchResult> {
  const result: EmailBatchResult = {
    processed: 0,
    created: 0,
    updated: 0,
    errors: 0,
    errorMessages: []
  };
  
  for (const graphMessage of graphMessages) {
    try {
      result.processed++;
      
      // Transform Graph message to internal format
      const messageInput = transformGraphMessage(graphMessage);
      
      // Check if message already exists
      const existing = await repository.findByGraphId(messageInput.graph_message_id);
      
      if (existing) {
        // Update existing message
        await repository.updateLastSeen(messageInput.graph_message_id, new Date());
        result.updated++;
      } else {
        // Create new message
        const messageRecord = createEmailMessageRecord(messageInput);
        await repository.create(messageRecord);
        result.created++;
      }
      
    } catch (error) {
      result.errors++;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      result.errorMessages.push(`Message ${graphMessage.id}: ${errorMsg}`);
      console.error("Failed to process email message:", error);
    }
  }
  
  return result;
}
