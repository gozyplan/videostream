
$ErrorActionPreference = "Stop"

$file = "app\premium\page.tsx"
$path = Join-Path (Get-Location) $file

if (-not (Test-Path $path)) {
    throw "File not found: $path"
}

$content = [System.IO.File]::ReadAllText($path)

# 1. Check whether the previous patch has already been applied.
if ($content.Contains("onClick={handleTelegramLink}") -and
    $content.Contains("async function handleTelegramLink()")) {
    Write-Host "Telegram linking patch is already applied." -ForegroundColor Yellow
    exit 0
}

# 2. Remove the old direct Telegram URL constant.
$constantPattern = '(?m)^const TELEGRAM_CHANNEL_URL\s*=\s*\r?\n\s*"https://t\.me/\+cbNYXxM7PhAxZDJl";\r?\n?'

$content = [regex]::Replace($content, $constantPattern, "", 1)

# 3. Add the state variables.
$oldState = @'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
'@

$newState = @'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState("");
'@

if (-not $content.Contains("const [telegramLoading, setTelegramLoading]")) {
    if (-not $content.Contains($oldState)) {
        throw "Could not find the state section. No file saved."
    }

    $content = $content.Replace($oldState, $newState)
}

# 4. Add the Telegram linking handler.
$oldHandler = '  async function handleLogout() {'

$newHandler = @'
  async function handleTelegramLink() {
    setTelegramLoading(true);
    setTelegramMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setTelegramMessage("Please log in again, then retry.");
        return;
      }

      const response = await fetch("/api/telegram/link-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result?.token) {
        setTelegramMessage(
          result?.error || "Could not create Telegram link. Please try again."
        );
        return;
      }

      window.location.href =
        `https://t.me/gozyplan_bot?start=${encodeURIComponent(result.token)}`;
    } catch (err) {
      console.error("Telegram linking error:", err);
      setTelegramMessage("Telegram linking failed. Please try again.");
    } finally {
      setTelegramLoading(false);
    }
  }

  async function handleLogout() {
'@

if (-not $content.Contains("async function handleTelegramLink()")) {
    if (-not $content.Contains($oldHandler)) {
        throw "Could not find handleLogout(). No file saved."
    }

    $content = $content.Replace($oldHandler, $newHandler)
}

# 5. Replace the existing Telegram anchor, regardless of text encoding.
$buttonIndex = $content.IndexOf("href={TELEGRAM_CHANNEL_URL}")

if ($buttonIndex -ge 0) {
    $start = $content.LastIndexOf("<a", $buttonIndex)
    $end = $content.IndexOf("</a>", $buttonIndex)

    if ($start -lt 0 -or $end -lt 0) {
        throw "Could not locate the old Telegram link. No file saved."
    }

    $end += 4

    $newButton = @'
<button
                  type="button"
                  onClick={handleTelegramLink}
                  disabled={telegramLoading}
                  className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#229ED9] px-8 py-4 text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#168dcc] hover:shadow-2xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {telegramLoading ? "Connecting..." : "Connect Telegram"}
                  <span className="text-lg">→</span>
                </button>

                {telegramMessage && (
                  <p className="mt-4 text-sm text-red-300" role="alert">
                    {telegramMessage}
                  </p>
                )}
'@

    $content = $content.Substring(0, $start) +
        $newButton +
        $content.Substring($end)
}
elseif (-not $content.Contains("onClick={handleTelegramLink}")) {
    throw "Old Telegram link was not found. No file saved."
}

# 6. Save only after all required changes have been prepared.
[System.IO.File]::WriteAllText(
    $path,
    $content,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Premium Telegram linking patch applied successfully." -ForegroundColor Green
