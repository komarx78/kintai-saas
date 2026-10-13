$bundleNames = @('index-C3E8RUOp.js', 'vendor-react-CIc66RXQ.js', 'vendor-utils-CDErB6At.js', 'vendor-form--LiGBYHG.js')

foreach ($name in $bundleNames) {
    $targetPath = Join-Path $PSScriptRoot $name
    curl.exe -s "https://kintai-saas.vercel.app/assets/$name" -o $targetPath
    $match = Select-String -Path $targetPath -Pattern "社労士のための" -Quiet -ErrorAction SilentlyContinue
    if ($match) {
        Write-Host "MATCH IN: $name"
    }
}
