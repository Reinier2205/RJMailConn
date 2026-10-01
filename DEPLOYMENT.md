# Microsoft 365 Mail Connector - Deployment Checklist

## Pre-Deployment Requirements

### 1. Microsoft Entra ID Configuration
- [ ] Register application in Microsoft Entra ID (Azure AD)
- [ ] Configure Redirect URI: https://your-worker.workers.dev/auth/callback
- [ ] Add required API permissions:
  - [ ] openid
  - [ ] profile
  - [ ] email
  - [ ] offline_access
  - [ ] User.Read
  - [ ] Mail.Read
  - [ ] Mail.ReadWrite
  - [ ] Calendars.ReadWrite
- [ ] Grant admin consent for permissions
- [ ] Copy Client ID
- [ ] Create Client Secret and copy value

### 2. Cloudflare Setup
- [ ] Create Cloudflare Workers account
- [ ] Create D1 Database: `wrangler d1 create mail-connector-db`
- [ ] Note the database ID from output
- [ ] Update wrangler.jsonc with database binding

### 3. Database Migrations
- [ ] Run migrations in order:
  `powershell
  # Apply each migration
  wrangler d1 execute mail-connector-db --file=./migrations/0001_sync_state.sql
  wrangler d1 execute mail-connector-db --file=./migrations/0002_email_messages.sql
  wrangler d1 execute mail-connector-db --file=./migrations/0003_calendar_events.sql
  wrangler d1 execute mail-connector-db --file=./migrations/0004_audit_log.sql
  `

### 4. Configure Cloudflare Secrets
- [ ] Set Microsoft OAuth credentials:
  `powershell
  wrangler secret put CLIENT_ID
  wrangler secret put CLIENT_SECRET
  wrangler secret put TENANT_ID
  `
- [ ] Set API authentication token:
  `powershell
  wrangler secret put CONNECTOR_API_TOKEN
  # Generate secure token: openssl rand -base64 32
  `
- [ ] Verify secrets: `wrangler secret list`

### 5. Build and Deploy
- [ ] Run tests: `npm test`
- [ ] Build project: `npm run build`
- [ ] Test dry-run: `npx wrangler deploy --dry-run`
- [ ] Deploy to production: `npx wrangler deploy`

### 6. Initial Authentication
- [ ] Visit: https://your-worker.workers.dev/auth/login
- [ ] Complete Microsoft OAuth flow
- [ ] Verify authentication success

### 7. Verify Deployment
- [ ] Test health endpoint: `curl https://your-worker.workers.dev/health`
- [ ] Test status endpoint: `curl -H "Authorization: Bearer YOUR_TOKEN" https://your-worker.workers.dev/status`
- [ ] Manually trigger sync: `curl -X POST -H "Authorization: Bearer YOUR_TOKEN" https://your-worker.workers.dev/sync`
- [ ] Check sync status in status endpoint

### 8. Configure Cron Triggers
- [ ] Verify wrangler.jsonc cron schedule
- [ ] Default: Every hour at minute 15 (`15 * * * *`)
- [ ] Deploy triggers: `npx wrangler deploy`
- [ ] Verify in Cloudflare dashboard: Workers & Pages > Your Worker > Triggers

### 9. Morning Brief Testing
- [ ] Test brief endpoint: `curl -H "Authorization: Bearer YOUR_TOKEN" https://your-worker.workers.dev/brief`
- [ ] Verify email categorization
- [ ] Verify calendar events
- [ ] Check sync warnings

### 10. Integration
- [ ] Document your Worker URL
- [ ] Document API token location
- [ ] Configure morning brief consumer
- [ ] Set up monitoring/alerts (optional)

## Post-Deployment

### Monitoring
- Check Cloudflare Workers dashboard for:
  - Request metrics
  - Error rates
  - Execution duration
  - Cron trigger history

### Troubleshooting
- Review logs: Cloudflare dashboard > Workers > Your Worker > Logs
- Check sync status: `/status` endpoint
- Review audit logs: Query `audit_log` table in D1
- See TROUBLESHOOTING.md for common issues

## Security Notes
- **Never commit secrets to git**
- **Rotate API token regularly**
- **Monitor OAuth token refresh**
- **Review audit logs periodically**
- **Keep dependencies updated**

## Rollback Procedure
If deployment issues occur:
1. Revert to previous version: `wrangler rollback`
2. Check Cloudflare dashboard for deployment history
3. Restore database backup if needed (manual backup recommended)

## Support
- Documentation: README.md, SETUP.md, API.md
- Troubleshooting: TROUBLESHOOTING.md
- Architecture: ARCHITECTURE.md
- Security: SECURITY.md
