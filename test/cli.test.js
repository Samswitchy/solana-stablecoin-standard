import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const CLI = path.resolve("bin/sss-token.js");

function run(args) {
  return execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

test("cli persists state across commands", () => {
  const state = path.join(os.tmpdir(), `sss-state-${Date.now()}.json`);
  const initOut = JSON.parse(run(["init", "--preset", "sss-2", "--state", state]));
  assert.equal(initOut.action, "init");
  run(["mint", "alice", "100", "--state", state]);
  run(["transfer", "alice", "bob", "30", "--state", state]);
  const supply = run(["supply", "--state", state]).trim();
  assert.equal(supply, "100");
  const status = JSON.parse(run(["status", "--state", state]));
  assert.equal(status.totalSupply, "100");
  fs.unlinkSync(state);
});

test("cli supports minter/holder/audit commands", () => {
  const state = path.join(os.tmpdir(), `sss-state-${Date.now()}-ops.json`);
  run(["init", "--preset", "sss-2", "--state", state]);
  run(["minters", "add", "desk-1", "1000", "--state", state]);
  run(["mint", "alice", "400", "--state", state]);
  run(["mint", "bob", "200", "--state", state]);
  const minters = JSON.parse(run(["minters", "list", "--state", state]));
  assert.equal(minters.length, 1);
  const holders = JSON.parse(run(["holders", "--min-balance", "300", "--state", state]));
  assert.equal(holders.length, 1);
  assert.equal(holders[0].holder, "alice");
  const audit = JSON.parse(run(["audit-log", "--action", "mint", "--state", state]));
  assert.equal(audit.length, 2);
  fs.unlinkSync(state);
});
