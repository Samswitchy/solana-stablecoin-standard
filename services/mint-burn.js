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

const SERVICE = "mint-burn";
const ledger = createOperationLedger(SERVICE);
const runtime = resolveRuntimeConfig(SERVICE);

async function health() {
  return {
    ok: true,
    service: SERVICE,
    rpcUrl: runtime.rpcUrl,
    statePath: runtime.statePath,
    requests: ledger.requests.read().length,
    failures: ledger.failures.read().length,
  };
}

async function handleMint(req, res) {
  const body = await readJsonBody(req);
  const requestId = requestIdFrom(body, "mint");
  const existing = ledger.find(requestId);
  if (existing?.status === "succeeded") {
    sendJson(res, 200, { ok: true, deduped: true, entry: existing });
    return;
  }
  ledger.recordPending({
    requestId,
    action: "mint",
    recipient: body.recipient,
    amount: String(body.amount),
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  const client = await createChainClient(runtime);
  try {
    const result = await client.mint({
      recipient: body.recipient,
      amount: body.amount,
    });
    persistRuntimeState(runtime, client);
    const entry = ledger.recordSuccess(requestId, { signature: result.signature });
    ledger.emit({
      id: `${requestId}-event`,
      service: SERVICE,
      event: "mint.succeeded",
      requestId,
      signature: result.signature,
      createdAt: new Date().toISOString(),
    });
    sendJson(res, 200, { ok: true, entry, result });
  } catch (error) {
    const failure = ledger.recordFailure({
      requestId,
      action: "mint",
      recipient: body.recipient,
      amount: String(body.amount),
      error: error?.message ?? String(error),
      failedAt: new Date().toISOString(),
    });
    sendJson(res, 500, { ok: false, failure });
  }
}

async function handleBurn(req, res) {
  const body = await readJsonBody(req);
  const requestId = requestIdFrom(body, "burn");
  const existing = ledger.find(requestId);
  if (existing?.status === "succeeded") {
    sendJson(res, 200, { ok: true, deduped: true, entry: existing });
    return;
  }
  ledger.recordPending({
    requestId,
    action: "burn",
    holder: body.holder,
    amount: String(body.amount),
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  const client = await createChainClient(runtime);
  try {
    const result = await client.burn({
      holder: body.holder,
      amount: body.amount,
    });
    persistRuntimeState(runtime, client);
    const entry = ledger.recordSuccess(requestId, { signature: result.signature });
    ledger.emit({
      id: `${requestId}-event`,
      service: SERVICE,
      event: "burn.succeeded",
      requestId,
      signature: result.signature,
      createdAt: new Date().toISOString(),
    });
    sendJson(res, 200, { ok: true, entry, result });
  } catch (error) {
    const failure = ledger.recordFailure({
      requestId,
      action: "burn",
      holder: body.holder,
      amount: String(body.amount),
      error: error?.message ?? String(error),
      failedAt: new Date().toISOString(),
    });
    sendJson(res, 500, { ok: false, failure });
  }
}

async function handleRequests(_req, res) {
  sendJson(res, 200, {
    ok: true,
    items: ledger.requests.read(),
    failures: ledger.failures.read(),
  });
}

await startService(
  SERVICE,
  {
    "POST /mint": handleMint,
    "POST /burn": handleBurn,
    "GET /requests": handleRequests,
  },
  health
);
