Get-ChildItem -Path "c:\Users\koma\OneDrive - 株式会社cocotte" -Filter "*.php" -Recurse -Depth 5 -ErrorAction SilentlyContinue | ForEach-Object {
    $hasMatch = Select-String -Path $_.FullName -Pattern "サービス4" -Quiet
    if ($hasMatch) {
        Write-Host "$($_.FullName) : $($_.Length) bytes"
    }
}
