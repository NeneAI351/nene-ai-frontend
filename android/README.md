# NENE AI Android package

This is a Trusted Web Activity using Android Browser Helper. It reuses the
existing app and browser media engine rather than introducing a second editor
or a JavaScript/native bridge. Build success is not real-device verification.

## Build

JDK 17, Gradle 8.13, Android SDK 36 and build tools 35.0.0 are required.
From this directory run:

```sh
gradle --no-daemon :app:lintDebug :app:assembleDebug :app:bundleRelease
```

The Android internal build GitHub workflow installs these tools and uploads
an installable debug APK (`com.neneai.app.internal`), an **unsigned** release
bundle (`com.neneai.app`) and the lint report. No Play publishing credentials
or owner upload key are used. Debug is a separate app and cannot update a
release installation. Confirm the release package ID before Play registration.

The launch URL is the current public GitHub Pages app. **A draft frontend PR is
not automatically visible in this Android package.** Merge/deploy a reviewed
frontend to the launch URL, or use a separately reviewed test host, before
testing new web features. This wrapper does not bundle the web app's source.

## Fullscreen origin verification

The browser must verify a Digital Asset Links statement for this Android app
and its signing certificate. The required destination is:

`https://neneai351.github.io/.well-known/assetlinks.json`

It is at the origin root, **not** inside `/nene-ai-frontend/`. Adding a file to
this project site's `.well-known` folder does not meet that requirement.
Use the owner's root Pages site or a domain the owner controls. Do not create
another host or buy a domain just to hide a verification failure.

Use the installed APK's SHA-256 signing certificate for internal verification;
the Play release needs the **Play app signing** certificate, which differs from
the upload key. The app must fall back to visible browser controls until the
association is verified. Do not bypass verification with Chrome flags.

## Gates before Play submission

- Permanent owner-controlled upload signing key and Play App Signing setup.
  No signing private key, passwords or service account JSON in Git or chat.
- Verified origin association and final app/website URLs.
- Google Play Billing product setup, purchase-token backend validation,
  acknowledgement/consumption, replay protection and refund/revocation handling.
  This package does not yet implement billing. Keep credit sales closed.
- Real phone: sign-in/verification/reset, session persistence, file pickers,
  text/image/video/voice generation, previews, audio mix/sync, text placement,
  export, downloads, refresh, low storage, backgrounding and offline errors.
- Live backend/worker/private-storage checks, credit settlement, duplicate
  requests, account isolation, account deletion and content report moderation.
- Final SDK/permissions/privacy inventory, Data Safety, rating, listing assets,
  reviewer app access and applicable Play testing requirements.

Only INTERNET is requested by this project. Inspect the final merged manifest
and browser-helper dependency for the complete permission/component inventory.
The browser handles the website and has its own data/permission behavior;
absence of native analytics is not a claim of no data processing.

Official references checked on 30 October 2026:
- https://developer.android.com/google/play/requirements/target-sdk
- https://developer.android.com/build/releases/agp-8-11-0-release-notes
- https://github.com/GoogleChrome/android-browser-helper
- https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities
