$dirs = @("C:\kintai-saas", "c:\Users\koma\OneDrive - 株式会社cocotte")
foreach ($d in $dirs) {
    if (Test-Path $d) {
        $files = Get-ChildItem -Path $d -Recurse -Depth 4 -Include *.tsx,*.ts,*.html,*.jsx,*.js -ErrorAction SilentlyContinue
        foreach ($f in $files) {
            $m = Select-String -Path $f.FullName -Pattern "勤怠も、年休も" -Quiet -ErrorAction SilentlyContinue
            if ($m) {
                Write-Host "FOUND: $($f.FullName)"
            }
        }
    }
}
