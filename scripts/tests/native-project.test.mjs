import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expoCli,
  iosProject,
} from "../../apps/mobile/scripts/native-project.mjs";
test("workspace_expo_cli_resolves_from_hoisted_install", () =>
  assert.match(expoCli(), /expo[\\/]bin[\\/]cli$/));
test("renamed_ios_project_uses_its_generated_workspace_and_scheme", () => {
  assert.deepEqual(
    iosProject("/template", ["StudioEdit.xcworkspace", "Pods"]),
    {
      workspace: "/template/ios/StudioEdit.xcworkspace",
      scheme: "StudioEdit",
      appName: "StudioEdit.app",
    },
  );
  assert.throws(() => iosProject("/template", []), /workspace/);
});

test('simulator_architecture_uses_xcode_names_for_intel_and_apple_silicon',async()=>{
 const {simulatorArchitecture}=await import('../../apps/mobile/scripts/native-project.mjs');
 assert.equal(simulatorArchitecture('x64'),'x86_64');
 assert.equal(simulatorArchitecture('arm64'),'arm64');
});
