import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Connection, Keypair } from "@solana/web3.js";
import { OnchainSolanaStablecoin, Presets } from "../src/index.js";

const RUN_LOCALNET = process.env.SSS_RUN_LOCALNET_TESTS === "1";
const integrationTest = RUN_LOCALNET ? test : test.skip;

const SOLANA_BIN_DIR =
  process.env.SOLANA_BIN_DIR ?? path.join(os.homedir(), ".local/share/solana/install/active_release/bin");
const SOLANA = path.join(SOLANA_BIN_DIR, "solana");
const SOLANA_VALIDATOR = path.join(SOLANA_BIN_DIR, "solana-test-validator");
const PROJECT_ROOT = path.resolve(".");
const TARGET_DEPLOY = path.join(PROJECT_ROOT, "target", "deploy");
const TMP_ROOT = path.join(os.tmpdir(), `sss-it-${process.pid}`);
const PORT_OFFSET = process.pid % 200;
const RPC_PORT = 19099 + PORT_OFFSET;
const FAUCET_PORT = 19200 + PORT_OFFSET;
const GOSSIP_PORT = 18021 + PORT_OFFSET;
const DYNAMIC_PORT_START = 18160 + PORT_OFFSET;
const DYNAMIC_PORT_END = DYNAMIC_PORT_START + 25;

const RPC_URL = `http://127.0.0.1:${RPC_PORT}`;
const LEDGER_PATH = path.join(TMP_ROOT, "ledger");
const AUTHORITY_PATH = path.join(TMP_ROOT, "authority.json");

let validatorProcess = null;
let authority = null;
let connection = null;

function writeKeypair(filePath, keypair) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(Array.from(keypair.secretKey))}\n`, "utf8");
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

async function waitForRpc(url, attempts = 30) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      run(SOLANA, ["cluster-version", "--url", url]);
      return;
    } catch {
      await delay(1000);
    }
  }
  throw new Error(`Validator RPC did not become ready at ${url}.`);
}

async function startValidator() {
  validatorProcess = spawn(
    SOLANA_VALIDATOR,
    [
      "--reset",
      "--ledger",
      LEDGER_PATH,
      "--rpc-port",
      String(RPC_PORT),
      "--faucet-port",
      String(FAUCET_PORT),
      "--gossip-port",
      String(GOSSIP_PORT),
      "--dynamic-port-range",
      `${DYNAMIC_PORT_START}-${DYNAMIC_PORT_END}`,
      "--quiet",
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  validatorProcess.stderr.on("data", () => {});
  validatorProcess.stdout.on("data", () => {});
  await waitForRpc(RPC_URL);
}

async function deployPrograms() {
  const stablecoinBinary = path.join(TMP_ROOT, "stablecoin_core.so");
  const stablecoinProgramId = path.join(TMP_ROOT, "stablecoin_core-keypair.json");
  const transferHookBinary = path.join(TMP_ROOT, "transfer_hook.so");
  const transferHookProgramId = path.join(TMP_ROOT, "transfer_hook-keypair.json");
  fs.copyFileSync(path.join(TARGET_DEPLOY, "stablecoin_core.so"), stablecoinBinary);
  fs.copyFileSync(path.join(TARGET_DEPLOY, "stablecoin_core-keypair.json"), stablecoinProgramId);
  fs.copyFileSync(path.join(TARGET_DEPLOY, "transfer_hook.so"), transferHookBinary);
  fs.copyFileSync(path.join(TARGET_DEPLOY, "transfer_hook-keypair.json"), transferHookProgramId);

  run(SOLANA, ["airdrop", "30", authority.publicKey.toBase58(), "--url", RPC_URL]);
  run(SOLANA, [
    "program",
    "deploy",
    stablecoinBinary,
    "--program-id",
    stablecoinProgramId,
    "--keypair",
    AUTHORITY_PATH,
    "--upgrade-authority",
    AUTHORITY_PATH,
    "--url",
    RPC_URL,
    "--use-rpc",
  ]);
  run(SOLANA, [
    "program",
    "deploy",
    transferHookBinary,
    "--program-id",
    transferHookProgramId,
    "--keypair",
    AUTHORITY_PATH,
    "--upgrade-authority",
    AUTHORITY_PATH,
    "--url",
    RPC_URL,
    "--use-rpc",
  ]);
}

if (RUN_LOCALNET) {
  before(async () => {
    authority = Keypair.generate();
    writeKeypair(AUTHORITY_PATH, authority);
    connection = new Connection(RPC_URL, "confirmed");
    await startValidator();
    await deployPrograms();
  });

  after(async () => {
    if (connection?._rpcWebSocket?.close) {
      connection._rpcWebSocket.close();
    }
    if (validatorProcess) {
      validatorProcess.kill("SIGTERM");
    }
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });
}

integrationTest("SSS-1 localnet happy path: mint then freeze/thaw", async () => {
  const stable = await OnchainSolanaStablecoin.create(connection, {
    preset: Presets.SSS_1,
    name: "Integration USD",
    symbol: "IUSD",
    decimals: 6,
    authority,
  });

  await stable.setMinterQuota(authority.publicKey, 1_000_000);
  await stable.mint({ recipient: authority.publicKey, amount: 500_000, minter: authority });
  await stable.freezeAccount({ address: authority.publicKey, authority });
  let holders = await stable.listHolders(1);
  assert.equal(holders.length, 1);
  assert.equal(holders[0].balance, "500000");
  assert.equal(holders[0].isFrozen, true);

  await stable.thawAccount({ address: authority.publicKey, authority });
  holders = await stable.listHolders(1);
  assert.equal(holders[0].isFrozen, false);
});

integrationTest("SSS-2 localnet happy path: blacklist blocks transfer, seize succeeds", async () => {
  const treasury = Keypair.generate();
  const stable = await OnchainSolanaStablecoin.create(connection, {
    preset: Presets.SSS_2,
    name: "Compliance USD",
    symbol: "CUSD",
    decimals: 6,
    authority,
  });

  await stable.setMinterQuota(authority.publicKey, 1_000_000);
  await stable.mint({ recipient: authority.publicKey, amount: 500_000, minter: authority });
  await stable.compliance.blacklistAdd(authority.publicKey, "watchlist", authority);

  await assert.rejects(
    () =>
      stable.transfer({
        from: authority.publicKey,
        to: treasury.publicKey,
        amount: 1,
        owner: authority,
      }),
    /SourceBlacklisted|blacklisted|0x1773/
  );

  const seized = await stable.compliance.seize(
    authority.publicKey,
    treasury.publicKey,
    100_000,
    authority
  );
  assert.equal(seized.ok, true);

  const holders = await stable.listHolders(1);
  const byHolder = new Map(holders.map((holder) => [holder.holder, holder]));
  assert.equal(byHolder.get(authority.publicKey.toBase58())?.balance, "400000");
  assert.equal(byHolder.get(treasury.publicKey.toBase58())?.balance, "100000");
});
