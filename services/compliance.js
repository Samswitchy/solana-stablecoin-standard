import {
  createChainClient,
  createStore,
  readJsonBody,
  resolveRuntimeConfig,
  sendJson,
  startService,
} from "./common.js";

const SERVICE = "compliance";
const actions = createStore("compliance-actions", []);
const runtime = resolveRuntimeConfig(SERVICE);

async function health() {
  return {
    ok: true,
    service: SERVICE,
    rpcUrl: runtime.rpcUrl,
    statePath: runtime.statePath,
    actions: actions.read().length,
  };
}

async function record(entry) {
  actions.update((items) => [...items, entry]);
  return entry;
}

async function handleBlacklistAdd(req, res) {
  const body = await readJsonBody(req);
  const client = await createChainClient(runtime);
  const result = await client.compliance.blacklistAdd(body.address, body.reason ?? "unspecified");
  const entry = await record({
    id: `${Date.now()}-blacklist-add`,
    action: "blacklist_add",
    address: body.address,
    reason: body.reason ?? "unspecified",
    signature: result.signature,
    createdAt: new Date().toISOString(),
  });
  sendJson(res, 200, { ok: true, entry, result });
}

async function handleBlacklistRemove(req, res) {
  const body = await readJsonBody(req);
  const client = await createChainClient(runtime);
  const result = await client.compliance.blacklistRemove(body.address);
  const entry = await record({
    id: `${Date.now()}-blacklist-remove`,
    action: "blacklist_remove",
    address: body.address,
    signature: result.signature,
    createdAt: new Date().toISOString(),
  });
  sendJson(res, 200, { ok: true, entry, result });
}

async function handleSeize(req, res) {
  const body = await readJsonBody(req);
  const client = await createChainClient(runtime);
  const result = await client.compliance.seize(body.from, body.to, body.amount);
  const entry = await record({
    id: `${Date.now()}-seize`,
    action: "seize",
    from: body.from,
    to: body.to,
    amount: String(body.amount),
    signature: result.signature,
    createdAt: new Date().toISOString(),
  });
  sendJson(res, 200, { ok: true, entry, result });
}

async function handleBlacklisted(_req, res) {
  const client = await createChainClient(runtime);
  sendJson(res, 200, { ok: true, items: await client.listBlacklisted() });
}

async function handleAudit(_req, res) {
  sendJson(res, 200, { ok: true, items: actions.read() });
}

await startService(
  SERVICE,
  {
    "POST /blacklist/add": handleBlacklistAdd,
    "POST /blacklist/remove": handleBlacklistRemove,
    "POST /seize": handleSeize,
    "GET /blacklist": handleBlacklisted,
    "GET /audit": handleAudit,
  },
  health
);
