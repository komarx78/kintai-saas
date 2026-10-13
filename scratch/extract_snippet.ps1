[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$file = Join-Path $PSScriptRoot "vercel_bundle.js"
$text = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$pos = $text.IndexOf("KinTai")
if ($pos -ge 0) {
    $start = [Math]::Max(0, $pos - 200)
    $len = [Math]::Min(600, $text.Length - $start)
    [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "match_snippet.txt"), $text.Substring($start, $len), [System.Text.Encoding]::UTF8)
    Write-Host "FOUND AND SAVED to match_snippet.txt at pos $pos"
} else {
    Write-Host "NOT FOUND"
}
