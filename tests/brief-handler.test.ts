/**
 * Unit tests for BriefHandler - Morning Brief Generation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BriefHandler } from "../src/api/brief";

// Mock database for testing
interface MockDatabase {
  prepare: (query: string) => {
    bind: (...params: any[]) => {
      first: () => Promise<any>;
      all: () => Promise<{ results?: any[] }>;
      run: () => Promise<void>;
    };
  };
}

describe("BriefHandler", () => {
  let mockDb: MockDatabase;
  let briefHandler: BriefHandler;
  let mockEnv: any;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      prepare: (query: string) => ({
        bind: (...params: any[]) => ({
          first: async () => {
            // Mock sync state response
            if (query.includes("sync_state")) {
              return {
                status: "complete",
                last_success_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                messages_checked: 25,
                events_checked: 5
              };
            }
            
            // Mock email count response
            if (query.includes("COUNT(*)") && query.includes("email_messages")) {
              return { count: 8 };
            }
            
            return null;
          },
          all: async () => {
            // Mock email messages response
            if (query.includes("email_messages")) {
              const now = new Date();
              const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              
              if (query.includes("is_read = 0") && query.includes("classification IN ('new'")) {
                return {
                  results: [
                    {
                      id: "email-1",
                      graph_message_id: "msg-1",
                      conversation_id: "conv-1",
                      internet_message_id: null,
                      received_at: yesterday.toISOString(),
                      sender_email: "sender@example.com",
                      sender_name: "Test Sender",
                      subject: "New Important Message",
                      is_read: 0,
                      importance: "normal",
                      has_attachments: 0,
                      classification: "new",
                      body_preview: "This is a preview of the message",
                      web_link: "https://outlook.office.com/mail/id/msg-1",
                      first_seen_at: yesterday.toISOString(),
                      last_seen_at: yesterday.toISOString()
                    }
                  ]
                };
              }
              
              if (query.includes("importance = 'high'") || query.includes("classification = 'important'")) {
                return {
                  results: [
                    {
                      id: "email-2",
                      graph_message_id: "msg-2",
                      conversation_id: "conv-2",
                      internet_message_id: null,
                      received_at: yesterday.toISOString(),
                      sender_email: "important@example.com",
                      sender_name: "Important Sender",
                      subject: "Urgent: Action Required",
                      is_read: 1,
                      importance: "high",
                      has_attachments: 1,
                      classification: "important",
                      body_preview: "This requires immediate attention",
                      web_link: "https://outlook.office.com/mail/id/msg-2",
                      first_seen_at: yesterday.toISOString(),
                      last_seen_at: yesterday.toISOString()
                    }
                  ]
                };
              }
              
              if (query.includes("classification = 'marketing'")) {
                return { results: [] };
              }
            }
            
            // Mock calendar events response
            if (query.includes("calendar_events")) {
              const today = new Date();
              const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
              
              if (query.includes("start_at <") && query.includes("end_at >")) {
                return {
                  results: [
                    {
                      id: "event-1",
                      graph_event_id: "evt-1",
                      subject: "Daily Standup",
                      start_at: new Date(todayStart.getTime() + 9 * 60 * 60 * 1000).toISOString(), // 9 AM
                      end_at: new Date(todayStart.getTime() + 9.5 * 60 * 60 * 1000).toISOString(), // 9:30 AM
                      timezone: "UTC",
                      location: "Conference Room A",
                      organiser: "manager@example.com",
                      response_status: "accepted",
                      is_cancelled: 0,
                      body_preview: "Daily team standup meeting",
                      first_seen_at: yesterday.toISOString(),
                      last_seen_at: yesterday.toISOString()
                    }
                  ]
                };
              }
              
              // Upcoming events
              if (query.includes("start_at >")) {
                const tomorrow = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);
                return {
                  results: [
                    {
                      id: "event-2",
                      graph_event_id: "evt-2",
                      subject: "Weekly Review",
                      start_at: tomorrow.toISOString(),
                      end_at: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
                      timezone: "UTC",
                      location: null,
                      organiser: "team@example.com",
                      response_status: "tentative",
                      is_cancelled: 0,
                      body_preview: "Weekly team review session",
                      first_seen_at: yesterday.toISOString(),
                      last_seen_at: yesterday.toISOString()
                    }
                  ]
                };
              }
            }
            
            return { results: [] };
          },
          run: async () => {}
        })
      })
    };

    mockEnv = {
      DB: mockDb
    };

    briefHandler = new BriefHandler(mockEnv);
  });

  describe("generateBrief", () => {
    it("should generate a complete morning brief with correct structure", async () => {
      const brief = await briefHandler.generateBrief();
      
      // Verify basic structure
      expect(brief).toHaveProperty("generated_at");
      expect(brief).toHaveProperty("status");
      expect(brief).toHaveProperty("data_sources");
      expect(brief).toHaveProperty("emails");
      expect(brief).toHaveProperty("calendar");
      expect(brief).toHaveProperty("warnings");
      
      // Verify generated_at is valid ISO datetime
      expect(new Date(brief.generated_at).toISOString()).toBe(brief.generated_at);
    });

    it("should categorize data sources correctly", async () => {
      const brief = await briefHandler.generateBrief();
      
      // Verify data sources structure
      expect(brief.data_sources).toHaveProperty("email");
      expect(brief.data_sources).toHaveProperty("calendar");
      
      // Verify email data source
      expect(brief.data_sources.email).toHaveProperty("status");
      expect(brief.data_sources.email).toHaveProperty("last_sync");
      expect(brief.data_sources.email).toHaveProperty("items");
      expect(brief.data_sources.email.status).toBe("complete");
      expect(brief.data_sources.email.items).toBe(25);
      
      // Verify calendar data source
      expect(brief.data_sources.calendar.status).toBe("complete");
      expect(brief.data_sources.calendar.items).toBe(5);
    });

    it("should categorize emails correctly", async () => {
      const brief = await briefHandler.generateBrief();
      
      // Verify email categorization structure
      expect(brief.emails).toHaveProperty("new_messages");
      expect(brief.emails).toHaveProperty("important_messages");
      expect(brief.emails).toHaveProperty("marketing_messages");
      expect(brief.emails).toHaveProperty("unread_count");
      
      // Verify email arrays are arrays
      expect(Array.isArray(brief.emails.new_messages)).toBe(true);
      expect(Array.isArray(brief.emails.important_messages)).toBe(true);
      expect(Array.isArray(brief.emails.marketing_messages)).toBe(true);
      
      // Verify unread count is number
      expect(typeof brief.emails.unread_count).toBe("number");
      expect(brief.emails.unread_count).toBe(8);
      
      // Verify we have expected categorized emails
      expect(brief.emails.new_messages.length).toBe(1);
      expect(brief.emails.important_messages.length).toBe(1);
      expect(brief.emails.marketing_messages.length).toBe(0);
      
      // Verify email message structure
      const newMessage = brief.emails.new_messages[0];
      expect(newMessage).toHaveProperty("subject");
      expect(newMessage).toHaveProperty("sender_email");
      expect(newMessage).toHaveProperty("received_at");
      expect(newMessage).toHaveProperty("classification");
      expect(newMessage.classification).toBe("new");
      
      const importantMessage = brief.emails.important_messages[0];
      expect(importantMessage.importance).toBe("high");
      expect(importantMessage.classification).toBe("important");
    });

    it("should format calendar data correctly", async () => {
      const brief = await briefHandler.generateBrief();
      
      // Verify calendar structure
      expect(brief.calendar).toHaveProperty("today_events");
      expect(brief.calendar).toHaveProperty("upcoming_events");
      
      // Verify calendar arrays are arrays
      expect(Array.isArray(brief.calendar.today_events)).toBe(true);
      expect(Array.isArray(brief.calendar.upcoming_events)).toBe(true);
      
      // Verify we have expected events
      expect(brief.calendar.today_events.length).toBe(1);
      expect(brief.calendar.upcoming_events.length).toBe(1);
      
      // Verify today's event structure
      const todayEvent = brief.calendar.today_events[0];
      expect(todayEvent).toHaveProperty("subject");
      expect(todayEvent).toHaveProperty("start_at");
      expect(todayEvent).toHaveProperty("end_at");
      expect(todayEvent).toHaveProperty("location");
      expect(todayEvent.subject).toBe("Daily Standup");
      expect(todayEvent.location).toBe("Conference Room A");
      
      // Verify upcoming event structure  
      const upcomingEvent = brief.calendar.upcoming_events[0];
      expect(upcomingEvent.subject).toBe("Weekly Review");
      expect(upcomingEvent.response_status).toBe("tentative");
    });

    it("should determine overall status correctly", async () => {
      const brief = await briefHandler.generateBrief();
      
      // With both sources complete, overall should be complete
      expect(brief.status).toBe("complete");
    });

    it("should not generate warnings for complete sync", async () => {
      const brief = await briefHandler.generateBrief();
      
      // No warnings should be generated for complete, recent sync
      expect(Array.isArray(brief.warnings)).toBe(true);
      expect(brief.warnings.length).toBe(0);
    });
  });

  describe("data source status handling", () => {
    it("should handle missing sync data gracefully", async () => {
      // Override mock to return no sync data
      mockDb.prepare = (query: string) => ({
        bind: (...params: any[]) => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => {}
        })
      });

      const brief = await briefHandler.generateBrief();
      
      // Should handle missing data gracefully
      expect(brief.data_sources.email.status).toBe("source_unavailable");
      expect(brief.data_sources.email.last_sync).toBe(null);
      expect(brief.data_sources.email.items).toBe(0);
      
      expect(brief.data_sources.calendar.status).toBe("source_unavailable");
      expect(brief.warnings.length).toBeGreaterThan(0);
    });
  });
});