# Morning Brief Connector - MCP Endpoint Test Script
# Tests the Model Context Protocol JSON-RPC 2.0 endpoint

$API_TOKEN = "716180e24c87de8b699efd32198adbd9"  # Your actual token
$BASE_URL = "https://morning-brief-connector.reinier-olivier.workers.dev"
$MCP_ENDPOINT = "$BASE_URL/mcp"

$headers = @{
    "Authorization" = "Bearer $API_TOKEN"
    "Content-Type" = "application/json"
}

Write-Host "Testing MCP Endpoint (JSON-RPC 2.0)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Test 1: Initialize
Write-Host "1. Testing MCP Initialize..." -ForegroundColor Yellow
$initBody = @{
    jsonrpc = "2.0"
    id = 1
    method = "initialize"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri $MCP_ENDPOINT -Method POST -Headers $headers -Body $initBody -UseBasicParsing
    Write-Host "   ✓ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response:" -ForegroundColor Gray
    $json = $response.Content | ConvertFrom-Json
    Write-Host "   Server: $($json.result.serverInfo.name) v$($json.result.serverInfo.version)" -ForegroundColor Cyan
    Write-Host "   Protocol: $($json.result.protocolVersion)" -ForegroundColor Cyan
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: List Tools
Write-Host "2. Testing MCP Tools List..." -ForegroundColor Yellow
$toolsBody = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/list"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri $MCP_ENDPOINT -Method POST -Headers $headers -Body $toolsBody -UseBasicParsing
    Write-Host "   ✓ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response:" -ForegroundColor Gray
    $json = $response.Content | ConvertFrom-Json
    Write-Host "   Available tools:" -ForegroundColor Cyan
    foreach ($tool in $json.result.tools) {
        Write-Host "     - $($tool.name): $($tool.description)" -ForegroundColor White
    }
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Call get_morning_brief Tool
Write-Host "3. Testing get_morning_brief Tool..." -ForegroundColor Yellow
$callBody = @{
    jsonrpc = "2.0"
    id = 3
    method = "tools/call"
    params = @{
        name = "get_morning_brief"
        arguments = @{}
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-WebRequest -Uri $MCP_ENDPOINT -Method POST -Headers $headers -Body $callBody -UseBasicParsing
    Write-Host "   ✓ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response:" -ForegroundColor Gray
    $json = $response.Content | ConvertFrom-Json
    
    if ($json.result) {
        $briefData = $json.result.content[0].text | ConvertFrom-Json
        Write-Host "   - Status: $($briefData.status)" -ForegroundColor Cyan
        Write-Host "   - Generated at: $($briefData.generated_at)" -ForegroundColor Cyan
        Write-Host "   - New Emails: $($briefData.emails.new_messages.Count)" -ForegroundColor Cyan
        Write-Host "   - Important Emails: $($briefData.emails.important_messages.Count)" -ForegroundColor Cyan
        Write-Host "   - Today's Events: $($briefData.calendar.today_events.Count)" -ForegroundColor Cyan
        Write-Host "   - Upcoming Events: $($briefData.calendar.upcoming_events.Count)" -ForegroundColor Cyan
        if ($briefData.warnings.Count -gt 0) {
            Write-Host "   - Warnings: $($briefData.warnings.Count)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ✗ Error: $($json.error.message)" -ForegroundColor Red
    }
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

# Test 4: Test Invalid Method
Write-Host "4. Testing Invalid Method (Error Handling)..." -ForegroundColor Yellow
$invalidBody = @{
    jsonrpc = "2.0"
    id = 4
    method = "invalid/method"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri $MCP_ENDPOINT -Method POST -Headers $headers -Body $invalidBody -UseBasicParsing
    Write-Host "   ✓ Status: $($response.StatusCode)" -ForegroundColor Green
    $json = $response.Content | ConvertFrom-Json
    if ($json.error) {
        Write-Host "   Expected error received: $($json.error.message)" -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ Unexpected failure: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Test Missing Auth
Write-Host "5. Testing Missing Authentication..." -ForegroundColor Yellow
$noAuthHeaders = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-WebRequest -Uri $MCP_ENDPOINT -Method POST -Headers $noAuthHeaders -Body $initBody -UseBasicParsing
    Write-Host "   ✗ Should have failed but got: $($response.StatusCode)" -ForegroundColor Red
} catch {
    Write-Host "   ✓ Correctly rejected unauthenticated request" -ForegroundColor Green
}
Write-Host ""

Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "MCP Testing Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To use with ChatGPT or Claude, configure your MCP client with:" -ForegroundColor Yellow
Write-Host "  URL: $MCP_ENDPOINT" -ForegroundColor White
Write-Host "  Transport: HTTP/JSON-RPC 2.0" -ForegroundColor White
Write-Host "  Authentication: Bearer Token" -ForegroundColor White
Write-Host "  Header: Authorization: Bearer <YOUR_TOKEN>" -ForegroundColor White
