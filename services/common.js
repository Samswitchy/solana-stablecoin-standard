import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Connection } from "@solana/web3.js";
import { OnchainSolanaStablecoin, loadKeypairFromFile } from "../src/index.js";

const DATA_DIR = process.env.SSS_SERVICE_DATA_DIR ?? path.resolve(".services-data");
const DEFAULT_STATE_PATH = process.env.SSS_STATE_PATH ?? path.resolve(".sss-chain.json");
const DEFAULT_KEYPAIR_PATH = expandHome(process.env.SSS_KEYPAIR ?? "~/.config/solana/id.json");

export function expandHome(value) {
  if (!value) return value;
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

export function ensureDir(dirPath = DATA_DIR) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function log(service, level, event, data = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service,
      level,
      event,
      ...data,
    })
  );
}

export function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function createStore(name, initialValue) {
  const filePath = path.join(ensureDir(), `${name}.json`);
  return {
    filePath,
    read() {
      return readJsonFile(filePath, initialValue);
    },
    write(value) {
      writeJsonFile(filePath, value);
      return value;
    },
    update(mutator) {
      const current = this.read();
      const next = mutator(current);
      return this.write(next);
    },
  };
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

export function asyncHandler(service, fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      log(service, "error", "request_failed", {
        method: req.method,
        url: req.url,
        error: error?.message ?? String(error),
      });
      sendJson(res, 500, {
        ok: false,
        error: error?.message ?? String(error),
      });
    }
  };
}

export function createRouter(service, routes, healthFactory) {
  return asyncHandler(service, async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const key = `${req.method.toUpperCase()} ${url.pathname}`;
    if (key === "GET /health") {
      sendJson(res, 200, await healthFactory());
      return;
    }
    const handler = routes[key];
    if (!handler) {
      sendJson(res, 404, { ok: false, error: `No route for ${key}` });
      return;
    }
    await handler(req, res, url);
  });
}

export function resolveRuntimeConfig(service) {
  const statePath = DEFAULT_STATE_PATH;
  const state = readJsonFile(statePath, null);
  return {
    service,
    port: Number(process.env.PORT ?? 8080),
    statePath,
    keypairPath: DEFAULT_KEYPAIR_PATH,
    rpcUrl: process.env.SSS_RPC_URL ?? state?.rpcUrl ?? "http://127.0.0.1:8899",
    state,
  };
}

export async function createChainClient(runtime) {
  if (!runtime.state) {
    throw new Error(`Missing deployment state file at ${runtime.statePath}`);
  }
  if (!fs.existsSync(runtime.keypairPath)) {
    throw new Error(`Missing signer keypair at ${runtime.keypairPath}`);
  }
  const connection = new Connection(runtime.rpcUrl, "confirmed");
  const authority = loadKeypairFromFile(runtime.keypairPath);
  return OnchainSolanaStablecoin.fromDeployment({
    connection,
    rpcUrl: runtime.rpcUrl,
    authority,
    mint: runtime.state.mint,
    configAddress: runtime.state.configAddress,
    hookConfig: runtime.state.hookConfig,
    hookExtraAccountMetaList: runtime.state.hookExtraAccountMetaList,
    config: runtime.state.config,
    programIds: runtime.state.programIds,
  });
}

export async function startService(service, routes, healthFactory) {
  const runtime = resolveRuntimeConfig(service);
  const server = (await import("node:http")).createServer(createRouter(service, routes, healthFactory));
  await new Promise((resolve) => server.listen(runtime.port, resolve));
  log(service, "info", "service_started", {
    port: runtime.port,
    rpcUrl: runtime.rpcUrl,
    statePath: runtime.statePath,
  });
  return { runtime, server };
}
