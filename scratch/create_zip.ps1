Add-Type -AssemblyName System.IO.Compression.FileSystem

$baseDir = "C:\Users\koma\OneDrive - 株式会社cocotte\HP作成"
$zipPath = Join-Path $baseDir "kap-theme.zip"
$bakZipPath = Join-Path $baseDir "kap-theme.zip.bak_20260928"

if (Test-Path $zipPath) {
    if (-not (Test-Path $bakZipPath)) {
        Copy-Item -LiteralPath $zipPath -Destination $bakZipPath -Force
    }
    Remove-Item -LiteralPath $zipPath -Force
}

$files = @(
    "functions.php",
    "index.php",
    "script.js",
    "style.css",
    "hero_bg.png",
    "icon_ai.png",
    "icon_consulting.png",
    "icon_finance.png",
    "icon_strength_execution.png",
    "icon_strength_finance.png",
    "icon_strength_strategy.png",
    "kap_logo.png",
    "work_ai.png",
    "work_consulting.png",
    "work_finance.png",
    "work_realestate.png"
)

$archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

foreach ($fileName in $files) {
    $filePath = Join-Path $baseDir $fileName
    if (Test-Path $filePath) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $filePath, $fileName)
        Write-Host "Added: $fileName"
    }
}

$archive.Dispose()
Write-Host "Successfully created updated kap-theme.zip!"
