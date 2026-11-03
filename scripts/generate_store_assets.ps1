Add-Type -AssemblyName System.Drawing

$srcIcon = 'C:\Users\Eggwi\.gemini\antigravity-ide\brain\cc802198-b661-4998-a962-a2ee6ef8c997\play_store_icon_1793636630846.jpg'
$srcBanner = 'C:\Users\Eggwi\.gemini\antigravity-ide\brain\cc802198-b661-4998-a962-a2ee6ef8c997\play_store_banner_1793636651006.jpg'
$outDir = 'C:\Users\Eggwi\.gemini\antigravity-ide\scratch\game-reels\store_assets'

if (!(Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

function Resize-And-Save {
    param(
        [string]$SourcePath,
        [string]$DestinationPath,
        [int]$TargetWidth,
        [int]$TargetHeight
    )
    $srcImg = [System.Drawing.Image]::FromFile($SourcePath)
    $dstBmp = New-Object System.Drawing.Bitmap($TargetWidth, $TargetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dstBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $g.DrawImage($srcImg, 0, 0, $TargetWidth, $TargetHeight)
    $g.Dispose()
    $srcImg.Dispose()

    $dstBmp.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dstBmp.Dispose()
}

# 1. Play Store Official Assets
$playIconPath = Join-Path $outDir 'icon_512x512.png'
$playBannerPath = Join-Path $outDir 'feature_graphic_1024x500.png'

Resize-And-Save -SourcePath $srcIcon -DestinationPath $playIconPath -TargetWidth 512 -TargetHeight 512
Resize-And-Save -SourcePath $srcBanner -DestinationPath $playBannerPath -TargetWidth 1024 -TargetHeight 500

# 2. Web PWA Icons
$publicDir = 'C:\Users\Eggwi\.gemini\antigravity-ide\scratch\game-reels\public'
Resize-And-Save -SourcePath $srcIcon -DestinationPath (Join-Path $publicDir 'icon-512.png') -TargetWidth 512 -TargetHeight 512
Resize-And-Save -SourcePath $srcIcon -DestinationPath (Join-Path $publicDir 'icon-192.png') -TargetWidth 192 -TargetHeight 192

# 3. Android Native Mipmap Density Icons
$resDir = 'C:\Users\Eggwi\.gemini\antigravity-ide\scratch\game-reels\android\app\src\main\res'
$densities = @(
    @{ Name = 'mipmap-mdpi'; Size = 48 },
    @{ Name = 'mipmap-hdpi'; Size = 72 },
    @{ Name = 'mipmap-xhdpi'; Size = 96 },
    @{ Name = 'mipmap-xxhdpi'; Size = 144 },
    @{ Name = 'mipmap-xxxhdpi'; Size = 192 }
)

foreach ($d in $densities) {
    $folder = Join-Path $resDir $d.Name
    if (Test-Path $folder) {
        $launcherPath = Join-Path $folder 'ic_launcher.png'
        $launcherRoundPath = Join-Path $folder 'ic_launcher_round.png'
        Resize-And-Save -SourcePath $srcIcon -DestinationPath $launcherPath -TargetWidth $d.Size -TargetHeight $d.Size
        Resize-And-Save -SourcePath $srcIcon -DestinationPath $launcherRoundPath -TargetWidth $d.Size -TargetHeight $d.Size
    }
}

Write-Output "Successfully generated and distributed all Play Store, Web, and Android mipmap icons!"
Get-Item (Join-Path $outDir '*') | Select-Object Name, Length
