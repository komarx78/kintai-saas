$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# scratch -> 販売用勤怠管理・有給管理 -> GAS職人 -> OneDrive
$oneDriveDir = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptDir))
$hpDir = (Get-ChildItem -Path $oneDriveDir -Directory -Filter "*HP*").FullName

$sourcePhp = Join-Path $hpDir "index.php"
$targetHtml = Join-Path $hpDir "index.html"
$targetPreview = Join-Path $hpDir "kap_hp_preview.html"

$phpContent = Get-Content -LiteralPath $sourcePhp -Raw -Encoding UTF8

$htmlContent = $phpContent -replace '<\?php language_attributes\(\); \?>', 'lang="ja"'
$htmlContent = $htmlContent -replace '<\?php bloginfo\( ''charset'' \); \?>', 'UTF-8'
$htmlContent = $htmlContent -replace '<\?php wp_head\(\); \?>', '<link rel="stylesheet" href="style.css">'
$htmlContent = $htmlContent -replace '<\?php body_class\(\); \?>', 'class="home blog"'
$htmlContent = $htmlContent -replace '<\?php echo get_template_directory_uri\(\); \?>', '.'
$htmlContent = $htmlContent -replace '<\?php wp_footer\(\); \?>', '<script src="script.js"></script>'

Set-Content -LiteralPath $targetHtml -Value $htmlContent -Encoding UTF8
Set-Content -LiteralPath $targetPreview -Value $htmlContent -Encoding UTF8

(Get-Item -LiteralPath $targetHtml).LastWriteTime = Get-Date
(Get-Item -LiteralPath $sourcePhp).LastWriteTime = Get-Date

# クリップボードにも再注入
Set-Clipboard -Value $phpContent

Write-Host "ALL_SUCCESS: HP directory found at $hpDir"
Write-Host "Clipboard updated with $( (Get-Clipboard).Count ) lines."
