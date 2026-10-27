# 의정지원 결과물을 바탕화면 폴더에 복사한다. (Windows PowerShell 5 이상)
#
# 사용법:
#   powershell -NoProfile -ExecutionPolicy Bypass -File uijeong/scripts/save-to-desktop.ps1 -Name "2026-10-27 한강버스 질의서" <파일1> <파일2> ...
#
# 하는 일:
#   1. Windows가 알려 주는 진짜 바탕화면 위치를 찾는다(OneDrive로 옮겨졌어도 따라감).
#   2. 바탕화면\행정지원\<Name>\ 폴더를 만들고 파일을 복사한다(같은 이름이면 덮어씀).
#   3. 마지막 줄에 SAVED: <폴더>를 찍는다. 바탕화면이 OneDrive 안이면 ONEDRIVE: 줄도 찍는다.
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$Base = '행정지원',
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Files
)

$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop) { $desktop = Join-Path $env:USERPROFILE 'Desktop' }
$target = Join-Path (Join-Path $desktop $Base) $Name
New-Item -ItemType Directory -Force -Path $target | Out-Null

$copied = 0
foreach ($f in $Files) {
  if ([string]::IsNullOrWhiteSpace($f)) { continue }
  if (Test-Path -LiteralPath $f -PathType Leaf) {
    Copy-Item -LiteralPath $f -Destination $target -Force
    $copied++
  } else {
    Write-Warning "파일이 없어 건너뜀: $f"
  }
}

if ($desktop -like '*OneDrive*') { Write-Output "ONEDRIVE: $desktop" }
Write-Output "COPIED: $copied"
Write-Output "SAVED: $target"
