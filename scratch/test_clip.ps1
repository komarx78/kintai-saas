$c = Get-Clipboard
Write-Host "CLIPBOARD_LINES: $($c.Count)"
Write-Host "FIRST_LINE: $($c[0])"
