$lines = Get-Content 'c:\Users\koma\OneDrive - 株式会社cocotte\GAS職人\販売用勤怠管理・有給管理\scratch\vercel_bundle.js'
for ($i = 8; $i -le 35; $i++) {
    Write-Host "LINE $i : $($lines[$i].Substring(0, [Math]::Min(200, $lines[$i].Length)))"
}
