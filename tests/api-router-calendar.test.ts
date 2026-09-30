/**
 * API Router Calendar Integration Tests
 * 
 * Tests for calendar endpoints integration with the API router
 */

import { describe, it, expect } from 'vitest';
import { APIRouter } from '../src/api/router';
import { Environment } from '../src/index';

// Mock environment for testing
const mockEnv: Environment = {
  MICROSOFT_CLIENT_ID: 'test-client-id',
  MICROSOFT_CLIENT_SECRET: 'test-client-secret', 
  MICROSOFT_TENANT_ID: 'test-tenant-id',
  CONNECTOR_API_TOKEN: 'test-api-token',
  DB: {} as any // Mock database
};

describe('API Router Calendar Integration', () => {
  it('should route POST /calendar/events to calendar handler', async () => {
    const router = new APIRouter(mockEnv);
    
    const request = new Request('http://localhost/calendar/events', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-api-token'
      },
      body: JSON.stringify({
        subject: 'Test Meeting',
        startTime: '2024-01-15T09:00:00Z',
        endTime: '2024-01-15T10:00:00Z',
        timezone: 'UTC'
      })
    });
    
    const response = await router.handleRequest(request);
    
    // Should route to calendar handler and return validation error (GraphClient not mocked)
    expect(response.status).not.toBe(404); // Not "Not Found"
    expect(response.status).not.toBe(501); // Not "Not Implemented" 
  });
  
  it('should require authentication for calendar endpoints', async () => {
    const router = new APIRouter(mockEnv);
    
    const request = new Request('http://localhost/calendar/events', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
        // Missing Authorization header
      },
      body: JSON.stringify({
        subject: 'Test Meeting',
        startTime: '2024-01-15T09:00:00Z', 
        endTime: '2024-01-15T10:00:00Z',
        timezone: 'UTC'
      })
    });
    
    const response = await router.handleRequest(request);
    expect(response.status).toBe(401);
    
    const result = await response.json() as any;
    expect(result.error).toContain('Authorization');
  });
  
  it('should handle PATCH /calendar/events/:id for updates', async () => {
    const router = new APIRouter(mockEnv);
    
    const request = new Request('http://localhost/calendar/events/test-event-id', {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-api-token'
      },
      body: JSON.stringify({
        subject: 'Updated Meeting',
        timezone: 'America/New_York'
      })
    });
    
    const response = await router.handleRequest(request);
    
    // Should route to calendar handler and return validation error (GraphClient not mocked)
    expect(response.status).not.toBe(404); // Not "Not Found"
    expect(response.status).not.toBe(501); // Not "Not Implemented"
  });
  
  it('should handle missing event ID for updates', async () => {
    const router = new APIRouter(mockEnv);
    
    const request = new Request('http://localhost/calendar/events/', {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-api-token'
      },
      body: JSON.stringify({
        subject: 'Updated Meeting'
      })
    });
    
    const response = await router.handleRequest(request);
    expect(response.status).toBe(400);
    
    const result = await response.json() as any;
    expect(result.error).toContain('Event ID is required');
  });
});