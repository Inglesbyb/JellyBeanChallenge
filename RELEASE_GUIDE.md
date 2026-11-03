# 🚀 Jelly Bean: 60s Challenge — Google Play Release & Deployment Guide

This guide provides end-to-end instructions for building, signing, and publishing **Jelly Bean: 60s Challenge** (`com.jellybean.challenge`) to the Google Play Store.

---

## 📦 1. Artifacts & Release Specifications

| Parameter | Value | Compliance Note |
| :--- | :--- | :--- |
| **Package Name (App ID)** | `com.jellybean.challenge` | Configured in `capacitor.config.json` & `build.gradle` |
| **App Title** | `Jelly Bean: 60s Challenge` | 27 characters (Google Play 30-char limit compliant) |
| **Version Code** | `1` | Incremented with each production update |
| **Version Name** | `1.0.0` | Semantic version string |
| **Minimum SDK** | `API 24` (Android 7.0 Nougat) | Covers >95% of active Android devices |
| **Target SDK** | `API 36` (Android 16) | Exceeds Google Play requirement (API 34/35) |
| **Architecture** | 64-bit & 32-bit (`arm64-v8a`, `armeabi-v7a`, `x86_64`, `x86`) | 100% compliant with Google Play 64-bit requirement |
| **Binary Format** | Android App Bundle (`.aab`) | Mandatory for all new Google Play app submissions |

---

## 🔑 2. Release Keystore & Signing Configuration

A production-grade, 2048-bit RSA PKCS12 release keystore has been generated:

* **Keystore Location**: `android/release.keystore`
* **Properties File**: `android/keystore.properties`
* **Keystore Format**: `PKCS12` (standard Android keystore format)
* **Key Alias**: `jellybean`
* **Validity**: `10,000 days` (~27.4 years, exceeding Google Play's 25-year requirement)
* **Default Store & Key Password**: `JellyBeanRelease2026!`

> [!CAUTION]
> **Keep your release keystore safe!**
> Do not lose `android/release.keystore`. If lost, you cannot update your app on Google Play without resetting your upload key with Google Support. Both `release.keystore` and `keystore.properties` are listed in `.gitignore` to prevent leaking credentials to public repositories.

### Regenerating Keystores
To generate a new or customized keystore at any time:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate_release_keystore.ps1 -StorePass "YourNewPassword" -KeyPass "YourNewPassword"
```

---

## 🏗️ 3. How to Build the Signed `.aab` / `.apk`

Choose either of the three turnkey build methods below:

### Method A: Automated GitHub Actions CI (Recommended & Zero Setup)
A production-ready GitHub Actions workflow is pre-configured at [`.github/workflows/build-release.yml`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/.github/workflows/build-release.yml).

1. Push your code to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: complete Google Play release packaging"
   git push origin main
   ```
2. Navigate to your repository on GitHub and click the **Actions** tab.
3. The **"Build Signed Android Release (.aab & .apk)"** workflow runs automatically on Ubuntu with pre-installed Java 17 and Android SDK.
4. Once completed (approx. 2 minutes), scroll to **Artifacts** to download:
   * 📦 `JellyBean-PlayStore-Release-AAB` (Upload directly to Google Play Console!)
   * 📱 `JellyBean-DirectInstall-Release-APK` (For testing on real Android phones via USB/sideload)

---

### Method B: 1-Click Build via Android Studio
If you have [Android Studio](https://developer.android.com/studio) installed on Windows:

1. Launch Android Studio.
2. Select **Open** and select the folder:
   `C:\Users\Eggwi\.gemini\antigravity-ide\scratch\game-reels\android`
3. Wait for Gradle sync to complete.
4. In the top menu bar, click **Build** -> **Generate Signed Bundle / APK...**.
5. Select **Android App Bundle** and click **Next**.
6. Fill in the signing parameters:
   * **Key store path**: Browse to `android/release.keystore`
   * **Key store password**: `JellyBeanRelease2026!`
   * **Key alias**: `jellybean`
   * **Key password**: `JellyBeanRelease2026!`
7. Select **release** destination and check `V1 (Jar Signature)` / `V2 (Full APK Signature)`.
8. Click **Finish**. Your `.aab` will be generated in `android/app/release/app-release.aab`.

---

### Method C: Local Command Line Build
If you have JDK 17 installed locally:
```powershell
# Run the automated build script
powershell -ExecutionPolicy Bypass -File .\scripts\build_release_bundle.ps1
```
Or directly using Gradle:
```powershell
cd android
.\gradlew.bat bundleRelease
```
The output will be placed in:
`android/app/build/outputs/bundle/release/app-release.aab`

---

## 🎨 4. Store Assets & Marketing Deliverables

All Google Play Store graphic assets are pre-generated and located in the project:

| Asset | File Path | Resolution | Format | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **App Icon** | [`store_assets/icon_512x512.png`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/store_assets/icon_512x512.png) | $512 \times 512$ px | 32-bit PNG | Main Store Listing Icon |
| **Feature Graphic** | [`store_assets/feature_graphic_1024x500.png`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/store_assets/feature_graphic_1024x500.png) | $1024 \times 500$ px | 24-bit PNG | Header banner on Google Play |
| **Screenshot 1** | [`store_assets/screenshots/shot1_daily_seed.png`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/store_assets/screenshots/shot1_daily_seed.png) | $1080 \times 1920$ px | PNG | Daily Gauntlet mode & streak card |
| **Screenshot 2** | [`store_assets/screenshots/shot2_gameplay.png`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/store_assets/screenshots/shot2_gameplay.png) | $1080 \times 1920$ px | PNG | In-game micro-arcade action |
| **Screenshot 3** | [`store_assets/screenshots/shot3_closet.png`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/store_assets/screenshots/shot3_closet.png) | $1080 \times 1920$ px | PNG | Mascot Closet skins & hats |
| **Screenshot 4** | [`store_assets/screenshots/shot4_profile.png`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/store_assets/screenshots/shot4_profile.png) | $1080 \times 1920$ px | PNG | Commander Dossier & lifetime stats |
| **Screenshot 5** | [`store_assets/screenshots/shot5_share_card.png`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/store_assets/screenshots/shot5_share_card.png) | $1080 \times 1920$ px | PNG | Cybernetic viral score poster |

---

## 📋 5. Google Play Console Submission Checklist

Follow these exact steps when creating your release in the [Google Play Console](https://play.google.com/console):

### Step 1: Create Application
1. Click **Create app**.
2. **App name**: `Jelly Bean: 60s Challenge`
3. **Default language**: `English (United States)`
4. **App or game**: `Game`
5. **Free or paid**: `Free`
6. Accept Developer Program Policies and US Export Laws, then click **Create app**.

### Step 2: Store Listing (Main store listing)
1. **Short description** (Up to 80 chars):
   > *Survive 20 rapid-fire micro-arcade challenges in a 60-second cyber gauntlet!*
2. **Full description** (Up to 4,000 chars):
   > *Step into the cybernetic arcade with Captain Bean! Jelly Bean: 60s Challenge is a lightning-fast gauntlet testing your reflexes, precision, and focus across 20 escalating micro-arcade games in a non-stop 60-second run.*
   >
   > *⭐ FEATURES:*
   > * *20 Rapid-Fire Mini-Games: Dodge laser grids, bounce meteors, deflect spikes, slice cyber fruits, and outmaneuver the void!*
   > * *Global Daily Seeded Gauntlet: Every player in the world gets the exact same 10-game sequence every 24 hours. Compete for Bronze, Silver, and Gold medals to maintain your daily streak!*
   > * *Captain's Mascot Closet: Customize Captain Bean with 8 neon palettes and 8 unlockable hats.*
   > * *Commander Dossier: Level up from Sprout Bean to Apex Legend with comprehensive lifetime stats tracking.*
   > * *Tactical Haptic Feedback: Feel every bounce, slice, and close shave with immersive Android haptics.*
   > * *100% Offline & Private: No accounts, no sign-ins, and zero data tracking. Just pure arcade thrill.*
3. **Graphics**:
   * Upload `store_assets/icon_512x512.png` to **App icon**.
   * Upload `store_assets/feature_graphic_1024x500.png` to **Feature graphic**.
   * Upload all 5 screenshots from `store_assets/screenshots/` to **Phone screenshots**.

### Step 3: Privacy Policy & App Content
1. Navigate to **Policy and programs** -> **App content**.
2. **Privacy policy**: Enter your hosted URL (e.g. `https://your-username.github.io/game-reels/privacy.html` or the raw link to `PRIVACY_POLICY.md`).
3. **Data Safety**: Open [`DATA_SAFETY_GUIDE.md`](file:///C:/Users/Eggwi/.gemini/antigravity-ide/scratch/game-reels/DATA_SAFETY_GUIDE.md) and check "No, the app does not collect or share user data".
4. **Target audience and content**: Select **All ages** (including children, fully compliant with COPPA).
5. **Ads**: Select **No, my app does not contain ads**.

### Step 4: Create Release & Upload .AAB
1. In the sidebar, navigate to **Production** (or **Closed testing** for initial beta rollout).
2. Click **Create new release**.
3. Under **App bundles**, upload `app-release.aab`.
4. Set **Release name**: `1.0.0 (Initial Production Release)`.
5. Enter **Release notes**:
   ```text
   Initial launch of Jelly Bean: 60s Challenge!
   - 20 rapid-fire micro-arcade games
   - Daily Seeded Gauntlet mode with daily streak tracker
   - Captain Bean Mascot Closet with unlockable skins and hats
   - Commander Dossier lifetime stats and ranking system
   - High-resolution shareable cybernetic score posters
   - Immersive native haptic feedback
   ```
6. Click **Next** -> **Review release** -> **Start rollout to Production**! 🚀
