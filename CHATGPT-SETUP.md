# How to Connect Your Morning Brief to ChatGPT

## Overview
This guide shows you how to create a Custom GPT that can access your Microsoft 365 emails and calendar through your Morning Brief Connector.

## Prerequisites
✓ Morning Brief Connector deployed (DONE!)
✓ API Token: 716180e24c87de8b699efd32198adbd9
✓ ChatGPT Plus or Enterprise account (required for Custom GPTs)

---

## Step 1: Create Your Custom GPT

1. Go to https://chat.openai.com
2. Click your profile picture (bottom left)
3. Select **"My GPTs"**
4. Click **"+ Create"**

---

## Step 2: Configure Basic Settings

### Name
```
Morning Intelligence Brief
```

### Description
```
Your personal AI assistant that provides daily briefings on emails and calendar events from Microsoft 365.
```

### Instructions
```
You are a Morning Intelligence Brief assistant for Reinier Olivier.

When the user requests their morning brief, you should:

1. Call the getMorningBrief action to fetch emails and calendar data
2. Analyze and summarize the information intelligently
3. Present a well-organized brief with:
   - **New & Important Emails**: Highlight urgent or priority messages
   - **Today's Schedule**: List events with times and locations
   - **Upcoming Week**: Show important events in the next 7 days
   - **Action Items**: Suggest priorities or items needing attention

Guidelines:
- Be concise but thorough
- Highlight time-sensitive items
- Group related information
- Suggest priorities when appropriate
- Use clear formatting with bullet points and sections
- If the user asks to create events or drafts, use the appropriate actions

Always maintain a professional, helpful tone.
```

---

## Step 3: Add API Actions

1. In the GPT editor, scroll down to **"Actions"**
2. Click **"Create new action"**
3. Click **"Import from URL"** or **"Schema"**

### Option A: Import from URL (Easiest)
Not available since your API doesn't host the schema file.

### Option B: Paste Schema
1. Open the file: `morning-brief-openapi.json`
2. Copy the entire contents
3. Paste into the schema editor
4. Click **"Save"**

---

## Step 4: Configure Authentication

After importing the schema:

1. Scroll down to **"Authentication"**
2. Select **"API Key"**
3. Choose **"Bearer"**
4. Enter your API token:
   ```
   716180e24c87de8b699efd32198adbd9
   ```
5. Click **"Save"**

---

## Step 5: Configure Privacy

1. Set **"Conversation starters"** (optional examples):
   ```
   - "Give me my morning brief"
   - "What's on my calendar today?"
   - "Show me my important emails"
   - "Create a meeting for tomorrow at 2pm"
   ```

2. Under **"Additional Settings"**:
   - Enable **"Web Browsing"** (optional)
   - Enable **"Code Interpreter"** (optional)

---

## Step 6: Test Your GPT

1. Click **"Preview"** or **"Save"**
2. In the chat, try:
   ```
   Give me my morning brief
   ```

The GPT should:
1. Call your `/brief` endpoint
2. Receive the email and calendar data
3. Present it in a nice, formatted summary

---

## Step 7: Publish Your GPT

1. Click **"Save"**
2. Choose visibility:
   - **"Only me"** (recommended - private use)
   - **"Anyone with the link"**
   - **"Public"**

3. Click **"Confirm"**

---

## Usage Examples

Once set up, you can ask your GPT:

**Basic Brief:**
- "Give me my morning brief"
- "What do I need to know today?"
- "Show me today's schedule"

**Specific Queries:**
- "What important emails do I have?"
- "What meetings are coming up this week?"
- "Do I have anything urgent?"

**Actions:**
- "Create a meeting tomorrow at 2pm with john@example.com"
- "Draft an email to sarah@example.com about the project update"

---

## Troubleshooting

### GPT says "I couldn't fetch your data"
- Check that your API token is correct in the GPT settings
- Verify the Worker is accessible: https://morning-brief-connector.reinier-olivier.workers.dev/health
- Run the test script: `.\test-api.ps1`

### No emails/events showing
- The sync runs daily at 6 AM UTC
- After first sync, data will appear
- Check the /brief endpoint returns data: `.\test-api.ps1`

### Authentication errors
- Verify your API token is set correctly in the GPT configuration
- Token: 716180e24c87de8b699efd32198adbd9

---

## Security Notes

✓ Your API token is private - only you can access your data
✓ The Custom GPT runs in your ChatGPT account - private by default
✓ OpenAI cannot access your emails/calendar data without your token
✓ Set GPT visibility to "Only me" for maximum privacy

---

## Next Steps

After setup:
1. Wait for first sync (6 AM UTC) or trigger manually
2. Test the GPT with "Give me my morning brief"
3. Adjust the instructions to match your preferences
4. Add custom conversation starters

Enjoy your AI-powered Morning Intelligence Brief! 🎉
