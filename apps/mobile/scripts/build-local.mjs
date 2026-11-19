// Local release binaries; no EAS account, upload, or Expo build service.
import { expoCli, iosProject, simulatorArchitecture } from "./native-project.mjs";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
process.env.EXPO_PUBLIC_API_URL =
  process.env.ARVIVA_BUILD_API_URL || process.env.EXPO_PUBLIC_API_URL || "";
if (!process.env.EXPO_PUBLIC_API_URL.startsWith("https://"))
  throw Error("Standalone binaries require an HTTPS backend");
for (const key of [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
])
  if (!process.env[key]) throw Error(`${key} must be configured`);
process.env.NODE_ENV = "production";

if (
  !process.env.JAVA_HOME &&
  existsSync("/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home")
)
  process.env.JAVA_HOME =
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home";
process.env.ANDROID_HOME ||= existsSync(
  "/opt/homebrew/share/android-commandlinetools",
)
  ? "/opt/homebrew/share/android-commandlinetools"
  : path.join(process.env.HOME, "Library/Android/sdk");
if (process.env.JAVA_HOME)
  process.env.PATH =
    path.join(process.env.JAVA_HOME, "bin") + ":" + process.env.PATH;
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const platform = process.argv[2];
mkdirSync("builds", { recursive: true });
if (platform === "ios") {
  if (!existsSync("ios"))
    run(process.execPath, [
      expoCli(),
      "prebuild",
      "--platform",
      "ios",
      "--no-install",
    ]);
  run(process.env.POD_BINARY || "pod", ["install", "--project-directory=ios"]);
  const native = iosProject(root, readdirSync("ios"), {
    workspace: process.env.IOS_WORKSPACE,
    scheme: process.env.IOS_SCHEME,
  });
  run("xcodebuild", [
    "-workspace",
    native.workspace,
    "-scheme",
    native.scheme,
    "-configuration",
    "Release",
    "-sdk",
    "iphonesimulator",
    "-destination",
    "generic/platform=iOS Simulator",
    "-derivedDataPath",
    "builds/ios-derived",
    "CODE_SIGNING_ALLOWED=NO",
    "ARCHS=" + (process.env.IOS_ARCH || simulatorArchitecture(process.arch)),
  ]);
  const app = path.join(
    "builds/ios-derived/Build/Products/Release-iphonesimulator",
    native.appName,
  );
  if (!existsSync(path.join(app, "main.jsbundle")))
    throw Error("Release app is missing its embedded JavaScript bundle");
  cpSync(app, "builds/Agent.app", { recursive: true });
  run("ditto", [
    "-c",
    "-k",
    "--sequesterRsrc",
    "--keepParent",
    "builds/Agent.app",
    "builds/Agent-ios-simulator.zip",
  ]);
  console.log(
    "Built builds/Agent-ios-simulator.zip for the local iOS simulator.",
  );
} else if (platform === "android") {
  if (!existsSync("android"))
    run(process.execPath, [
      expoCli(),
      "prebuild",
      "--platform",
      "android",
      "--no-install",
    ]);
  run(
    "./gradlew",
    [
      "app:assembleRelease",
      "--no-daemon",
      "--max-workers=2",
      "-PreactNativeArchitectures=arm64-v8a",
    ],
    path.join(root, "android"),
  );
  cpSync(
    "android/app/build/outputs/apk/release/app-release.apk",
    "builds/Agent-android-preview.apk",
  );
  console.log(
    "Built builds/Agent-android-preview.apk (ARM64 standalone preview; development signing, not a Play release).",
  );
} else throw Error("Specify ios or android");
