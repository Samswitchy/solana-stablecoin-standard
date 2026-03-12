#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Presets, normalizePreset, presetConfig, SolanaStablecoin } from "../src/index.js";

function help() {
  console.log(`sss-token usage:
  sss-token init --preset sss-1|sss-2
  sss-token init --custom <config.json|config.toml>
  sss-token mint <recipient> <amount>
  sss-token burn <holder> <amount>
  sss-token transfer <from> <to> <amount>
  sss-token freeze <address>
  sss-token thaw <address>
  sss-token pause
  sss-token unpause
  sss-token status
  sss-token supply
  sss-token blacklist add <address> --reason <reason>
  sss-token blacklist remove <address>
  sss-token seize <from> --to <treasury> --amount <amount>
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
      if (!result[section]) {
        result[section] = {};
      }
      continue;
    }

    const parts = line.split("=");
    if (parts.length < 2) continue;
    const key = parts[0].trim();
    const valueRaw = parts.slice(1).join("=").trim();

    let value;
    if (valueRaw === "true" || valueRaw === "false") {
      value = valueRaw === "true";
    } else if (!Number.isNaN(Number(valueRaw))) {
      value = Number(valueRaw);
    } else {
      value = valueRaw.replace(/^"|"$/g, "");
    }

    if (section) {
      result[section][key] = value;
    } else {
      result[key] = value;
    }
  }

  return result;
}

function readCustomConfig(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".json") {
    return JSON.parse(content);
  }
  if (ext === ".toml") {
    return parseToml(content);
  }
  throw new Error("Unsupported config file format. Use .json or .toml");
}

async function createLocalToken(presetOrCustom) {
  let options;
  if (presetOrCustom.preset) {
    options = {
      ...presetConfig(normalizePreset(presetOrCustom.preset)),
      name: "Local Stablecoin",
      symbol: "LUSD",
      decimals: 6,
      authority: "local-admin",
    };
  } else {
    options = presetOrCustom;
  }

  return SolanaStablecoin.create({}, options);
}

const args = process.argv.slice(2);
const cmd = args[0];

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

  if (preset) {
    const config = presetConfig(normalizePreset(preset));
    console.log(JSON.stringify({ action: "init", mode: "preset", config }, null, 2));
    process.exit(0);
  }

  const config = readCustomConfig(custom);
  console.log(JSON.stringify({ action: "init", mode: "custom", config }, null, 2));
  process.exit(0);
}

const token = await createLocalToken({ preset: Presets.SSS_2 });

if (cmd === "mint") {
  const [recipient, amount] = args.slice(1);
  console.log(JSON.stringify(await token.mint({ recipient, amount, minter: "cli-minter" }), null, 2));
  process.exit(0);
}

if (cmd === "burn") {
  const [holder, amount] = args.slice(1);
  console.log(JSON.stringify(await token.burn({ holder, amount, burner: "cli-burner" }), null, 2));
  process.exit(0);
}

if (cmd === "transfer") {
  const [from, to, amount] = args.slice(1);
  console.log(JSON.stringify(await token.transfer({ from, to, amount }), null, 2));
  process.exit(0);
}

if (cmd === "freeze") {
  const [address] = args.slice(1);
  console.log(JSON.stringify(await token.freezeAccount({ address, authority: "cli-pauser" }), null, 2));
  process.exit(0);
}

if (cmd === "thaw") {
  const [address] = args.slice(1);
  console.log(JSON.stringify(await token.thawAccount({ address, authority: "cli-pauser" }), null, 2));
  process.exit(0);
}

if (cmd === "pause") {
  console.log(JSON.stringify(await token.pause({ authority: "cli-pauser" }), null, 2));
  process.exit(0);
}

if (cmd === "unpause") {
  console.log(JSON.stringify(await token.unpause({ authority: "cli-pauser" }), null, 2));
  process.exit(0);
}

if (cmd === "status") {
  console.log(JSON.stringify({
    paused: token.paused,
    totalSupply: await token.getTotalSupply(),
    blacklistSize: token.blacklist.size,
    frozenSize: token.frozenAccounts.size,
  }, null, 2));
  process.exit(0);
}

if (cmd === "supply") {
  console.log(await token.getTotalSupply());
  process.exit(0);
}

if (cmd === "blacklist") {
  const action = args[1];
  const address = args[2];
  if (action === "add") {
    const reason = arg("--reason", args) ?? "unspecified";
    console.log(JSON.stringify(await token.compliance.blacklistAdd(address, reason), null, 2));
    process.exit(0);
  }
  if (action === "remove") {
    console.log(JSON.stringify(await token.compliance.blacklistRemove(address), null, 2));
    process.exit(0);
  }
}

if (cmd === "seize") {
  const from = args[1];
  const to = arg("--to", args);
  const amount = arg("--amount", args);
  console.log(JSON.stringify(await token.compliance.seize(from, to, amount), null, 2));
  process.exit(0);
}

console.error(`Unknown command: ${cmd}`);
help();
process.exit(1);
