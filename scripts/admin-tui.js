#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Connection } from "@solana/web3.js";
import { OnchainSolanaStablecoin, loadKeypairFromFile } from "../src/index.js";

const DEFAULT_STATE_PATH = process.env.SSS_STATE_PATH ?? ".sss-devnet.json";
const DEFAULT_KEYPAIR_PATH = process.env.SSS_KEYPAIR ?? "~/.config/solana/sss-devnet.json";
const DEFAULT_RPC_URL = process.env.SSS_RPC_URL ?? "https://api.devnet.solana.com";

function expandHome(filePath) {
  if (!filePath) return filePath;
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function arg(flag) {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseArgs() {
  return {
    statePath: expandHome(arg("--state") ?? DEFAULT_STATE_PATH),
    keypairPath: expandHome(arg("--keypair") ?? DEFAULT_KEYPAIR_PATH),
    rpcUrl: arg("--rpc-url") ?? DEFAULT_RPC_URL,
  };
}

function loadDeploymentState(statePath) {
  if (!fs.existsSync(statePath)) {
    throw new Error(`State file not found at ${statePath}. Run chain init first.`);
  }
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function saveDeploymentState(statePath, client) {
  fs.writeFileSync(statePath, `${JSON.stringify(client.serialize(), null, 2)}\n`, "utf8");
}

async function createClient(runtime) {
  const state = loadDeploymentState(runtime.statePath);
  const authority = loadKeypairFromFile(runtime.keypairPath);
  const connection = new Connection(runtime.rpcUrl, "confirmed");
  const client = await OnchainSolanaStablecoin.fromDeployment({
    connection,
    rpcUrl: runtime.rpcUrl,
    authority,
    mint: state.mint,
    configAddress: state.configAddress,
    hookConfig: state.hookConfig,
    hookExtraAccountMetaList: state.hookExtraAccountMetaList,
    config: state.config,
    programIds: state.programIds,
    knownHolders: state.knownHolders ?? [],
  });
  return { client, state, authority };
}

function clearScreen() {
  output.write("\x1b[2J\x1b[H");
}

function short(text, head = 4, tail = 4) {
  if (!text || text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function actionHelp() {
  return [
    "[r] refresh",
    "[m] mint",
    "[b] burn",
    "[p] pause/unpause",
    "[k] blacklist add",
    "[u] blacklist remove",
    "[s] seize",
    "[q] quit",
  ].join("  ");
}

function renderDashboard(summary) {
  clearScreen();
  console.log("SSS Admin TUI");
  console.log("");
  console.log(`RPC        ${summary.rpcUrl}`);
  console.log(`State      ${summary.statePath}`);
  console.log(`Authority  ${summary.authority}`);
  console.log(`Mint       ${summary.status.mint}`);
  console.log(`Config     ${summary.status.config}`);
  console.log("");
  console.log(`Paused     ${summary.status.paused}`);
  console.log(`Supply     ${summary.status.totalSupply}`);
  console.log(`Blacklist  ${summary.status.blacklistSize}`);
  console.log(`Frozen     ${summary.status.frozenSize}`);
  console.log(`Decimals   ${summary.status.decimals}`);
  console.log("");
  console.log("Holders");
  if (summary.holders.length === 0) {
    console.log("  none");
  } else {
    for (const holder of summary.holders.slice(0, 8)) {
      console.log(`  ${short(holder.holder, 6, 6)}  balance=${holder.balance}  frozen=${holder.isFrozen}`);
    }
  }
  console.log("");
  console.log("Blacklist");
  if (summary.blacklisted.length === 0) {
    console.log("  none");
  } else {
    for (const item of summary.blacklisted.slice(0, 8)) {
      console.log(`  ${short(item.wallet, 6, 6)}  reason=${item.reason}`);
    }
  }
  console.log("");
  console.log("Recent Audit");
  if (summary.audit.length === 0) {
    console.log("  none");
  } else {
    for (const item of summary.audit.slice(0, 5)) {
      console.log(`  ${short(item.signature, 8, 8)}  slot=${item.slot}  err=${item.err ? "yes" : "no"}`);
    }
  }
  console.log("");
  console.log(actionHelp());
  console.log("");
}

async function gatherSummary(runtime) {
  const { client, authority } = await createClient(runtime);
  const [status, holders, blacklisted, audit] = await Promise.all([
    client.status(),
    client.listHolders(0),
    client.listBlacklisted(),
    client.getAuditLog(),
  ]);
  saveDeploymentState(runtime.statePath, client);
  return {
    client,
    authority,
    status,
    holders,
    blacklisted,
    audit,
    rpcUrl: runtime.rpcUrl,
    statePath: runtime.statePath,
  };
}

async function confirm(rl, label) {
  const answer = (await rl.question(`${label} [y/N]: `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

async function runAction(rl, runtime, action) {
  const { client } = await createClient(runtime);
  if (action === "m") {
    const recipient = (await rl.question("recipient: ")).trim();
    const amount = (await rl.question("amount: ")).trim();
    const result = await client.mint({ recipient, amount });
    saveDeploymentState(runtime.statePath, client);
    return result;
  }
  if (action === "b") {
    const holder = (await rl.question("holder: ")).trim();
    const amount = (await rl.question("amount: ")).trim();
    const result = await client.burn({ holder, amount });
    saveDeploymentState(runtime.statePath, client);
    return result;
  }
  if (action === "p") {
    const status = await client.status();
    const op = status.paused ? "unpause" : "pause";
    if (!(await confirm(rl, `${op} token`))) return { skipped: true };
    const result = status.paused ? await client.unpause({}) : await client.pause({});
    saveDeploymentState(runtime.statePath, client);
    return result;
  }
  if (action === "k") {
    const address = (await rl.question("address to blacklist: ")).trim();
    const reason = (await rl.question("reason: ")).trim() || "unspecified";
    const result = await client.compliance.blacklistAdd(address, reason);
    saveDeploymentState(runtime.statePath, client);
    return result;
  }
  if (action === "u") {
    const address = (await rl.question("address to remove from blacklist: ")).trim();
    const result = await client.compliance.blacklistRemove(address);
    saveDeploymentState(runtime.statePath, client);
    return result;
  }
  if (action === "s") {
    const from = (await rl.question("blacklisted source owner: ")).trim();
    const to = (await rl.question("treasury owner: ")).trim();
    const amount = (await rl.question("amount: ")).trim();
    const result = await client.compliance.seize(from, to, amount);
    saveDeploymentState(runtime.statePath, client);
    return result;
  }
  return { skipped: true };
}

async function main() {
  const runtime = parseArgs();
  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const summary = await gatherSummary(runtime);
      renderDashboard({
        ...summary,
        authority: summary.authority.publicKey.toBase58(),
      });
      let action;
      try {
        action = (await rl.question("select action: ")).trim().toLowerCase();
      } catch (error) {
        if ((error?.message ?? "").includes("readline was closed")) {
          break;
        }
        throw error;
      }
      if (!action || action === "r") {
        continue;
      }
      if (action === "q") {
        break;
      }
      try {
        const result = await runAction(rl, runtime, action);
        console.log("");
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.log("");
        console.error(`action failed: ${error?.message ?? String(error)}`);
      }
      await rl.question("\npress enter to continue...");
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exit(1);
});
