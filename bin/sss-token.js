#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { normalizePreset, presetConfig, SolanaStablecoin } from "../src/index.js";

const DEFAULT_STATE_PATH = ".sss-state.json";

function help() {
  console.log(`sss-token usage:
  sss-token init --preset sss-1|sss-2 [--state .sss-state.json]
  sss-token init --custom <config.json|config.toml> [--state .sss-state.json]

  sss-token mint <recipient> <amount> [--state .sss-state.json]
  sss-token burn <holder> <amount> [--state .sss-state.json]
  sss-token transfer <from> <to> <amount> [--state .sss-state.json]
  sss-token freeze <address> [--state .sss-state.json]
  sss-token thaw <address> [--state .sss-state.json]
  sss-token pause [--state .sss-state.json]
  sss-token unpause [--state .sss-state.json]
  sss-token status [--state .sss-state.json]
  sss-token supply [--state .sss-state.json]

  sss-token minters add <minter> <quota> [--state .sss-state.json]
  sss-token minters remove <minter> [--state .sss-state.json]
  sss-token minters list [--state .sss-state.json]
  sss-token holders [--min-balance <amount>] [--state .sss-state.json]
  sss-token audit-log [--action <type>] [--state .sss-state.json]

  sss-token blacklist add <address> --reason <reason> [--state .sss-state.json]
  sss-token blacklist remove <address> [--state .sss-state.json]
  sss-token seize <from> --to <treasury> --amount <amount> [--state .sss-state.json]
`);
}

function arg(flag, args) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function parseToml(data) {
  const result = {};
  let section = null;
  for (const rawLine of data.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1);
      if (!result[section]) result[section] = {};
      continue;
    }
    const parts = line.split("=");
    if (parts.length < 2) continue;
    const key = parts[0].trim();
    const valueRaw = parts.slice(1).join("=").trim();
    let value;
    if (valueRaw === "true" || valueRaw === "false") value = valueRaw === "true";
    else if (!Number.isNaN(Number(valueRaw))) value = Number(valueRaw);
    else value = valueRaw.replace(/^"|"$/g, "");
    if (section) result[section][key] = value;
    else result[key] = value;
  }
  return result;
}

function readCustomConfig(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") return JSON.parse(content);
  if (ext === ".toml") return parseToml(content);
  throw new Error("Unsupported config file format. Use .json or .toml");
}

function serializeToken(token) {
  return {
    config: token.config,
    paused: token.paused,
    totalSupply: token.totalSupply.toString(),
    balances: Object.fromEntries([...token.balances.entries()].map(([k, v]) => [k, v.toString()])),
    frozenAccounts: [...token.frozenAccounts.values()],
    blacklist: Object.fromEntries(token.blacklist.entries()),
    minterQuotas: Object.fromEntries(
      [...token.minterQuotas.entries()].map(([k, v]) => [k, { max: v.max.toString(), used: v.used.toString() }])
    ),
    auditLog: token.auditLog,
  };
}

async function tokenFromState(statePath) {
  if (!fs.existsSync(statePath)) {
    throw new Error(`State file not found. Run init first: ${statePath}`);
  }
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const token = await SolanaStablecoin.create({}, state.config);
  token.paused = Boolean(state.paused);
  token.totalSupply = BigInt(state.totalSupply ?? "0");
  token.balances = new Map(Object.entries(state.balances ?? {}).map(([k, v]) => [k, BigInt(v)]));
  token.frozenAccounts = new Set(state.frozenAccounts ?? []);
  token.blacklist = new Map(Object.entries(state.blacklist ?? {}));
  token.minterQuotas = new Map(
    Object.entries(state.minterQuotas ?? {}).map(([k, v]) => [k, { max: BigInt(v.max), used: BigInt(v.used) }])
  );
  token.auditLog = Array.isArray(state.auditLog) ? state.auditLog : [];
  return token;
}

function saveToken(token, statePath) {
  fs.writeFileSync(statePath, `${JSON.stringify(serializeToken(token), null, 2)}\n`, "utf8");
}

const args = process.argv.slice(2);
const cmd = args[0];
const statePath = arg("--state", args) ?? DEFAULT_STATE_PATH;

if (!cmd || cmd === "help" || cmd === "--help") {
  help();
  process.exit(0);
}

if (cmd === "init") {
  const preset = arg("--preset", args);
  const custom = arg("--custom", args);
  if (!preset && !custom) {
    console.error("Missing --preset or --custom");
    process.exit(1);
  }

  let config;
  if (preset) {
    config = {
      ...presetConfig(normalizePreset(preset)),
      name: "Local Stablecoin",
      symbol: "LUSD",
      decimals: 6,
      authority: "local-admin",
    };
  } else {
    config = readCustomConfig(custom);
  }

  const token = await SolanaStablecoin.create({}, config);
  saveToken(token, statePath);
  console.log(JSON.stringify({ action: "init", statePath, config: token.config }, null, 2));
  process.exit(0);
}

const token = await tokenFromState(statePath);

if (cmd === "mint") {
  const [recipient, amount] = args.slice(1);
  const out = await token.mint({ recipient, amount, minter: "cli-minter" });
  saveToken(token, statePath);
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
if (cmd === "burn") {
  const [holder, amount] = args.slice(1);
  const out = await token.burn({ holder, amount, burner: "cli-burner" });
  saveToken(token, statePath);
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
if (cmd === "transfer") {
  const [from, to, amount] = args.slice(1);
  const out = await token.transfer({ from, to, amount });
  saveToken(token, statePath);
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
if (cmd === "freeze") {
  const [address] = args.slice(1);
  const out = await token.freezeAccount({ address, authority: "cli-pauser" });
  saveToken(token, statePath);
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
if (cmd === "thaw") {
  const [address] = args.slice(1);
  const out = await token.thawAccount({ address, authority: "cli-pauser" });
  saveToken(token, statePath);
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
if (cmd === "pause") {
  const out = await token.pause({ authority: "cli-pauser" });
  saveToken(token, statePath);
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
if (cmd === "unpause") {
  const out = await token.unpause({ authority: "cli-pauser" });
  saveToken(token, statePath);
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
if (cmd === "status") {
  console.log(JSON.stringify({ paused: token.paused, totalSupply: await token.getTotalSupply(), blacklistSize: token.blacklist.size, frozenSize: token.frozenAccounts.size }, null, 2));
  process.exit(0);
}
if (cmd === "supply") {
  console.log(await token.getTotalSupply());
  process.exit(0);
}
if (cmd === "minters") {
  const action = args[1];
  if (action === "add") {
    const [minter, quota] = args.slice(2);
    const out = token.setMinterQuota(minter, quota);
    saveToken(token, statePath);
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }
  if (action === "remove") {
    const minter = args[2];
    const out = token.removeMinterQuota(minter);
    saveToken(token, statePath);
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }
  if (action === "list") {
    console.log(JSON.stringify(token.listMinters(), null, 2));
    process.exit(0);
  }
}
if (cmd === "holders") {
  const minBalance = arg("--min-balance", args) ?? "0";
  console.log(JSON.stringify(token.listHolders(minBalance), null, 2));
  process.exit(0);
}
if (cmd === "audit-log") {
  const action = arg("--action", args);
  console.log(JSON.stringify(token.getAuditLog(action), null, 2));
  process.exit(0);
}
if (cmd === "blacklist") {
  const action = args[1];
  const address = args[2];
  if (action === "add") {
    const reason = arg("--reason", args) ?? "unspecified";
    const out = await token.compliance.blacklistAdd(address, reason);
    saveToken(token, statePath);
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }
  if (action === "remove") {
    const out = await token.compliance.blacklistRemove(address);
    saveToken(token, statePath);
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }
}
if (cmd === "seize") {
  const from = args[1];
  const to = arg("--to", args);
  const amount = arg("--amount", args);
  const out = await token.compliance.seize(from, to, amount);
  saveToken(token, statePath);
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

console.error(`Unknown command: ${cmd}`);
help();
process.exit(1);
