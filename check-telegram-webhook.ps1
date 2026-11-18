$ErrorActionPreference = "Stop"
$line = Get-Content ".env.local" | Where-Object { $_ -match '\s*TELEGRAM_BOT_TOKEN\s*=' } | Select-Object -First 1
if (-not $line) { Write-Host "TELEGRAM_BOT_TOKEN not found"; exit 1 }
$token = ($line -split "=", 2)[1].Trim().Trim([char]34).Trim([char]39)
if ([string]::IsNullOrWhiteSpace($token)) { Write-Host "Bot token is empty"; exit 1 }
$url = "https://api.telegram.org/bot$token/getWebhookInfo"
try {
  $result = Invoke-RestMethod -Uri $url -Method Get
  $result.result | Select-Object url,pending_update_count,last_error_date,last_error_message,allowed_updates | Format-List
} catch {
  Write-Host "Telegram API request failed:" $_.Exception.Message
}
