import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
test("private_config_cannot_enter_public_import_tree", () => {
  const seen = new Set<string>();
  function visit(url: URL) {
    const file = fileURLToPath(url);
    if (seen.has(file)) return;
    seen.add(file);
    assert.doesNotMatch(file, /apps\/backend|config\/server|src\/server\.ts/);
    const source = readFileSync(url, "utf8");
    const tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
    );
    function walk(node: ts.Node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        if (
          ("isTypeOnly" in node && node.isTypeOnly) ||
          ("importClause" in node && node.importClause?.isTypeOnly)
        )
          return;
        const module = node.moduleSpecifier.text;
        if (module.startsWith("."))
          visit(new URL(module.endsWith(".ts") ? module : module + ".ts", url));
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        node.expression.getText(tree) === "process.env"
      ) {
        assert.ok(
          ![
            "OPENAI_API_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "CEDARI_API_KEY",
          ].includes(node.name.text),
          "Server secret referenced in public dependency " + file,
        );
      }
      ts.forEachChild(node, walk);
    }
    walk(tree);
  }
  visit(new URL("../src/public.ts", import.meta.url));
  assert.ok(seen.size > 3);
});
