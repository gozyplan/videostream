
$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot ".env.local"

if (!(Test-Path $envFile)) {
    throw ".env.local file nahi mili."
}

$vars = @{}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*(TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK_SECRET)\s*=\s*(.*?)\s*$') {
        $value = $Matches[2].Trim()
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $vars[$Matches[1]] = $value
    }
}

$botToken = $vars["TELEGRAM_BOT_TOKEN"]
$secret = $vars["TELEGRAM_WEBHOOK_SECRET"]

if ([string]::IsNullOrWhiteSpace($botToken) -or
    [string]::IsNullOrWhiteSpace($secret)) {
    throw ".env.local mein bot token ya webhook secret nahi mila."
}

$body = @{
    url = "https://www.hdlink.fun/api/telegram/webhook"
    secret_token = $secret
    allowed_updates = @("message", "chat_member")
    drop_pending_updates = $false
}

$result = Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.telegram.org/bot$botToken/setWebhook" `
    -ContentType "application/json" `
    -Body ($body | ConvertTo-Json -Depth 5)

if ($result.ok) {
    Write-Host "Telegram webhook registered successfully."
    Write-Host "Description:" $result.description
} else {
    Write-Host "Telegram rejected webhook registration."
}
