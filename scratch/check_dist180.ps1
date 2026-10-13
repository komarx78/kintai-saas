$lines = Get-Content 'C:\kintai-saas\dist\assets\index--jo5FU-T.js'
for ($i = 175; $i -le 185; $i++) {
    Write-Host "$i : $($lines[$i])"
}
