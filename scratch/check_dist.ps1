$lines = Get-Content 'C:\kintai-saas\dist\assets\index--jo5FU-T.js'
for ($i = 210; $i -le 215; $i++) {
    Write-Host "$i : $($lines[$i])"
}
