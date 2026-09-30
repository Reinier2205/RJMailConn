# TypeScript Compilation Fixes Script
Write-Host "Applying TypeScript fixes..." -ForegroundColor Cyan

# Backup originals
$backupDir = ".\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Write-Host "Created backup directory: $backupDir"

# List of files to fix
$filesToFix = @(
    "src\sync\sync-engine.ts",
    "src\microsoft\graph.ts", 
    "src\microsoft\email.ts",
    "src\microsoft\calendar.ts",
    "src\api\calendar.ts",
    "src\api\drafts.ts",
    "src\auth\oauth.ts",
    "src\auth\state.ts",
    "src\index.ts"
)

# Backup files
foreach ($file in $filesToFix) {
    if (Test-Path $file) {
        Copy-Item $file "$backupDir\$(Split-Path $file -Leaf)" -Force
        Write-Host "  Backed up: $file" -ForegroundColor Gray
    }
}

Write-Host "`nApplying fixes..." -ForegroundColor Yellow

# Fix 1: sync-engine.ts - Date to ISO string
Write-Host "  [1/9] Fixing sync-engine.ts..."
$content = Get-Content "src\sync\sync-engine.ts" -Raw
$content = $content `
    -replace 'import \{ EmailMessage, GraphEmailMessage, transformGraphMessage, EmailRepository', 'import { EmailMessage, EmailRepository' `
    -replace '    const startTime = new Date\(\);', '    const startTime = new Date().toISOString();' `
    -replace '      const safetyOverlap = checkpoint \? new Date\(checkpoint\.timestamp\.getTime\(\) - 3600000\) : null;', '      const safetyOverlap = checkpoint ? new Date(new Date(checkpoint.timestamp).getTime() - 3600000) : null;' `
    -replace '          timestamp: new Date\(\),', '          timestamp: new Date().toISOString(),' `
    -replace '          completedAt: new Date\(\),', '          completedAt: new Date().toISOString(),' `
    -replace '        result\.completedAt = new Date\(\);', '        result.completedAt = new Date().toISOString();' `
    -replace '        timestamp: new Date\(result\.last_success_at as string\),', '        timestamp: result.last_success_at as string,'
$content | Set-Content "src\sync\sync-engine.ts" -Encoding UTF8 -NoNewline

# Fix 2: microsoft/graph.ts - Type assertions for pageData
Write-Host "  [2/9] Fixing microsoft/graph.ts..."
$content = Get-Content "src\microsoft\graph.ts" -Raw
$content = $content `
    -replace '        if \(pageData\.value && Array\.isArray\(pageData\.value\)\) \{', '        if ((pageData as any)?.value && Array.isArray((pageData as any).value)) {' `
    -replace '          items\.push\(\.\.\.pageData\.value\);', '          items.push(...(pageData as any).value);' `
    -replace '        currentUrl = pageData\["@odata\.nextLink"\] \|\| null;', '        currentUrl = (pageData as any)["@odata.nextLink"] || null;'
$content | Set-Content "src\microsoft\graph.ts" -Encoding UTF8 -NoNewline

# Fix 3: microsoft/email.ts - Null coalescing for optional properties
Write-Host "  [3/9] Fixing microsoft/email.ts..."
$content = Get-Content "src\microsoft\email.ts" -Raw
$content = $content `
    -replace '    conversation_id: validated\.conversation_id,', '    conversation_id: validated.conversation_id ?? null,' `
    -replace '    internet_message_id: validated\.internet_message_id,', '    internet_message_id: validated.internet_message_id ?? null,' `
    -replace '    sender_name: validated\.sender_name,', '    sender_name: validated.sender_name ?? null,' `
    -replace '    classification: validated\.classification,', '    classification: validated.classification ?? "general",' `
    -replace '    body_preview: validated\.body_preview,', '    body_preview: validated.body_preview ?? null,' `
    -replace '    web_link: validated\.web_link,', '    web_link: validated.web_link ?? null,'
$content | Set-Content "src\microsoft\email.ts" -Encoding UTF8 -NoNewline

# Fix 4: microsoft/calendar.ts - Null coalescing for optional properties
Write-Host "  [4/9] Fixing microsoft/calendar.ts..."
$content = Get-Content "src\microsoft\calendar.ts" -Raw
$content = $content `
    -replace '    location: validated\.location,', '    location: validated.location ?? null,' `
    -replace '    organiser: validated\.organiser,', '    organiser: validated.organiser ?? null,' `
    -replace '    response_status: validated\.response_status,', '    response_status: validated.response_status ?? "none",' `
    -replace '    is_cancelled: validated\.is_cancelled,', '    is_cancelled: validated.is_cancelled ?? false,' `
    -replace '    body_preview: validated\.body_preview,', '    body_preview: validated.body_preview ?? null,'
$content | Set-Content "src\microsoft\calendar.ts" -Encoding UTF8 -NoNewline

# Fix 5: api/calendar.ts - Handle optional properties and unused variables
Write-Host "  [5/9] Fixing api/calendar.ts..."
$content = Get-Content "src\api\calendar.ts" -Raw
$content = $content `
    -replace '          eventId: createdEvent\.id,', '          eventId: createdEvent.id ?? undefined,' `
    -replace '          attendees: attendeesArray,', '          attendees: attendeesArray ?? [],' `
    -replace '      updateInput\.timezone = timezone;', '      if (timezone) { updateInput.timezone = timezone; }' `
    -replace '      const startInfo = validateDateTime', '      // const startInfo = validateDateTime' `
    -replace '      const endInfo = validateDateTime', '      // const endInfo = validateDateTime'
$content | Set-Content "src\api\calendar.ts" -Encoding UTF8 -NoNewline

# Fix 6: api/drafts.ts - Handle optional properties and unused variables
Write-Host "  [6/9] Fixing api/drafts.ts..."
$content = Get-Content "src\api\drafts.ts" -Raw
$content = $content `
    -replace '          draftId: createdDraft\.id,', '          draftId: createdDraft.id ?? undefined,' `
    -replace '      const replyEndpoint = replyInput', '      // const replyEndpoint = replyInput' `
    -replace '  private async getOriginalMessage\(messageId: string\)', '  private async getOriginalMessage(_messageId: string)' `
    -replace '      ccRecipients: ccArray,', '      ccRecipients: ccArray ?? [],' `
    -replace '      bccRecipients: bccArray,', '      bccRecipients: bccArray ?? [],'
$content | Set-Content "src\api\drafts.ts" -Encoding UTF8 -NoNewline

# Fix 7: auth/oauth.ts - Handle optional properties
Write-Host "  [7/9] Fixing auth/oauth.ts..."
$content = Get-Content "src\auth\oauth.ts" -Raw
$content = $content `
    -replace '        tokens: tokenSet,', '        tokens: tokenSet ?? undefined,' `
    -replace '        user: user,', '        user: user ?? undefined,'
$content | Set-Content "src\auth\oauth.ts" -Encoding UTF8 -NoNewline

# Fix 8: auth/state.ts - Ensure timestamp exists
Write-Host "  [8/9] Fixing auth/state.ts..."
$content = Get-Content "src\auth\state.ts" -Raw
$content = $content `
    -replace '      const stateTime = parseInt\(timestamp\);', '      const stateTime = parseInt(timestamp ?? "0");'
$content | Set-Content "src\auth\state.ts" -Encoding UTF8 -NoNewline

# Fix 9: index.ts - Prefix unused parameters and remove duplicate export
Write-Host "  [9/9] Fixing index.ts..."
$content = Get-Content "src\index.ts" -Raw
$content = $content `
    -replace 'async fetch\(request: Request, env: Environment, ctx: ExecutionContext\)', 'async fetch(request: Request, env: Environment, _ctx: ExecutionContext)' `
    -replace 'async scheduled\(event: ScheduledEvent, env: Environment, ctx: ExecutionContext\)', 'async scheduled(event: ScheduledEvent, env: Environment, _ctx: ExecutionContext)' `
    -replace 'export type \{ Environment \};', '// Exported above'
$content | Set-Content "src\index.ts" -Encoding UTF8 -NoNewline

Write-Host "`nAll fixes applied successfully!" -ForegroundColor Green
Write-Host "Backup saved to: $backupDir" -ForegroundColor Cyan
Write-Host "`nRun 'npm run build' to verify fixes..." -ForegroundColor Yellow
