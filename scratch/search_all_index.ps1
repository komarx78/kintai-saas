$files = Get-ChildItem -Path "c:\Users\koma" -Filter "index.php" -Recurse -Depth 4 -ErrorAction SilentlyContinue

foreach ($file in $files) {
    $hasRakumaru = Select-String -Path $file.FullName -Pattern "rakumaru-saas" -Quiet
    $has14days = Select-String -Path $file.FullName -Pattern "14日間" -Quiet
    Write-Host "$($file.FullName) | Size: $($file.Length) | Date: $($file.LastWriteTime) | HasRakumaru: $hasRakumaru | Has14days: $has14days"
}
