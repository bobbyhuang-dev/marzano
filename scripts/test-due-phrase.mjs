// The due-date phrases a task name can carry, checked against a fixed clock.
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

const { parseDuePhrase, removeDuePhrase } = await import("../src/lib/due-phrase.ts");

// A Tuesday afternoon.
const now = new Date(2026, 8, 8, 14, 30);
const local = (y, m, d, h, min) => new Date(y, m - 1, d, h, min).toISOString();

const days = [
  ["Call mum tmr", "Call mum", "2026-09-09", "tmr"],
  ["Call mum tomorrow", "Call mum", "2026-09-09", "tomorrow"],
  ["Call mum Tomorow", "Call mum", "2026-09-09", "Tomorow"],
  ["tmrw dentist", "dentist", "2026-09-09", "tmrw"],
  ["Finish report today", "Finish report", "2026-09-08", "today"],
  ["Finish report tonight", "Finish report", "2026-09-08", "tonight"],
  ["Pack day after tomorrow", "Pack", "2026-09-10", "day after tomorrow"],
  ["Pay rent by friday", "Pay rent", "2026-09-11", "by friday"],
  ["Pay rent on Friday", "Pay rent", "2026-09-11", "on Friday"],
  ["Gym tuesday", "Gym", "2026-09-15", "tuesday"],
  ["Gym next tuesday", "Gym", "2026-09-15", "next tuesday"],
  ["Gym fri", "Gym", "2026-09-11", "fri"],
  ["Gym on thu", "Gym", "2026-09-10", "on thu"],
  ["Plan trip this weekend", "Plan trip", "2026-09-12", "this weekend"],
  ["Plan trip next weekend", "Plan trip", "2026-09-19", "next weekend"],
  ["Review next week", "Review", "2026-09-14", "next week"],
  ["Invoice next month", "Invoice", "2026-10-01", "next month"],
  ["Renew in 3 days", "Renew", "2026-09-11", "in 3 days"],
  ["Renew in a week", "Renew", "2026-09-15", "in a week"],
  ["Renew in two months", "Renew", "2026-11-08", "in two months"],
  ["Dentist sep 12", "Dentist", "2026-09-12", "sep 12"],
  ["Dentist Sept 12th", "Dentist", "2026-09-12", "Sept 12th"],
  ["Dentist 12 sep", "Dentist", "2026-09-12", "12 sep"],
  ["Dentist 12th of September", "Dentist", "2026-09-12", "12th of September"],
  ["Birthday jan 5", "Birthday", "2027-01-05", "jan 5"],
  ["Birthday jan 5 2028", "Birthday", "2028-01-05", "jan 5 2028"],
  ["Taxes 2027-04-15", "Taxes", "2027-04-15", "2027-04-15"],
  ["Rent on the 1st", "Rent", "2026-10-01", "on the 1st"],
  ["Rent the 20th", "Rent", "2026-09-20", "the 20th"],
  ["Buy milk, tmr", "Buy milk", "2026-09-09", "tmr"],
  ["Meet tmr about friday plan", "Meet tmr about plan", "2026-09-11", "friday"],
];

for (const [input, title, dueAt, text] of days) {
  test(`day: ${input}`, () => {
    const match = parseDuePhrase(input, now);
    assert.ok(match, "expected a match");
    assert.equal(match.text, text);
    assert.equal(match.dueAt, dueAt);
    assert.equal(removeDuePhrase(input, match), title);
  });
}

const times = [
  ["Call mum tmr at 3pm", "Call mum", local(2026, 9, 9, 15, 0), "tmr at 3pm"],
  ["Call mum tmr 3:30pm", "Call mum", local(2026, 9, 9, 15, 30), "tmr 3:30pm"],
  ["Call mum tomorrow, 9 am", "Call mum", local(2026, 9, 9, 9, 0), "tomorrow, 9 am"],
  ["Standup monday at 9:15", "Standup", local(2026, 9, 14, 9, 15), "monday at 9:15"],
  ["Lunch friday at noon", "Lunch", local(2026, 9, 11, 12, 0), "friday at noon"],
  ["Call mum at 5pm", "Call mum", local(2026, 9, 8, 17, 0), "at 5pm"],
  ["Call mum at 9am", "Call mum", local(2026, 9, 9, 9, 0), "at 9am"],
  ["Call mum 5pm", "Call mum", local(2026, 9, 8, 17, 0), "5pm"],
  ["Call mum at 12am", "Call mum", local(2026, 9, 9, 0, 0), "at 12am"],
  ["Call mum at 12pm tmr", "Call mum at 12pm", "2026-09-09", "tmr"],
];

for (const [input, title, dueAt, text] of times) {
  test(`time: ${input}`, () => {
    const match = parseDuePhrase(input, now);
    assert.ok(match, "expected a match");
    assert.equal(match.text, text);
    assert.equal(match.dueAt, dueAt);
    assert.equal(removeDuePhrase(input, match), title);
  });
}

const none = [
  "tmr",
  "  tomorrow ",
  "Call Tom",
  "Buy sun cream today's",
  "Sun cream for the beach",
  "I sat on the mat",
  "Mon repos",
  "Wed the cake",
  "Buy 5 pm sets",
  "Call at 5",
  "I may go",
  "Read Tomorrowland",
  "Renew in 0 days x",
  "Dentist sep 31",
  "Book 2026-02-30",
  "Call mum at 25:00",
  "Atmrx",
];

for (const input of none) {
  test(`no date: ${input}`, () => {
    assert.equal(parseDuePhrase(input, now), null);
  });
}

test("a weekday named today is a week off", () => {
  assert.equal(parseDuePhrase("Gym tuesday", now)?.dueAt, "2026-09-15");
  assert.equal(parseDuePhrase("Gym wednesday", now)?.dueAt, "2026-09-09");
});

test("a sat at the end is a saturday, but not in the middle", () => {
  assert.equal(parseDuePhrase("Brunch sat", now)?.dueAt, "2026-09-12");
  assert.equal(parseDuePhrase("Brunch sat down", now), null);
});

test("offsets point at the words", () => {
  const match = parseDuePhrase("Call mum by tmr at 3pm", now);
  assert.equal("Call mum by tmr at 3pm".slice(match.start, match.end), "by tmr at 3pm");
});
