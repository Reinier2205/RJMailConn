/**
 * Calendar Event Creation Tests
 *
 * Tests for the POST /calendar/events endpoint
 */
import { describe, it, expect } from 'vitest';
import { CalendarEventHandler } from '../src/api/calendar';
// Mock environment for testing
const mockEnv = {
    MICROSOFT_CLIENT_ID: 'test-client-id',
    MICROSOFT_CLIENT_SECRET: 'test-client-secret',
    MICROSOFT_TENANT_ID: 'test-tenant-id',
    CONNECTOR_API_TOKEN: 'test-api-token',
    DB: {} // Mock database
};
describe('Calendar Event Creation', () => {
    it('should validate required fields for calendar event creation', async () => {
        const handler = new CalendarEventHandler(mockEnv);
        // Test missing subject
        const request1 = new Request('http://localhost/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startTime: '2024-01-15T09:00:00Z',
                endTime: '2024-01-15T10:00:00Z',
                timezone: 'UTC'
            })
        });
        const response1 = await handler.handleCreateEvent(request1);
        expect(response1.status).toBe(400);
        const result1 = await response1.json();
        expect(result1.success).toBe(false);
        expect(result1.message).toContain('Subject is required');
    });
    it('should validate start/end time requirements', async () => {
        const handler = new CalendarEventHandler(mockEnv);
        // Test missing start time
        const request1 = new Request('http://localhost/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: 'Test Meeting',
                endTime: '2024-01-15T10:00:00Z',
                timezone: 'UTC'
            })
        });
        const response1 = await handler.handleCreateEvent(request1);
        expect(response1.status).toBe(400);
        const result1 = await response1.json();
        expect(result1.success).toBe(false);
        expect(result1.message).toContain('Start time is required');
    });
    it('should validate timezone requirement', async () => {
        const handler = new CalendarEventHandler(mockEnv);
        const request = new Request('http://localhost/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: 'Test Meeting',
                startTime: '2024-01-15T09:00:00Z',
                endTime: '2024-01-15T10:00:00Z'
                // Missing timezone
            })
        });
        const response = await handler.handleCreateEvent(request);
        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.success).toBe(false);
        expect(result.message).toContain('Timezone is required');
    });
    it('should validate that start time is before end time', async () => {
        const handler = new CalendarEventHandler(mockEnv);
        const request = new Request('http://localhost/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: 'Test Meeting',
                startTime: '2024-01-15T10:00:00Z', // After end time
                endTime: '2024-01-15T09:00:00Z', // Before start time 
                timezone: 'UTC'
            })
        });
        const response = await handler.handleCreateEvent(request);
        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.success).toBe(false);
        expect(result.message).toContain('start time must be before end time');
    });
    it('should validate invalid timezone identifiers', async () => {
        const handler = new CalendarEventHandler(mockEnv);
        const request = new Request('http://localhost/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: 'Test Meeting',
                startTime: '2024-01-15T09:00:00Z',
                endTime: '2024-01-15T10:00:00Z',
                timezone: 'InvalidTimezone'
            })
        });
        const response = await handler.handleCreateEvent(request);
        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid timezone identifier');
    });
    it('should validate attendee email format', async () => {
        const handler = new CalendarEventHandler(mockEnv);
        const request = new Request('http://localhost/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: 'Test Meeting',
                startTime: '2024-01-15T09:00:00Z',
                endTime: '2024-01-15T10:00:00Z',
                timezone: 'UTC',
                attendees: ['invalid-email', 'valid@example.com']
            })
        });
        const response = await handler.handleCreateEvent(request);
        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid email format');
    });
});
//# sourceMappingURL=calendar-event-creation.test.js.map