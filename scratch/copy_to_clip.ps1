$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceFile = Join-Path $scriptDir "index.php"
$content = Get-Content -LiteralPath $sourceFile -Raw -Encoding UTF8
Set-Clipboard -Value $content
Write-Host "SUCCESS: Latest index.php is now copied to your clipboard!"
