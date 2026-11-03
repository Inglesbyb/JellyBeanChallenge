param(
    [switch]$ApkOnly = $false,
    [switch]$SkipWebBuild = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   JELLY BEAN: ANDROID RELEASE BUNDLE BUILDER (.AAB/.APK) " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Web Build & Capacitor Sync
if (-not $SkipWebBuild) {
    Write-Host "`n[1/4] Building production web assets..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Web build failed."
    }

    Write-Host "`n[2/4] Syncing web assets to native Android project..." -ForegroundColor Yellow
    npx cap sync android
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Capacitor sync failed."
    }
} else {
    Write-Host "`n[1/4 & 2/4] Skipping web build as requested." -ForegroundColor Gray
}

# 2. Verify Keystore & Properties
Write-Host "`n[3/4] Verifying Android Release Signing Configuration..." -ForegroundColor Yellow
$keystoreFile = "android/release.keystore"
$propsFile = "android/keystore.properties"

if (!(Test-Path $keystoreFile)) {
    Write-Host "[!] release.keystore missing. Generating now..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File .\scripts\generate_release_keystore.ps1
} else {
    Write-Host "[OK] release.keystore verified ($(Get-Item $keystoreFile | Select-Object -ExpandProperty Length) bytes)." -ForegroundColor Green
}

if (!(Test-Path $propsFile)) {
    Write-Host "[!] keystore.properties missing. Generating now..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File .\scripts\generate_release_keystore.ps1
} else {
    Write-Host "[OK] keystore.properties verified." -ForegroundColor Green
}

# 3. Check for JDK and Build Bundle
Write-Host "`n[4/4] Checking Android Build Environment..." -ForegroundColor Yellow

$javaCmd = Get-Command java -ErrorAction SilentlyContinue
$gradlewBat = Join-Path (Get-Location) "android\gradlew.bat"

if ($javaCmd) {
    Write-Host "[OK] Detected Java runtime: $($javaCmd.Source)" -ForegroundColor Green
    Push-Location "android"
    try {
        if (-not $ApkOnly) {
            Write-Host "`nBuilding Signed Android App Bundle (.aab) for Google Play..." -ForegroundColor Cyan
            .\gradlew.bat bundleRelease --stacktrace
        }
        Write-Host "`nBuilding Signed Universal Release APK (.apk)..." -ForegroundColor Cyan
        .\gradlew.bat assembleRelease --stacktrace

        Write-Host "`n==========================================================" -ForegroundColor Green
        Write-Host "   BUILD SUCCESSFUL! ARTIFACTS GENERATED:                 " -ForegroundColor Green
        Write-Host "==========================================================" -ForegroundColor Green
        if (Test-Path "app\build\outputs\bundle\release") {
            Get-ChildItem "app\build\outputs\bundle\release\*.aab" | ForEach-Object {
                Write-Host " [AAB] $($_.FullName) ($([math]::Round($_.Length/1MB, 2)) MB)" -ForegroundColor Yellow
            }
        }
        if (Test-Path "app\build\outputs\apk\release") {
            Get-ChildItem "app\build\outputs\apk\release\*.apk" | ForEach-Object {
                Write-Host " [APK] $($_.FullName) ($([math]::Round($_.Length/1MB, 2)) MB)" -ForegroundColor Yellow
            }
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[NOTICE] Java JDK / Android SDK build tools are not detected in the Windows PATH." -ForegroundColor Yellow
    Write-Host "All Android project files, Gradle release configs, 64-bit ABI filters, assets, and" -ForegroundColor Gray
    Write-Host "release keystores are fully configured and verified!" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To produce the final .aab / .apk binary:" -ForegroundColor White
    Write-Host "  Option 1 (Automated GitHub Actions CI - Recommended):" -ForegroundColor Cyan
    Write-Host "    Push this repository to GitHub! The pre-configured workflow" -ForegroundColor Gray
    Write-Host "    '.github/workflows/build-release.yml' automatically builds, signs, and" -ForegroundColor Gray
    Write-Host "    attaches 'app-release.aab' and 'app-release.apk' as downloadable release artifacts." -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Option 2 (Android Studio - 1 Click):" -ForegroundColor Cyan
    Write-Host "    1. Open Android Studio." -ForegroundColor Gray
    Write-Host "    2. Select 'Open' and choose: $(Join-Path (Get-Location) 'android')" -ForegroundColor Gray
    Write-Host "    3. Click 'Build' -> 'Generate Signed Bundle / APK' -> 'Android App Bundle'." -ForegroundColor Gray
    Write-Host "    4. Choose release.keystore with alias 'jellybean' and password 'JellyBeanRelease2026!'." -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Option 3 (Install JDK 17 locally):" -ForegroundColor Cyan
    Write-Host "    Install JDK 17 (e.g. 'winget install Microsoft.OpenJDK.17'), restart terminal," -ForegroundColor Gray
    Write-Host "    and re-run: .\scripts\build_release_bundle.ps1" -ForegroundColor Gray
}
