import { test } from "node:test";
import assert from "node:assert/strict";
import { LIBRARY, getLibraryLesson } from "../lib/curriculum.ts";
import { LEVEL_ORDER } from "../lib/learning.ts";
import { TOPIC_CATALOG } from "../lib/topics.ts";

test("library covers every level with ordered units", () => {
  for (const level of LEVEL_ORDER) {
    const lessons = LIBRARY.filter((l) => l.level === level);
    assert.ok(lessons.length >= 10, `${level} has ${lessons.length} lessons`);
    assert.deepEqual(lessons.map((l) => l.unit), lessons.map((_, i) => i + 1));
    assert.ok(new Set(lessons.map((l) => l.mode)).size >= 2, `${level} mixes modes`);
  }
});

test("lesson ids are unique and resolvable", () => {
  const ids = LIBRARY.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(getLibraryLesson(id)?.id, id);
  assert.equal(getLibraryLesson("nope"), null);
  assert.ok(ids.every((id) => /^[a-z0-9-]+$/.test(id)));
});

test("library categories match the topic catalog", () => {
  const cats = new Set(Object.keys(TOPIC_CATALOG));
  for (const l of LIBRARY) assert.ok(cats.has(l.category), `unknown category ${l.category}`);
  for (const l of LIBRARY) assert.ok(l.focus && l.description && l.title);
});
