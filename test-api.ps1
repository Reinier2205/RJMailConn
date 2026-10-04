# Morning Brief Connector - Test Script
# Replace YOUR_API_TOKEN with the CONNECTOR_API_TOKEN you created earlier

$API_TOKEN = "716180e24c87de8b699efd32198adbd9"  # Your actual token
$BASE_URL = "https://morning-brief-connector.reinier-olivier.workers.dev"

$headers = @{
    "Authorization" = "Bearer $API_TOKEN"
}

Write-Host "Testing Morning Brief Connector API" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check (no auth needed)
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/health" -UseBasicParsing
    Write-Host "   ✓ Status: $($response.StatusCode)" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Compress
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Morning Brief
Write-Host "2. Testing Brief Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/brief" -Headers $headers -UseBasicParsing
    Write-Host "   ✓ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response:" -ForegroundColor Gray
    $json = $response.Content | ConvertFrom-Json
    Write-Host "   - New Emails: $($json.emailData.new_messages.Count)" -ForegroundColor Cyan
    Write-Host "   - Important Emails: $($json.emailData.important_messages.Count)" -ForegroundColor Cyan
    Write-Host "   - Today's Events: $($json.calendarData.today_events.Count)" -ForegroundColor Cyan
    Write-Host "   - Upcoming Events: $($json.calendarData.upcoming_events.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        Write-Host "   Error: $($reader.ReadToEnd())" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: List Emails
Write-Host "3. Testing Email Messages Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/email/messages?limit=5" -Headers $headers -UseBasicParsing
    Write-Host "   ✓ Status: $($response.StatusCode)" -ForegroundColor Green
    $json = $response.Content | ConvertFrom-Json
    Write-Host "   Found $($json.messages.Count) recent emails" -ForegroundColor Cyan
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: List Calendar Events  
Write-Host "4. Testing Calendar Events Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/calendar/events?limit=5" -Headers $headers -UseBasicParsing
    Write-Host "   ✓ Status: $($response.StatusCode)" -ForegroundColor Green
    $json = $response.Content | ConvertFrom-Json
    Write-Host "   Found $($json.events.Count) upcoming events" -ForegroundColor Cyan
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Green
