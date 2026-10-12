# Morning Brief Connector

A Cloudflare Worker that connects Gmail and Google Calendar to Reinier's Morning Intelligence Brief, powered by Gemini.

## What it does

- Syncs Gmail and Google Calendar into Cloudflare D1 on a daily schedule
- Serves a `/brief` endpoint with categorised emails, calendar events, and the Master Action List
- Stores the Master Action List (actions, standing rules, financial state, system prompt) in D1
- Exposes `/getmymail` — a dashboard to view the brief and upload the updated JSON from Gemini
- Provides MCP-compatible endpoints for AI assistant access via OAuth 2.1

## Daily workflow

1. Open `/getmymail` → click **Sync** to pull the latest Gmail + Calendar data
2. Click **Copy JSON** → paste into the Gemini Morning Brief project chat
3. Work through the brief with Gemini; at the end Gemini outputs the updated Master JSON
4. Click **Upload from Gemini** → paste the JSON → **Upload & Save**

## Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/brief` | Full morning brief (emails, calendar, action list) |
| POST | `/sync` | Trigger manual sync from Gmail + Calendar |
| GET | `/actions` | Return full Master JSON payload |
| POST | `/actions/import` | Replace Master JSON (accepts Gemini output shape) |
| GET | `/getmymail` | Dashboard UI |
| GET | `/health` | Basic health check |
| GET | `/status` | Detailed system status (auth required) |

## Tech stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (SQLite)
- **Email/Calendar:** Gmail API + Google Calendar API (OAuth 2.0)
- **AI:** Gemini (via Google AI Studio project chat)
- **MCP:** OAuth 2.1 with PKCE for MCP client access

## Setup

See [SETUP.md](SETUP.md) for full configuration instructions.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment steps.
