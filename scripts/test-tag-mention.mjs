// The "#tag" mentions a task name can carry while it is typed.
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts") && !url.includes("node_modules")) {
      return { format: "module", source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, shortCircuit: true };
    }
    return next(url, context);
  },
});

const { completeTagMention, findTagMention, matchTags, removeTagMention, tagAcceptedBySpace } =
  await import("../src/lib/tag-mention.ts");

const tag = (name) => ({ id: name.toLowerCase(), name, color: "#000000", updatedAt: "", deletedAt: null });
const tags = [tag("Work"), tag("Organic chemistry"), tag("Organic"), tag("Home")];

// [text with the caret as "|", expected mention text or null]
const mentions = [
  ["#|", "#"],
  ["#wo|", "#wo"],
  ["Buy milk #wo|", "#wo"],
  ["Buy milk #wo|rk later", "#work"],
  ["#organic chem|", "#organic chem"],
  ["#organic chem| later", "#organic chem"],
  ["#organic x|", null],
  ["#123 |", null],
  ["#123 and more|", null],
  ["C#|", null],
  ["issue#12|", null],
  ["#a #b|", "#b"],
  ["#zzz|", "#zzz"],
  ["Buy milk|", null],
];

for (const [input, expected] of mentions) {
  test(`mention: ${input}`, () => {
    const caret = input.indexOf("|");
    const text = input.replace("|", "");
    const mention = findTagMention(text, caret, tags);
    if (expected === null) assert.equal(mention, null);
    else {
      assert.ok(mention, "expected a mention");
      assert.equal(text.slice(mention.start, mention.end), expected);
      assert.equal(mention.query, expected.slice(1));
    }
  });
}

test("matches rank exact, then prefix, then anywhere", () => {
  assert.deepEqual(matchTags(tags, "organic").map((t) => t.name), ["Organic", "Organic chemistry"]);
  assert.deepEqual(matchTags(tags, "or").map((t) => t.name), ["Organic", "Organic chemistry", "Work"]);
  assert.deepEqual(matchTags(tags, "").map((t) => t.name), ["Home", "Organic", "Organic chemistry", "Work"]);
  assert.deepEqual(matchTags(tags, "zzz"), []);
});

test("a space accepts an exact name unless a longer tag continues it", () => {
  assert.equal(tagAcceptedBySpace(tags, "work")?.name, "Work");
  assert.equal(tagAcceptedBySpace(tags, "Organic chemistry")?.name, "Organic chemistry");
  assert.equal(tagAcceptedBySpace(tags, "organic"), null);
  assert.equal(tagAcceptedBySpace(tags, "wor"), null);
  assert.equal(tagAcceptedBySpace(tags, ""), null);
});

test("removing a mention closes the gap and places the caret", () => {
  assert.deepEqual(removeTagMention("Buy milk #work", { start: 9, end: 14 }), { text: "Buy milk ", caret: 9 });
  assert.deepEqual(removeTagMention("Buy #work milk", { start: 4, end: 9 }), { text: "Buy milk", caret: 4 });
  assert.deepEqual(removeTagMention("#work milk", { start: 0, end: 5 }), { text: "milk", caret: 0 });
  assert.deepEqual(removeTagMention("#work", { start: 0, end: 5 }), { text: "", caret: 0 });
});

test("completing a mention fills in the full name behind the #", () => {
  assert.deepEqual(completeTagMention("Buy #wo milk", { start: 4, end: 7 }, tag("Work")), { text: "Buy #Work milk", caret: 9 });
  assert.deepEqual(completeTagMention("#org", { start: 0, end: 4 }, tag("Organic chemistry")), { text: "#Organic chemistry", caret: 18 });
});
