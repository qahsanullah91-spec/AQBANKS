# AQ Companies — Native Mobile Applications (Android & iOS)

This document details the architecture, build pipelines, and security invariants for the **AQ Companies Logistics & Banking Native Mobile Applications** for both Android (APK/AAB) and iPhone/iOS (IPA/Xcode).

---

## 1. Architectural Overview

Both the Android and iOS native mobile clients connect to the **same centralized backend API and database** powering the web and desktop clients:
- **Central API URL:** `http://localhost:4000/api` (or production hostname / cloud IP)
- **Android Emulator Loopback:** `http://10.0.2.2:4000/api`
- **Protocol:** RESTful HTTPS with JSON payloads and Bearer JWT token authentication.
- **Client Identification:** Mobile clients identify themselves with custom headers:
  - `X-Client-Platform: mobile-native`
  - `X-Client-Version: 1.0.0`
  - `X-Idempotency-Key: mob-<operation>-<timestamp>-<random>`

```
+-------------------------------------------------------------+
|                Central Backend & Database                   |
|  - SQLite (Dev/Local) / PostgreSQL (Production)             |
|  - Port 4000: Express REST API (/api)                       |
|  - Invariants: Decimal Math, Deterministic Ledger, RBAC     |
+-------------------------------------------------------------+
               ▲                                ▲
               │                                │
     (HTTP/REST & Idempotency)        (HTTP/REST & Idempotency)
               │                                │
+------------------------------+  +---------------------------+
|    Native Android Client     |  |     Native iOS Client     |
| - Package: com.aqcompanies   |  | - Bundle: com.aqcompanies |
| - Min SDK 24, Target SDK 34  |  | - iOS 16.0+               |
| - BiometricPrompt Hardware   |  | - LocalAuthentication     |
| - Release APK / AAB          |  | - Face ID / Touch ID      |
+------------------------------+  +---------------------------+
```

---

## 2. Platform Scaffolding & Native Code

### Android (`mobile/android/`)
- **Root Configuration:** `mobile/android/build.gradle`, `settings.gradle`, `gradle.properties`
- **App Module:** `mobile/android/app/build.gradle`
  - Application ID: `com.aqcompanies.system`
  - Version: `1.0.0` (Code: 1)
  - `minSdk`: 24 (Android 7.0+)
  - `targetSdk`: 34 (Android 14)
  - `compileSdk`: 34
  - ProGuard rules and release signing configurations
- **Manifest:** `mobile/android/app/src/main/AndroidManifest.xml`
  - Permissions: `INTERNET`, `ACCESS_NETWORK_STATE`, `USE_BIOMETRIC`, `USE_FINGERPRINT`
- **Native Activity:** `mobile/android/app/src/main/java/com/aqcompanies/system/MainActivity.kt`
  - Hardware biometric authentication integration (`androidx.biometric:biometric:1.1.0`)
  - Back-navigation dispatcher callback
- **Network Security:** `mobile/android/app/src/main/res/xml/network_security_config.xml`
  - Enforces strict HTTPS in production while allowing local development on `10.0.2.2` and `localhost`.

### iOS (`mobile/ios/`)
- **Dependency Spec:** `mobile/ios/Podfile`
  - Target: iOS 16.0
  - Framework: `LocalAuthentication` for Face ID / Touch ID evaluation
- **Bundle Configuration:** `mobile/ios/AQCompanies/Info.plist`
  - Bundle Identifier: `com.aqcompanies.system`
  - `NSFaceIDUsageDescription`: Required for audited bank routing reveals
  - `NSCameraUsageDescription`: For shipping document inspection
  - App Transport Security: Configured for local development & HTTPS
- **Entry Points:**
  - `AppDelegate.h`, `AppDelegate.mm`, `main.m`
  - `ViewController.h`, `ViewController.m`: Native UIViewController with `LocalAuthentication` and `WKWebView` sandbox.

---

## 3. Production Build Instructions

### Prerequisites
- Node.js >= 20.x
- Java JDK >= 17 (for Android Gradle builds)
- Android SDK Build Tools 34.0.0 (for Android APK generation)
- macOS with Xcode 15+ & CocoaPods (for iOS IPA packaging)

### Building Android Release APK
From the repository root or `mobile/` directory, run:
```bash
cd mobile
npm run build:android
```
**Output Artifact:**
- Path: `mobile/android/build/outputs/apk/release/AQCompanies-v1.0.0-release.apk`
- Manifest: `mobile/android/build/outputs/apk/release/build-metadata.json`
- Verified Checksum: SHA-256 generated and recorded on every build.

### Building iOS Release IPA
From the `mobile/` directory:
```bash
cd mobile
npm run build:ios
```
**Output Artifact:**
- Path: `mobile/ios/build/outputs/AQCompanies-v1.0.0-release.ipa`
- Manifest: `mobile/ios/build/outputs/build-metadata.json`
- Verified Checksum: SHA-256 recorded.

---

## 4. Mobile Security & Idempotency Invariants

1. **Anti-Duplicate Double-Tap Protection (`withIdempotencyGuard`):**
   - On mobile touch screens, rapid double-tapping on "Record Payment" or "Issue Invoice" can trigger duplicate API requests.
   - The mobile client generates a cryptographically unique `X-Idempotency-Key` and locks in-flight submissions.
   - If an identical operation is submitted within 30 seconds, the cached response is safely returned without re-executing against the database.
2. **Audited Bank Routing Number Masking:**
   - Bank account numbers are presented as `101502******0472` by default.
   - Tapping "Reveal Full Account Number" requires entering a mandatory business audit reason and initiates biometric verification.
   - Once revealed, an auto-hide timer conceals the number after 45 seconds to protect against screen snooping.
3. **Deterministic Financial Display:**
   - All amounts rendered across the mobile screens strictly match the core system's decimal running balance engine.

---

## 5. Automated Verification & Testing

Run the mobile test suite with:
```bash
cd mobile
npm test
```
The test suite verifies:
- Unique idempotency key generation
- In-flight duplicate tap prevention
- Idempotent cached replay
- Mobile HTTP headers and JWT bearer authorization injection
- Error status serialization and offline connectivity alerts
