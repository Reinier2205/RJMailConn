# Test Microsoft Graph API directly with stored access token
# This helps debug why sync is returning 0 items

Write-Host "Testing Microsoft Graph API..." -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Get the access token from the database
Write-Host "1. Fetching access token from database..." -ForegroundColor Yellow
$tokenQuery = "SELECT access_token, expires_at FROM oauth_tokens WHERE id = 'primary'"
$tokenResult = wrangler d1 execute mail-connector-db --remote --command $tokenQuery --json | ConvertFrom-Json

if ($tokenResult.success -and $tokenResult.results.Count -gt 0) {
    $accessToken = $tokenResult.results[0].access_token
    $expiresAt = $tokenResult.results[0].expires_at
    Write-Host "   ✓ Token retrieved" -ForegroundColor Green
    Write-Host "   Expires at: $expiresAt" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Failed to retrieve token" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 1: Get user profile
Write-Host "2. Testing /me endpoint..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $accessToken"
        "Accept" = "application/json"
    }
    
    $me = Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/me" -Headers $headers
    Write-Host "   ✓ User profile retrieved" -ForegroundColor Green
    Write-Host "   Name: $($me.displayName)" -ForegroundColor Cyan
    Write-Host "   Email: $($me.mail)" -ForegroundColor Cyan
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Get messages count
Write-Host "3. Testing /me/messages (first 10)..." -ForegroundColor Yellow
try {
    $messagesUrl = 'https://graph.microsoft.com/v1.0/me/messages?$top=10&$orderby=receivedDateTime desc&$select=id,subject,receivedDateTime,sender'
    $messages = Invoke-RestMethod -Uri $messagesUrl -Headers $headers
    
    Write-Host "   ✓ Messages retrieved: $($messages.value.Count)" -ForegroundColor Green
    
    if ($messages.value.Count -gt 0) {
        Write-Host ""
        Write-Host "   Recent messages:" -ForegroundColor Cyan
        foreach ($msg in $messages.value) {
            Write-Host "   - $($msg.receivedDateTime): $($msg.subject)" -ForegroundColor Gray
            $senderName = $msg.sender.emailAddress.name
            $senderEmail = $msg.sender.emailAddress.address
            Write-Host "     From: $senderName [$senderEmail]" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "   ⚠ No messages found" -ForegroundColor Yellow
    }
    
    if ($messages.'@odata.nextLink') {
        Write-Host ""
        Write-Host "   More messages available (nextLink exists)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $errorBody = $reader.ReadToEnd()
        Write-Host "   Error details: $errorBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 3: Get calendar events
Write-Host "4. Testing /me/events (next 7 days)..." -ForegroundColor Yellow
try {
    $startTime = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    $endTime = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ss")
    $eventsUrl = 'https://graph.microsoft.com/v1.0/me/events?$top=10&$orderby=start/dateTime&$filter=start/dateTime ge ''' + $startTime + ''' and end/dateTime le ''' + $endTime + ''''
    
    $events = Invoke-RestMethod -Uri $eventsUrl -Headers $headers
    
    Write-Host "   ✓ Events retrieved: $($events.value.Count)" -ForegroundColor Green
    
    if ($events.value.Count -gt 0) {
        Write-Host ""
        Write-Host "   Upcoming events:" -ForegroundColor Cyan
        foreach ($evt in $events.value) {
            Write-Host "   - $($evt.start.dateTime): $($evt.subject)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠ No events found in next 7 days" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Test complete!" -ForegroundColor Green
