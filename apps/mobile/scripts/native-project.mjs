import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
export function expoCli() {
  return path.join(
    path.dirname(require.resolve("expo/package.json")),
    "bin/cli",
  );
}
export function iosProject(root, entries, overrides = {}) {
  const candidates = entries.filter(
    (name) => name.endsWith(".xcworkspace") && name !== "Pods.xcworkspace",
  );
  const workspace = overrides.workspace || candidates[0];
  if (!workspace || (!overrides.workspace && candidates.length !== 1))
    throw Error(
      "Expected one generated iOS workspace; set IOS_WORKSPACE if needed",
    );
  const scheme = overrides.scheme || path.basename(workspace, ".xcworkspace");
  return {
    workspace: path.resolve(root, "ios", workspace),
    scheme,
    appName: scheme + ".app",
  };
}

export function simulatorArchitecture(nodeArchitecture) {
  if (nodeArchitecture === 'arm64') return 'arm64';
  if (nodeArchitecture === 'x64') return 'x86_64';
  throw Error('Set IOS_ARCH for your simulator architecture');
}
