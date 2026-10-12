param([string]$SourceFolder = "$env:USERPROFILE\Downloads")
$ErrorActionPreference = 'Stop'
$target = Join-Path (Split-Path -Parent $PSScriptRoot) 'public\animations'
$segments = @('01_hero_01-02','02_hero_to_cluster_02-03','03_cluster_03-04','04_cluster_to_roast_04-05','05_roasting_05-06','06_roast_to_grind_06-07','07_grinding_07-08','08_grind_to_brew_08-09','09_brewing_09-10','10_final_cup_10-11')
if (-not (Test-Path $SourceFolder)) { Write-Host "Downloads folder not found: $SourceFolder"; exit 1 }
New-Item -Path $target -ItemType Directory -Force | Out-Null
$zipFiles = Get-ChildItem -LiteralPath $SourceFolder -Filter '*.zip' -File | Where-Object { $_.Name -match '(NOIR|hero|cluster|roast|grind|brew|final.cup)' }
if ($zipFiles.Count -eq 0) { Write-Host 'No animation ZIPs found. Put the 10 animation ZIPs in Downloads first.'; exit 1 }
$tmp = Join-Path $env:TEMP ('noir_frames_' + [guid]::NewGuid().ToString('N'))
New-Item -Path $tmp -ItemType Directory -Force | Out-Null
try {
  foreach ($zip in $zipFiles) {
    $extractPath = Join-Path $tmp ([guid]::NewGuid().ToString('N'))
    Write-Host "Reading $($zip.Name)..."
    Expand-Archive -LiteralPath $zip.FullName -DestinationPath $extractPath -Force
    $files = Get-ChildItem -LiteralPath $extractPath -Filter 'frame_*.webp' -File -Recurse
    foreach ($f in $files) {
      $segment = $null
      foreach ($candidate in $segments) {
        if ($f.FullName.Contains($candidate)) { $segment = $candidate; break }
      }
      if (-not $segment -and ($f.FullName -match '(final_cup|Final.Cup)')) { $segment = '10_final_cup_10-11' }
      if (-not $segment) { continue }
      $to = Join-Path $target $segment
      New-Item -Path $to -ItemType Directory -Force | Out-Null
      Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $to $f.Name) -Force
    }
    Remove-Item -LiteralPath $extractPath -Recurse -Force
  }
  foreach ($segment in $segments) {
    $p=Join-Path $target $segment
    $n = if (Test-Path $p) { (Get-ChildItem -LiteralPath $p -Filter 'frame_*.webp' -File).Count } else { 0 }
    Write-Host "$segment : $n / 240 frames"
  }
} finally { if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force } }
Write-Host 'Frame import finished.'
