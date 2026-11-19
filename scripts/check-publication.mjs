import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const excluded = new Set([
  "node_modules",
  ".git",
  ".next",
  ".expo",
  "dist",
  "builds",
  "output",
  ".superpowers",
  ".temp",
  ".branches",
  "ios",
  "android",
]);
const findings = [];
async function scan(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (excluded.has(item.name)) continue;
    const file = path.join(dir, item.name),
      relative = path.relative(root, file);
    if (item.isDirectory()) {
      await scan(file);
      continue;
    }
    if (
      (/^\.env/.test(item.name) && item.name !== ".env.example") ||
      /\.(jks|p8|p12|key|mobileprovision)$/.test(item.name)
    ) {
      findings.push(relative + ": private artifact");
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|cjs|json|html|sql|toml|md)$/.test(item.name))
      continue;
    const content = await readFile(file, "utf8");
    if (
      /\bsk-[A-Za-z0-9_-]{30,}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(
        content,
      )
    )
      findings.push(relative + ": possible credential");
    if (
      /^apps\/(mobile|backend)\/src\//.test(relative) &&
      /https:\/\/(www\.)?arviva\.space/.test(content)
    )
      findings.push(relative + ": original production endpoint");
  }
}
await scan(root);
if (
  !process.argv.includes("--source-only") &&
  process.env.ASSET_RIGHTS_CONFIRMED !== "true"
)
  findings.push("ASSETS.md: redistribution confirmation is pending");
if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Source publication scan passed" +
      (process.argv.includes("--source-only")
        ? "; asset approval remains a separate release gate."
        : "."),
  );
