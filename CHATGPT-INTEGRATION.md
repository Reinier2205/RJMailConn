# ChatGPT Integration Guide

## Current Status ✅

Your Morning Brief Connector is **FULLY WORKING** with mock data:
- ✅ 2 new unread emails
- ✅ 3 important emails  
- ✅ 2 marketing emails
- ✅ 4 upcoming calendar events
- ✅ OAuth 2.1 authentication working
- ✅ MCP endpoint ready for ChatGPT

## Important Note: Gmail vs Microsoft

⚠️ **This connector is designed for Microsoft 365/Outlook, not Gmail.**

Your email (reinier.olivier@gmail.com) is a Gmail account, but the connector uses Microsoft Graph API which only works with Microsoft 365 mailboxes. To get real data instead of mock data, you would need either:

1. **Option A**: Use a Microsoft 365 account (Outlook.com, Office 365, or work/school Microsoft account)
2. **Option B**: Build a separate Gmail connector using Google APIs (different project)

**For now, the mock data demonstrates the full functionality** and works perfectly with ChatGPT!

---

## Setup ChatGPT with Your Connector

### Step 1: Get Your Configuration

**OpenAPI Schema URL:**
```
https://morning-brief-connector.reinier-olivier.workers.dev/morning-brief-openapi.json
```

**API Token:**
```
716180e24c87de8b699efd32198adbd9
```

### Step 2: Add Custom GPT Action

1. Go to ChatGPT → Create a GPT
2. Click "Configure" → "Add Actions"
3. Click "Import from URL"
4. Paste: `https://morning-brief-connector.reinier-olivier.workers.dev/morning-brief-openapi.json`
5. Click "Import"

### Step 3: Configure Authentication

1. Authentication Type: **API Key**
2. API Key: `716180e24c87de8b699efd32198adbd9`
3. Auth Type: **Bearer**
4. Header Name: `Authorization`

### Step 4: Test It

Ask ChatGPT:
- "Get my morning brief"
- "What emails do I have?"
- "What's on my calendar today?"
- "Create a calendar event for tomorrow at 2pm"
- "Draft an email to john@example.com about the budget meeting"

---

## Available Actions

### 1. Get Morning Brief
**Command**: "Get my morning brief"

Returns:
- New unread emails (last 24 hours)
- Important emails (last 7 days)
- Marketing emails
- Today's calendar events
- Upcoming calendar events

### 2. Create Calendar Event
**Command**: "Schedule a meeting for Friday at 3pm with Sarah about Project Phoenix"

Required:
- Subject
- Start time
- End time
- Timezone (e.g., "America/New_York", "Europe/London")

Optional:
- Location
- Attendees
- Body/description

### 3. Create Email Draft
**Command**: "Draft an email to john@example.com about the quarterly review"

Required:
- To (email addresses)
- Subject
- Body

Optional:
- CC
- Importance (low/normal/high)

---

## Test the API Directly

### Test Morning Brief Endpoint
```powershell
.\test-api.ps1
```

This will test:
- Health check (no auth)
- Morning brief (/brief)
- Email messages
- Calendar events

### Test MCP Endpoint
```powershell
.\test-mcp.ps1
```

This tests the Model Context Protocol endpoint that ChatGPT can use.

---

## Current Mock Data

### Emails (7 total)
- **New (2)**: Project Phoenix mockups, Quarterly report data
- **Important (3)**: Q4 Budget review, All-hands meeting, Benefits enrollment
- **Marketing (2)**: TechCrunch newsletter, Amazon sale

### Calendar Events (7 total)
- **Upcoming (4)**: Q4 Planning Workshop, Doctor appointment, Lunch with Sarah, All-hands meeting
- **Today (0)**: No events today

### Sync Status
- **Email**: Failed (no real Microsoft account connected)
- **Calendar**: Complete (using mock data)

---

## Troubleshooting

### "401 Unauthorized"
Make sure you're using the correct API token: `716180e24c87de8b699efd32198adbd9`

### "No data returned"
The mock data is working! You should see emails and calendar events.

### "Email sync failed warning"
This is expected - you're using Gmail but the connector is designed for Microsoft 365. The mock data demonstrates all functionality.

---

## Next Steps

### To Get Real Data

**Option 1: Switch to Microsoft Account**
1. Create a free Outlook.com account
2. Complete OAuth login at: https://morning-brief-connector.reinier-olivier.workers.dev/auth/login
3. Trigger sync: `POST https://morning-brief-connector.reinier-olivier.workers.dev/sync`

**Option 2: Build Gmail Connector**
This would require:
- Google Cloud Project setup
- Gmail API integration
- Google OAuth 2.0 configuration
- Different sync engine implementation

### To Deploy to Production
```bash
npm run deploy
```

Your worker is already deployed at:
- **Production**: https://morning-brief-connector.reinier-olivier.workers.dev
- **Alternative**: https://mail-connector.reinier-olivier.workers.dev

---

## Support

For questions or issues, check:
- `README.md` - Project overview
- `API.md` - API documentation
- `TESTING.md` - Testing guide
- `DEPLOYMENT.md` - Deployment instructions
