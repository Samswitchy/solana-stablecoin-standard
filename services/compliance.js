import {
  createChainClient,
  createOperationLedger,
  persistRuntimeState,
  requestIdFrom,
  readJsonBody,
  resolveRuntimeConfig,
  sendJson,
  startService,
} from "./common.js";

const SERVICE = "compliance";
const ledger = createOperationLedger(SERVICE);
const runtime = resolveRuntimeConfig(SERVICE);

async function health() {
  return {
    ok: true,
    service: SERVICE,
    rpcUrl: runtime.rpcUrl,
    statePath: runtime.statePath,
    authority: runtime.authorityPubkey,
    actions: ledger.requests.read().length,
    failures: ledger.failures.read().length,
  };
}

async function handleBlacklistAdd(req, res) {
  const body = await readJsonBody(req);
  const requestId = requestIdFrom(body, "blacklist-add");
  const existing = ledger.find(requestId);
  if (existing?.status === "succeeded") {
    sendJson(res, 200, { ok: true, deduped: true, entry: existing });
    return;
  }
  ledger.recordPending({
    requestId,
    action: "blacklist_add",
    address: body.address,
    reason: body.reason ?? "unspecified",
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  const client = await createChainClient(runtime);
  try {
    const result = await client.compliance.blacklistAdd(body.address, body.reason ?? "unspecified");
    persistRuntimeState(runtime, client);
    const entry = ledger.recordSuccess(requestId, { signature: result.signature });
    ledger.emit({
      id: `${requestId}-event`,
      service: SERVICE,
      event: "blacklist.added",
      requestId,
      signature: result.signature,
      createdAt: new Date().toISOString(),
    });
    sendJson(res, 200, { ok: true, entry, result });
  } catch (error) {
    const failure = ledger.recordFailure({
      requestId,
      action: "blacklist_add",
      address: body.address,
      error: error?.message ?? String(error),
      failedAt: new Date().toISOString(),
    });
    sendJson(res, 500, { ok: false, failure });
  }
}

async function handleBlacklistRemove(req, res) {
  const body = await readJsonBody(req);
  const requestId = requestIdFrom(body, "blacklist-remove");
  const existing = ledger.find(requestId);
  if (existing?.status === "succeeded") {
    sendJson(res, 200, { ok: true, deduped: true, entry: existing });
    return;
  }
  ledger.recordPending({
    requestId,
    action: "blacklist_remove",
    address: body.address,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  const client = await createChainClient(runtime);
  try {
    const result = await client.compliance.blacklistRemove(body.address);
    persistRuntimeState(runtime, client);
    const entry = ledger.recordSuccess(requestId, { signature: result.signature });
    ledger.emit({
      id: `${requestId}-event`,
      service: SERVICE,
      event: "blacklist.removed",
      requestId,
      signature: result.signature,
      createdAt: new Date().toISOString(),
    });
    sendJson(res, 200, { ok: true, entry, result });
  } catch (error) {
    const failure = ledger.recordFailure({
      requestId,
      action: "blacklist_remove",
      address: body.address,
      error: error?.message ?? String(error),
      failedAt: new Date().toISOString(),
    });
    sendJson(res, 500, { ok: false, failure });
  }
}

async function handleSeize(req, res) {
  const body = await readJsonBody(req);
  const requestId = requestIdFrom(body, "seize");
  const existing = ledger.find(requestId);
  if (existing?.status === "succeeded") {
    sendJson(res, 200, { ok: true, deduped: true, entry: existing });
    return;
  }
  ledger.recordPending({
    requestId,
    action: "seize",
    from: body.from,
    to: body.to,
    amount: String(body.amount),
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  const client = await createChainClient(runtime);
  try {
    const result = await client.compliance.seize(body.from, body.to, body.amount);
    persistRuntimeState(runtime, client);
    const entry = ledger.recordSuccess(requestId, { signature: result.signature });
    ledger.emit({
      id: `${requestId}-event`,
      service: SERVICE,
      event: "seize.succeeded",
      requestId,
      signature: result.signature,
      createdAt: new Date().toISOString(),
    });
    sendJson(res, 200, { ok: true, entry, result });
  } catch (error) {
    const failure = ledger.recordFailure({
      requestId,
      action: "seize",
      from: body.from,
      to: body.to,
      amount: String(body.amount),
      error: error?.message ?? String(error),
      failedAt: new Date().toISOString(),
    });
    sendJson(res, 500, { ok: false, failure });
  }
}

async function handleBlacklisted(_req, res) {
  const client = await createChainClient(runtime);
  sendJson(res, 200, { ok: true, items: await client.listBlacklisted() });
}

async function handleAudit(_req, res) {
  sendJson(res, 200, {
    ok: true,
    items: ledger.requests.read(),
    failures: ledger.failures.read(),
  });
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
