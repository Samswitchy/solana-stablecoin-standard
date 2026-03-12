import test from "node:test";
import assert from "node:assert/strict";
import { SolanaStablecoin, Presets } from "../src/index.js";

test("create requires required fields", async () => {
  await assert.rejects(() => SolanaStablecoin.create({}, { preset: Presets.SSS_1 }), /Missing required config field/);
});

test("mint + transfer + burn updates balances and supply", async () => {
  const s = await SolanaStablecoin.create({}, { preset: Presets.SSS_1, name: "MyUSD", symbol: "MUSD", decimals: 6, authority: "admin" });
  await s.mint({ recipient: "alice", amount: 1000, minter: "m1" });
  await s.transfer({ from: "alice", to: "bob", amount: 250 });
  await s.burn({ holder: "bob", amount: 100, burner: "b1" });
  assert.equal(s.getBalance("alice"), 750n);
  assert.equal(s.getBalance("bob"), 150n);
  assert.equal(await s.getTotalSupply(), "900");
});

test("minter lifecycle: add/list/remove", async () => {
  const s = await SolanaStablecoin.create({}, { preset: Presets.SSS_1, name: "MyUSD", symbol: "MUSD", decimals: 6, authority: "admin" });
  s.setMinterQuota("desk-1", 500);
  assert.equal(s.listMinters().length, 1);
  assert.equal(s.listMinters()[0].remaining, "500");
  s.removeMinterQuota("desk-1");
  assert.equal(s.listMinters().length, 0);
});

test("holders and audit log queries", async () => {
  const s = await SolanaStablecoin.create({}, { preset: Presets.SSS_2, name: "MyUSD", symbol: "MUSD", decimals: 6, authority: "admin" });
  await s.mint({ recipient: "alice", amount: 100, minter: "m1" });
  await s.mint({ recipient: "bob", amount: 200, minter: "m1" });
  const holders = s.listHolders(150);
  assert.equal(holders.length, 1);
  assert.equal(holders[0].holder, "bob");
  const mints = s.getAuditLog("mint");
  assert.equal(mints.length, 2);
});

test("pause prevents minting", async () => {
  const s = await SolanaStablecoin.create({}, { preset: Presets.SSS_1, name: "MyUSD", symbol: "MUSD", decimals: 6, authority: "admin" });
  await s.pause({ authority: "admin" });
  await assert.rejects(() => s.mint({ recipient: "alice", amount: 1, minter: "m1" }), /paused/);
});

test("quota enforcement blocks over-minting", async () => {
  const s = await SolanaStablecoin.create({}, { preset: Presets.SSS_1, name: "MyUSD", symbol: "MUSD", decimals: 6, authority: "admin" });
  s.setMinterQuota("m1", 100);
  await s.mint({ recipient: "alice", amount: 60, minter: "m1" });
  await assert.rejects(() => s.mint({ recipient: "alice", amount: 50, minter: "m1" }), /quota exceeded/);
});

test("ss2 compliance methods are callable", async () => {
  const s = await SolanaStablecoin.create({}, { preset: Presets.SSS_2, name: "MyUSD", symbol: "MUSD", decimals: 6, authority: "admin" });
  await s.mint({ recipient: "wallet", amount: 500, minter: "m1" });
  const res = await s.compliance.blacklistAdd("wallet", "watchlist");
  assert.equal(res.ok, true);
  await assert.rejects(() => s.transfer({ from: "wallet", to: "vault", amount: 10 }), /blacklisted/);
  await s.compliance.blacklistRemove("wallet");
  const seize = await s.compliance.seize("wallet", "treasury", 100);
  assert.equal(seize.ok, true);
  assert.equal(s.getBalance("treasury"), 100n);
});

test("ss1 compliance access fails fast", async () => {
  const s = await SolanaStablecoin.create({}, { preset: Presets.SSS_1, name: "MyUSD", symbol: "MUSD", decimals: 6, authority: "admin" });
  assert.throws(() => s.compliance, /not enabled/);
});
