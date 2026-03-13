import {
  createChainClient,
  createStore,
  readJsonBody,
  resolveRuntimeConfig,
  sendJson,
  startService,
} from "./common.js";

const SERVICE = "mint-burn";
const requests = createStore("mint-burn-requests", []);
const runtime = resolveRuntimeConfig(SERVICE);

async function health() {
  return {
    ok: true,
    service: SERVICE,
    rpcUrl: runtime.rpcUrl,
    statePath: runtime.statePath,
    requests: requests.read().length,
  };
}

async function handleMint(req, res) {
  const body = await readJsonBody(req);
  const client = await createChainClient(runtime);
  const result = await client.mint({
    recipient: body.recipient,
    amount: body.amount,
  });
  const entry = {
    id: `${Date.now()}-mint`,
    action: "mint",
    recipient: body.recipient,
    amount: String(body.amount),
    signature: result.signature,
    createdAt: new Date().toISOString(),
  };
  requests.update((items) => [...items, entry]);
  sendJson(res, 200, { ok: true, entry, result });
}

async function handleBurn(req, res) {
  const body = await readJsonBody(req);
  const client = await createChainClient(runtime);
  const result = await client.burn({
    holder: body.holder,
    amount: body.amount,
  });
  const entry = {
    id: `${Date.now()}-burn`,
    action: "burn",
    holder: body.holder,
    amount: String(body.amount),
    signature: result.signature,
    createdAt: new Date().toISOString(),
  };
  requests.update((items) => [...items, entry]);
  sendJson(res, 200, { ok: true, entry, result });
}

async function handleRequests(_req, res) {
  sendJson(res, 200, { ok: true, items: requests.read() });
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
