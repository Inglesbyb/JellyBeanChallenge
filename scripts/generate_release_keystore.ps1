param(
    [string]$KeystorePath = "android/release.keystore",
    [string]$Alias = "jellybean",
    [string]$StorePass = "JellyBeanRelease2026!",
    [string]$KeyPass = "JellyBeanRelease2026!"
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   JELLY BEAN: RELEASE KEYSTORE GENERATOR         " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$resolvedKeystorePath = [System.IO.Path]::GetFullPath($KeystorePath)
$keystoreDir = [System.IO.Path]::GetDirectoryName($resolvedKeystorePath)

if (!(Test-Path $keystoreDir)) {
    New-Item -ItemType Directory -Path $keystoreDir -Force | Out-Null
}

$keytool = Get-Command keytool -ErrorAction SilentlyContinue
$opensslCandidates = @(
    "C:\Program Files\Git\mingw64\bin\openssl.exe",
    "C:\Program Files\Git\usr\bin\openssl.exe"
)

$openssl = $null
foreach ($cand in $opensslCandidates) {
    if (Test-Path $cand) {
        $openssl = $cand
        break
    }
}

if ($keytool) {
    Write-Host "[*] Found JDK keytool: $($keytool.Source)" -ForegroundColor Green
    & $keytool.Source -genkeypair -v `
        -keystore $resolvedKeystorePath `
        -alias $Alias `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -storetype PKCS12 `
        -storepass $StorePass `
        -keypass $KeyPass `
        -dname "CN=Jelly Bean 60s Challenge, OU=Arcade, O=JellyBean, C=US"
} elseif ($openssl) {
    Write-Host "[*] keytool not on PATH. Using OpenSSL ($openssl) to generate standard PKCS12 Android Keystore..." -ForegroundColor Yellow
    $tempKey = Join-Path $keystoreDir "temp_release.key"
    $tempCrt = Join-Path $keystoreDir "temp_release.crt"

    try {
        & $openssl genrsa -out $tempKey 2048 2>$null
        & $openssl req -new -x509 -key $tempKey -out $tempCrt -days 10000 `
            -subj "/CN=Jelly Bean 60s Challenge/OU=Arcade/O=JellyBean/C=US" 2>$null
        & $openssl pkcs12 -export -in $tempCrt -inkey $tempKey -out $resolvedKeystorePath `
            -name $Alias -passout "pass:$StorePass" 2>$null
    } finally {
        if (Test-Path $tempKey) { Remove-Item $tempKey -Force }
        if (Test-Path $tempCrt) { Remove-Item $tempCrt -Force }
    }
} else {
    Write-Error "Neither keytool nor OpenSSL was found on this system to generate a keystore."
}

if (Test-Path $resolvedKeystorePath) {
    $fileInfo = Get-Item $resolvedKeystorePath
    Write-Host ""
    Write-Host "[OK] Release Keystore successfully created!" -ForegroundColor Green
    Write-Host "     Path: $($fileInfo.FullName)" -ForegroundColor Gray
    Write-Host "     Size: $($fileInfo.Length) bytes" -ForegroundColor Gray
    Write-Host "     Format: PKCS12 (standard Android keystore format)" -ForegroundColor Gray
    Write-Host "     Validity: 10,000 days (approx. 27 years)" -ForegroundColor Gray
    Write-Host "     Alias: $Alias" -ForegroundColor Gray

    # Create android/keystore.properties
    $propsPath = Join-Path $keystoreDir "keystore.properties"
    $propsLines = @(
        "# Android Release Signing Properties",
        "# WARNING: Do NOT commit this file or release.keystore to public source control!",
        "storeFile=release.keystore",
        "storePassword=$StorePass",
        "keyAlias=$Alias",
        "keyPassword=$KeyPass"
    )
    $propsLines | Set-Content -Path $propsPath -Encoding UTF8
    Write-Host "[OK] Created properties configuration at: $propsPath" -ForegroundColor Green

    # Create android/keystore.properties.example
    $examplePropsPath = Join-Path $keystoreDir "keystore.properties.example"
    $exampleLines = @(
        "# Android Release Signing Properties Template",
        "# Copy this file to 'keystore.properties' and fill in your actual keystore credentials:",
        "storeFile=release.keystore",
        "storePassword=YOUR_STORE_PASSWORD",
        "keyAlias=jellybean",
        "keyPassword=YOUR_KEY_PASSWORD"
    )
    $exampleLines | Set-Content -Path $examplePropsPath -Encoding UTF8
    Write-Host "[OK] Created example template at: $examplePropsPath" -ForegroundColor Green
} else {
    Write-Error "Keystore generation failed."
}
