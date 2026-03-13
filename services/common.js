import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Connection } from "@solana/web3.js";
import { OnchainSolanaStablecoin, loadKeypairFromFile } from "../src/index.js";

const DATA_DIR = process.env.SSS_SERVICE_DATA_DIR ?? path.resolve(".services-data");
const DEFAULT_STATE_PATH = process.env.SSS_STATE_PATH ?? path.resolve(".sss-chain.json");
const DEFAULT_KEYPAIR_PATH = expandHome(process.env.SSS_KEYPAIR ?? "~/.config/solana/id.json");
const DEFAULT_CORS_ORIGIN = process.env.SSS_CORS_ORIGIN ?? "*";

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

export function reloadRuntimeState(runtime) {
  runtime.state = readJsonFile(runtime.statePath, runtime.state ?? null);
  return runtime.state;
}

export function persistRuntimeState(runtime, client) {
  const nextState = client.serialize();
  writeJsonFile(runtime.statePath, nextState);
  runtime.state = nextState;
  return nextState;
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

export function createOperationLedger(name) {
  const requests = createStore(`${name}-requests`, []);
  const failures = createStore(`${name}-failures`, []);
  const outbox = createStore("service-outbox", []);

  return {
    requests,
    failures,
    outbox,
    find(requestId) {
      return requests.read().find((item) => item.requestId === requestId) ?? null;
    },
    recordPending(entry) {
      requests.update((items) => [...items.filter((item) => item.requestId !== entry.requestId), entry]);
      return entry;
    },
    recordSuccess(requestId, patch) {
      let finalEntry = null;
      requests.update((items) =>
        items.map((item) => {
          if (item.requestId !== requestId) return item;
          finalEntry = { ...item, ...patch, status: "succeeded", updatedAt: new Date().toISOString() };
          return finalEntry;
        })
      );
      return finalEntry;
    },
    recordFailure(entry) {
      failures.update((items) => [...items, entry]);
      return entry;
    },
    emit(event) {
      outbox.update((items) => [...items, event]);
      return event;
    },
  };
}

export function requestIdFrom(body, prefix) {
  return body?.requestId ?? `${prefix}-${Date.now()}`;
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function defaultHeaders(extra = {}) {
  return {
    "access-control-allow-origin": DEFAULT_CORS_ORIGIN,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    ...extra,
  };
}

export function sendJson(res, statusCode, payload) {
  res.writeHead(
    statusCode,
    defaultHeaders({
      "content-type": "application/json",
    })
  );
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
    if (req.method?.toUpperCase() === "OPTIONS") {
      res.writeHead(204, defaultHeaders());
      res.end();
      return;
    }
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
  reloadRuntimeState(runtime);
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
