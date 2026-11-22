# Writes .env for this computer: the database the app makes for itself, and its first admin.
# Called by setup.bat when there is no .env yet.
$ErrorActionPreference = 'Stop'
Write-Host ''
Write-Host '  Lotfy Bronze makes its own database "lotfy_bronze" - your other databases are not touched.'
$u = Read-Host '  PostgreSQL user (Enter = postgres)'
if (-not $u) { $u = 'postgres' }
$p = Read-Host '  PostgreSQL password'
$port = Read-Host '  PostgreSQL port (Enter = 5432)'
if (-not $port) { $port = '5432' }
$e = Read-Host '  Admin email for the app (Enter = admin@lotfybronze.com)'
if (-not $e) { $e = 'admin@lotfybronze.com' }
do { $a = Read-Host '  Admin password for the app (8 characters or more)' } while ($a.Length -lt 8)
$url = 'postgresql://' + [uri]::EscapeDataString($u) + ':' + [uri]::EscapeDataString($p) + '@localhost:' + $port + '/lotfy_bronze?schema=public'
$lines = @(
  "DATABASE_URL=""$url""",
  "ADMIN_EMAIL=""$e""",
  "ADMIN_PASSWORD=""$a""",
  '# plain http on this computer and the local network (no TLS)',
  'INSECURE_COOKIES=1'
)
$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $PSScriptRoot '..\.env'), ($lines -join "`r`n") + "`r`n", $enc)
Write-Host '  .env written.'
