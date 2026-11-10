# SelfPhoneNG mobile

The Android and iPhone app for [SelfPhoneNG](https://git.dou.bet/spng/selfphoneng), the
self-hosted business phone system. One Expo (React Native) codebase for both. What it does and
the order of work: the PBX repo's `docs/spec/13-mobile.md`.

Status: pairing with a PBX (MB3) and calls (MB4): a dial pad, calls in and out, hold, mute,
keypad and speaker, with the phone's own call screen. **Calls haven't been tried on a real phone
yet.** History, voicemail, contacts and settings come next. Calls ring only while the app is
open.

## Get the code

```bash
git clone --recurse-submodules https://git.dou.bet/spng/mobile.git
npm install
```

`vendor/selfphoneng` is the PBX repo as a git submodule, for the shared types
(`@selfphoneng/shared`). After the PBX changes its API, move it forward:
`git -C vendor/selfphoneng pull origin main && git add vendor/selfphoneng`.

## Develop

```bash
npm run typecheck
npm run lint
npx expo start          # needs a development build on the phone (the app has native modules)
```

## Pair a phone

On a computer, open the PBX's web page → My settings → **Mobile app** → **Pair a phone**. In the
app, tap **Scan the QR code** (or type the server and code). The code works once, for 10 minutes.

## Build and sideload

### Android (on Windows, Linux or macOS)

Needs JDK 17+ and the Android SDK (`ANDROID_HOME`). The first build downloads the NDK and SDK
platforms it's missing.

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

Add `-PreactNativeArchitectures=arm64-v8a` for a faster build that runs on any recent phone.

On Windows the C++ build fails with `ninja: error: mkdir(...): No such file or directory`: the
paths pass 260 characters, and the CMake 3.22 that Gradle installs has a `ninja` that can't use
long paths. Turn on Windows long paths (`LongPathsEnabled`), install a newer CMake
(`sdkmanager "cmake;3.31.6"`), and after each `expo prebuild` point the build at it in
`android/local.properties`:

```properties
sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
cmake.dir=C:/Users/<you>/AppData/Local/Android/Sdk/cmake/3.31.6
```

The APK is `android/app/build/outputs/apk/release/app-release.apk`, signed with the debug key:
copy it to the phone and open it (allow installing from unknown sources), or `adb install` it.

### iPhone (no Mac needed)

[ios-builder](https://github.com/MobAI-App/ios-builder) runs the Xcode build on a GitHub Actions
macOS runner, so it needs this repo mirrored to GitHub.

1. Download `builder-windows-amd64.exe` from its releases, rename it to `builder.exe`, put it on
   your PATH, then `builder auth github`.
2. In this repo: `builder init`. It adds `.github/workflows/ios-build.yml` and `builder.json`. Set
   `builder.json` to `{ "ios": { "path": "ios", "configuration": "Release" } }` (Debug loads the
   JavaScript from a dev server).
3. `builder ios build --unsigned`: the IPA lands in `./dist/`.
4. Install [MobAI](https://mobai.run/download), connect the iPhone by USB, `builder mobai ping`,
   then `builder mobai install dist/<file>.ipa`. It re-signs with a free Apple ID (use a spare one):
   the app works for 7 days, then install it again.

## License

AGPL-3.0-or-later, as the PBX.
