$file = Join-Path $PSScriptRoot "vercel_bundle.js"
$lines = Get-Content -LiteralPath $file
Write-Host "Total Lines: $($lines.Length)"
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '社労士のための|KinTai') {
        Write-Host "MATCH LINE $i :"
        $idx = $lines[$i].IndexOf('社労士のための')
        if ($idx -ge 0) {
            $start = [Math]::Max(0, $idx - 100)
            $len = [Math]::Min(300, $lines[$i].Length - $start)
            Write-Host $lines[$i].Substring($start, $len)
        }
    }
}
