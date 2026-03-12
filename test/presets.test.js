import test from "node:test";
import assert from "node:assert/strict";
import { Presets, normalizePreset, presetConfig, mergeCustomConfig } from "../src/presets.js";

test("normalize preset supports case-insensitive values", () => {
  assert.equal(normalizePreset("SSS-1"), Presets.SSS_1);
  assert.equal(normalizePreset("sss-2"), Presets.SSS_2);
});

test("sss-1 preset is minimal", () => {
  const c = presetConfig(Presets.SSS_1);
  assert.equal(c.extensions.permanentDelegate, false);
  assert.equal(c.extensions.transferHook, false);
  assert.ok(c.roles.includes("minter"));
  assert.ok(!c.roles.includes("seizer"));
});

test("sss-2 preset enables compliance flags", () => {
  const c = presetConfig(Presets.SSS_2);
  assert.equal(c.extensions.permanentDelegate, true);
  assert.equal(c.extensions.transferHook, true);
  assert.ok(c.roles.includes("blacklister"));
  assert.ok(c.roles.includes("seizer"));
});

test("custom merge keeps defaults and applies override", () => {
  const c = mergeCustomConfig(presetConfig(Presets.SSS_2), {
    extensions: { transferHook: false },
  });
  assert.equal(c.extensions.permanentDelegate, true);
  assert.equal(c.extensions.transferHook, false);
});
