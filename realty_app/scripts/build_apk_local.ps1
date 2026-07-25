# build_apk_local.ps1 - TRUE local APK (no DCloud cloud quota)
#
# Reality check:
#   HBuilderX "cli pack" / "发行-云打包" = CLOUD pack (uses daily quota)
#   This script = OFFLINE pack using DCloud Android offline SDK + Gradle
#
# Prerequisites (one-time):
#   1. Download offline SDK matching HBuilderX 5.15.2026070915
#      https://nativesupport.dcloud.net.cn/AppDocs/download/android.html
#      Baidu Pan extract code: jrrb
#      Unzip to: C:\AndroidOffline\HBuilder-Integrate-AS
#   2. Install Android Studio (or at least have ANDROID_HOME + Gradle)
#   3. Keystore already at: %USERPROFILE%\realty-release.keystore
#      alias=realty  storepass=realty123  keypass=realty123
#
# Usage:
#   powershell -File realty_app\scripts\build_apk_local.ps1
#   powershell -File realty_app\scripts\build_apk_local.ps1 -SdkRoot "D:\AndroidOffline\HBuilder-Integrate-AS"

param(
  [string]$SdkRoot = "",
  [string]$Keystore = "$env:USERPROFILE\realty-release.keystore",
  [string]$StorePass = "realty123",
  [string]$KeyAlias = "realty",
  [string]$KeyPass = "realty123",
  [switch]$SkipBuild
)

# 自动探测本机离线 SDK（优先带版本号的官方包路径）
if (-not $SdkRoot) {
  $candidates = @(
    "C:\AndroidOffline\Android-SDK@5.15.82650_20260710\HBuilder-Integrate-AS",
    "C:\AndroidOffline\HBuilder-Integrate-AS"
  )
  foreach ($c in $candidates) {
    if (Test-Path (Join-Path $c "simpleDemo")) { $SdkRoot = $c; break }
  }
  if (-not $SdkRoot) { $SdkRoot = $candidates[0] }
}

$ErrorActionPreference = "Stop"
$AppRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $AppRoot

Write-Host "=== realty_app LOCAL APK (offline SDK) ===" -ForegroundColor Cyan
Write-Host "AppRoot = $AppRoot"
Write-Host "SdkRoot = $SdkRoot"

# --- 0. env ---
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "C:\Android" }
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = "E:\jl_tool\HBuilderX\plugins\amazon-corretto" }
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

# --- 1. check offline SDK ---
$demo = Join-Path $SdkRoot "simpleDemo"
if (-not (Test-Path $demo)) {
  Write-Host ""
  Write-Host "[MISSING] Offline SDK not found at: $SdkRoot" -ForegroundColor Red
  Write-Host ""
  Write-Host "Do this once:" -ForegroundColor Yellow
  Write-Host "  1. Open: https://nativesupport.dcloud.net.cn/AppDocs/download/android.html"
  Write-Host "  2. Download HBuilderX 5.15.2026070915 Android offline SDK (Baidu, code: jrrb)"
  Write-Host "  3. Unzip so this path exists:"
  Write-Host "       $SdkRoot\simpleDemo\"
  Write-Host "  4. Re-run this script"
  Write-Host ""
  Write-Host "Until then, use existing APK + OTA:" -ForegroundColor Cyan
  Write-Host "  $AppRoot\unpackage\release\apk\RealtyApp-1.120.0-121.apk"
  Write-Host "  Phone: Settings -> Check Update -> pull v1.121.3"
  exit 2
}

# --- 2. build app resources (www) ---
if (-not $SkipBuild) {
  Write-Host "[1/4] npm run build:app ..." -ForegroundColor Cyan
  npm run build:app
  if ($LASTEXITCODE -ne 0) { throw "build:app failed" }
}

$wwwSrc = Join-Path $AppRoot "dist\build\app"
if (-not (Test-Path (Join-Path $wwwSrc "manifest.json"))) {
  throw "missing dist/build/app/manifest.json"
}
$mf = Get-Content (Join-Path $wwwSrc "manifest.json") -Raw | ConvertFrom-Json
$verName = $mf.version.name
$verCode = $mf.version.code
Write-Host "version = $verName ($verCode)" -ForegroundColor Green

# --- 3. copy resources into offline SDK assets ---
# Path: simpleDemo/src/main/assets/apps/__UNI__1BB4DA3/www/
$appId = "__UNI__1BB4DA3"
$wwwDst = Join-Path $demo "src\main\assets\apps\$appId\www"
Write-Host "[2/4] copy www -> $wwwDst" -ForegroundColor Cyan
if (Test-Path $wwwDst) { Remove-Item $wwwDst -Recurse -Force }
New-Item -ItemType Directory -Force -Path $wwwDst | Out-Null
Copy-Item -Path (Join-Path $wwwSrc "*") -Destination $wwwDst -Recurse -Force

# --- 4. patch dcloud_control.xml appid if present ---
$ctrl = Get-ChildItem $demo -Recurse -Filter "dcloud_control.xml" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($ctrl) {
  Write-Host "[2b] patch $($ctrl.FullName) appid=$appId" -ForegroundColor Cyan
  $xml = Get-Content $ctrl.FullName -Raw -Encoding UTF8
  $xml2 = $xml -replace 'appid="[^"]*"', "appid=`"$appId`""
  [System.IO.File]::WriteAllText($ctrl.FullName, $xml2, [System.Text.UTF8Encoding]::new($false))
}

# --- 4b. 确保 zip4j：离线包缺它会在 OTA install 时闪退（下载到 100% 后崩）---
$gradleFile = Join-Path $demo "build.gradle"
if (Test-Path $gradleFile) {
  $g = Get-Content $gradleFile -Raw -Encoding UTF8
  if ($g -notmatch "zip4j") {
    Write-Host "[2c] inject zip4j into simpleDemo/build.gradle (OTA install 必需)" -ForegroundColor Yellow
    if ($g -match "(implementation\s+'androidx\.webkit:webkit:[^']+'\s*)") {
      $g2 = $g -replace "(implementation\s+'androidx\.webkit:webkit:[^']+'\s*)", "`$1`r`n    implementation 'net.lingala.zip4j:zip4j:2.11.5'`r`n"
      [System.IO.File]::WriteAllText($gradleFile, $g2, [System.Text.UTF8Encoding]::new($false))
    } else {
      Write-Host "[WARN] could not auto-inject zip4j; add manually: implementation 'net.lingala.zip4j:zip4j:2.11.5'" -ForegroundColor Red
    }
  } else {
    Write-Host "[2c] zip4j already present" -ForegroundColor Green
  }
  # sync native versionCode/Name with uni manifest
  $g = Get-Content $gradleFile -Raw -Encoding UTF8
  $g = [regex]::Replace($g, 'versionCode\s+\d+', "versionCode $verCode")
  $g = [regex]::Replace($g, 'versionName\s+"[^"]+"', "versionName `"$verName`"")
  [System.IO.File]::WriteAllText($gradleFile, $g, [System.Text.UTF8Encoding]::new($false))
  Write-Host "[2d] gradle version -> $verName ($verCode)" -ForegroundColor Cyan
}

# --- 4c. 从 SDK/libs 补齐 install-apk 等（simpleDemo 模板常漏拷）---
$sdkLibs = Join-Path (Split-Path $SdkRoot) "SDK\libs"
if (-not (Test-Path $sdkLibs)) {
  $sdkLibs = Join-Path $SdkRoot "..\SDK\libs"
}
$demoLibs = Join-Path $demo "libs"
$needAars = @("install-apk-release.aar", "breakpad-build-release.aar")
# 注意：不要拷 uni-installApk-release.aar（Kotlin metadata 2.2 与当前 AGP 不兼容，会报警）
if (Test-Path $sdkLibs) {
  foreach ($a in $needAars) {
    $src = Join-Path $sdkLibs $a
    $dst = Join-Path $demoLibs $a
    if ((Test-Path $src) -and -not (Test-Path $dst)) {
      Copy-Item -Force $src $dst
      Write-Host "[2e] copied $a from SDK/libs" -ForegroundColor Yellow
    } elseif (Test-Path $dst) {
      Write-Host "[2e] libs/$a ok" -ForegroundColor Green
    } else {
      Write-Host "[WARN] missing $a (not in SDK/libs either)" -ForegroundColor Red
    }
  }
  $bad = Join-Path $demoLibs "uni-installApk-release.aar"
  if (Test-Path $bad) {
    Remove-Item -Force $bad
    Write-Host "[2e] removed uni-installApk-release.aar (Kotlin 不兼容)" -ForegroundColor Yellow
  }
} else {
  Write-Host "[WARN] SDK/libs not found near $SdkRoot" -ForegroundColor Yellow
}

# --- 4d. 出包前审计（zip4j / aar / 远程 wgt）---
Write-Host "[2f] audit_offline_pack.mjs ..." -ForegroundColor Cyan
node (Join-Path $AppRoot "scripts\audit_offline_pack.mjs") --sdk $SdkRoot
if ($LASTEXITCODE -ne 0) { throw "offline pack audit failed — refuse to ship broken OTA base" }

# --- 5. copy icons ---
$iconSrc = Join-Path $AppRoot "static\app-icons"
$resIcons = Join-Path $AppRoot "unpackage\res\icons"
New-Item -ItemType Directory -Force -Path $resIcons | Out-Null
Copy-Item "$iconSrc\*" $resIcons -Force -ErrorAction SilentlyContinue

# --- 6. gradle assembleRelease ---
Write-Host "[3/4] gradle assembleRelease ..." -ForegroundColor Cyan
if (-not (Test-Path $Keystore)) { throw "keystore missing: $Keystore" }

$gradlew = Join-Path $SdkRoot "gradlew.bat"
if (-not (Test-Path $gradlew)) {
  # some SDK layouts put gradle in parent
  $gradlew = Join-Path (Split-Path $SdkRoot) "gradlew.bat"
}
if (-not (Test-Path $gradlew)) {
  Write-Host "[WARN] gradlew.bat not found. Open Android Studio -> Open $SdkRoot -> Build > Generate Signed Bundle/APK" -ForegroundColor Yellow
  Write-Host "Keystore: $Keystore  alias=$KeyAlias  pass=$StorePass" -ForegroundColor Yellow
  exit 3
}

Push-Location $SdkRoot
try {
  & $gradlew ":simpleDemo:assembleRelease" `
    "-Pandroid.injected.signing.store.file=$Keystore" `
    "-Pandroid.injected.signing.store.password=$StorePass" `
    "-Pandroid.injected.signing.key.alias=$KeyAlias" `
    "-Pandroid.injected.signing.key.password=$KeyPass"
  if ($LASTEXITCODE -ne 0) { throw "gradle assembleRelease failed" }
} finally {
  Pop-Location
}

# --- 7. collect APK ---
Write-Host "[4/4] collect APK ..." -ForegroundColor Cyan
$apkSrc = Get-ChildItem -Path $SdkRoot -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match "release" -and $_.Length -gt 1MB } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $apkSrc) { throw "no release APK found under $SdkRoot" }

$outDir = Join-Path $AppRoot "unpackage\release\apk"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outName = "RealtyApp-$verName-$verCode.apk"
$outPath = Join-Path $outDir $outName
Copy-Item $apkSrc.FullName $outPath -Force
Write-Host ""
Write-Host "[DONE] APK = $outPath" -ForegroundColor Green
Write-Host ("size = {0:N1} MB" -f ($apkSrc.Length / 1MB))
Write-Host "Install on phone, then OTA will work for later versions." -ForegroundColor Cyan
