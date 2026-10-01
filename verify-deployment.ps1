# Deployment Verification Script
Write-Host "Microsoft 365 Mail Connector - Deployment Verification" -ForegroundColor Cyan
Write-Host ""

$workerUrl = Read-Host "Enter your Worker URL (e.g., https://your-worker.workers.dev)"
$apiToken = Read-Host "Enter your API token" -AsSecureString
$apiTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiToken)
)

Write-Host ""
Write-Host "Testing endpoints..." -ForegroundColor Yellow

# Test health
Write-Host "1. Health check..." -NoNewline
try {
    $health = Invoke-RestMethod -Uri "$workerUrl/health" -Method Get
    Write-Host " ✓" -ForegroundColor Green
} catch {
    Write-Host " ✗" -ForegroundColor Red
}

# Test version
Write-Host "2. Version check..." -NoNewline
try {
    $version = Invoke-RestMethod -Uri "$workerUrl/version" -Method Get
    Write-Host " ✓" -ForegroundColor Green
} catch {
    Write-Host " ✗" -ForegroundColor Red
}

# Test status (requires auth)
Write-Host "3. Status check (authenticated)..." -NoNewline
try {
    $headers = @{ Authorization = "Bearer $apiTokenPlain" }
    $status = Invoke-RestMethod -Uri "$workerUrl/status" -Method Get -Headers $headers
    Write-Host " ✓" -ForegroundColor Green
    Write-Host "   Email sync: $($status.data_sources.email.status)" -ForegroundColor Gray
    Write-Host "   Calendar sync: $($status.data_sources.calendar.status)" -ForegroundColor Gray
} catch {
    Write-Host " ✗" -ForegroundColor Red
}

Write-Host ""
Write-Host "Verification complete!" -ForegroundColor Green
