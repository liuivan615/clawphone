# ClawPhone Cloudflare Tunnel
# Usage: powershell -ExecutionPolicy Bypass -File scripts\start-tunnel.ps1
#
# Prerequisites: winget install Cloudflare.cloudflared

$port = if ($env:PORT) { $env:PORT } else { "3000" }

Write-Host ""
Write-Host "  ClawPhone Tunnel" -ForegroundColor Cyan
Write-Host "  ================" -ForegroundColor DarkGray
Write-Host ""

# Check cloudflared
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "  cloudflared not found!" -ForegroundColor Red
    Write-Host "  Install: winget install Cloudflare.cloudflared" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "  Starting tunnel to localhost:$port ..." -ForegroundColor Gray
Write-Host "  Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

# Run cloudflared and capture the URL
cloudflared tunnel --url "http://localhost:$port" 2>&1 | ForEach-Object {
    if ($_ -match "https://[a-z0-9-]+\.trycloudflare\.com") {
        $url = $Matches[0]
        Write-Host ""
        Write-Host "  Your tunnel URL:" -ForegroundColor Green
        Write-Host "  $url" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Open this on your phone!" -ForegroundColor Yellow
        Write-Host ""

        # Save URL to a file so the server can serve it
        $url | Out-File -FilePath "$PSScriptRoot\..\tunnel-url.txt" -Encoding UTF8 -NoNewline
    }
    Write-Host $_
}
