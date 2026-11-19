# Local mobile builds

Install npm dependencies from the root. Build configuration comes from config/agent.ts, config/assets.ts and config/native-assets.ts. Use your deployed HTTPS backend in apps/mobile/.env.local. Only public configuration is embedded. API, Cedari and service-role secrets stay in the backend.

For iOS, install Xcode and CocoaPods. Select Xcode through xcode-select or DEVELOPER_DIR. Use npm run build:ios for the local simulator artifact. For a real device or App Store distribution, generate the native project with Expo prebuild and use your own signing team in Xcode. Archive in Release, choose your distribution method, and upload with Xcode or Transporter. The template contains no signing identities or provisioning profiles.

For Android, install JDK 17 and the Android SDK and export JAVA_HOME and ANDROID_HOME. Use npm run build:android:play for the local signed bundle/APK. Back up the generated upload key and password outside the repository. An existing upload key must be restored before subsequent store updates. The build script refuses an existing key without its password. Set the intended package name and version code before creating a Play listing.

Build numbers, bundle IDs and URL schemes are configurable. Generate separate native projects for separate brands. Run typecheck, lint, tests, backend build and web export before publishing a native update, then test the signed app on actual devices. Native builds for the new template have not yet been signed or distributed.
