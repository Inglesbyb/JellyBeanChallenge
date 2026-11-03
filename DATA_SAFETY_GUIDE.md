# Google Play Console — Data Safety & Content Rating Guide

**Application:** Jelly Bean: 60s Challenge  
**Package:** `com.jellybean.challenge`  
**Privacy Policy URL:** `https://eggwi.github.io/game-reels/privacy.html` (or your custom domain/GitHub Pages URL)  

When publishing **Jelly Bean: 60s Challenge** in Google Play Console under **Policy > Data Safety** and **App Content**, use the exact answers below to pass automated and manual Google Play Store compliance reviews without rejection.

---

## 1. Data Safety Questionnaire

### Section 1: Data Collection and Security
| Question | Answer | Notes |
| :--- | :--- | :--- |
| **Does your app collect or share any of the required user data types?** | **No** | The app stores high scores, skins, and guest callsigns exclusively on the local device via sandboxed local storage (`localStorage`). No data is sent to remote servers. |
| **Is all of the user data collected by your app encrypted in transit?** | **Not applicable** (disabled because "No" was selected above) | If asked, select "Yes" or "Not applicable" since no network transmission of user data occurs. |
| **Do you provide a way for users to request that their data is deleted?** | **Yes** | Users can delete all locally saved data at any time by clearing app data in Android Settings or using the in-game reset. |

### Section 2: Data Types Breakdown
- **Location:** None
- **Personal info:** None (No name, email, address, phone number, user IDs)
- **Financial info:** None
- **Health and fitness:** None
- **Messages:** None
- **Photos and videos:** None
- **Audio files:** None
- **Files and docs:** None
- **Calendar:** None
- **Contacts:** None
- **App activity:** None (No analytics tracking SDKs)
- **Web browsing:** None
- **App info and performance:** None
- **Device or other IDs:** None (Advertising ID / GAID is NOT collected)

---

## 2. Advertising & Monetization Declaration

| Question | Answer | Explanation |
| :--- | :--- | :--- |
| **Does your app contain advertisements?** | **No** | There are no AdMob, Unity Ads, or third-party ad networks embedded in the application. |

---

## 3. App Access / Login Credentials

| Question | Answer |
| :--- | :--- |
| **Are all functions in your app available without special access restrictions?** | **Yes, all functionality is available without restrictions** |
| Notes for review team | *No login, password, or subscription is required. All 20 mini-games and daily challenges are unlocked and immediately playable.* |

---

## 4. Target Audience and Content (COPPA)

| Question | Recommended Answer | Rationale |
| :--- | :--- | :--- |
| **Target Age Groups** | **13–15, 16–17, 18 and over** (or include **Under 13** if participating in the Designed for Families program) | Targeting general audiences (13+) allows the fastest store approval path. The game collects zero personal data, making it compliant with children's privacy regardless. |
| **Could your store listing unintentionally appeal to children under 13?** | **Yes** (if colorful cartoon mascots are highlighted) | Google will ensure your listing adheres to family policies. |

---

## 5. Government, Health, & Financial Features

- **Government Apps:** No
- **Financial Services / Crypto:** No
- **Health / Medical / COVID-19:** No
- **News App:** No

---

## 6. Privacy Policy Link for Store Listing

Enter your hosted Privacy Policy URL in the Google Play Console under:
**Policy > Privacy Policy > Privacy Policy URL**
- Example: `https://raw.githubusercontent.com/Eggwi/game-reels/main/public/privacy.html` or your hosted GitHub Pages / web URL.
- The policy is also bundled offline inside the app at `/privacy.html` and available directly in the Settings modal.
