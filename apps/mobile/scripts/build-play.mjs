// Local Google Play release. The upload key is persistent and excluded from Git.
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, copyFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
process.env.EXPO_PUBLIC_API_URL = 'https://www.arviva.space';
process.env.NODE_ENV = 'production';
process.env.JAVA_HOME ||= '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';
process.env.ANDROID_HOME ||= '/opt/homebrew/share/android-commandlinetools';
process.env.PATH = `${process.env.JAVA_HOME}/bin:${process.env.PATH}`;
for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  if (!process.env[key]) throw Error(`${key} must be configured`);
}
function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, {cwd, env: process.env, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const signingDir = path.join(root, 'builds/play-signing');
mkdirSync(signingDir, {recursive: true, mode: 0o700});
chmodSync(signingDir, 0o700);
const passwordFile = path.join(signingDir, 'password');
const storeFile = path.join(signingDir, 'arviva-upload.jks');
if (!existsSync(passwordFile)) {
  if (existsSync(storeFile)) throw Error('Existing upload key has no password file; restore credentials before building');
  writeFileSync(passwordFile, randomBytes(32).toString('base64url'), {mode: 0o600});
}
process.env.ARVIVA_UPLOAD_PASSWORD = readFileSync(passwordFile, 'utf8').trim();
process.env.ARVIVA_UPLOAD_STORE_FILE = storeFile;
if (!existsSync(storeFile)) {
  run('keytool', ['-genkeypair', '-storetype', 'JKS', '-keystore', storeFile,
    '-storepass:env', 'ARVIVA_UPLOAD_PASSWORD', '-keypass:env', 'ARVIVA_UPLOAD_PASSWORD',
    '-alias', 'arviva-upload', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
    '-dname', 'CN=Arviva Space Upload, O=Cedari AI Inc., C=US']);
  chmodSync(storeFile, 0o600);
}
if (!existsSync('android')) run('node_modules/.bin/expo', ['prebuild', '--platform', 'android', '--no-install']);
run('./gradlew', ['app:bundleRelease', 'app:assembleRelease', '--no-daemon', '--max-workers=2',
  '--init-script', path.join(root, 'scripts/play-signing.gradle'),
  '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64'], path.join(root, 'android'));
copyFileSync('android/app/build/outputs/bundle/release/app-release.aab', 'builds/ArvivaSpace-play.aab');
copyFileSync('android/app/build/outputs/apk/release/app-release.apk', 'builds/ArvivaSpace-play.apk');
console.log('Signed Play AAB and standalone APK saved in builds/. Back up builds/play-signing securely.');
