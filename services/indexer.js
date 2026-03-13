import {
  createChainClient,
  createStore,
  log,
  resolveRuntimeConfig,
  sendJson,
  startService,
} from "./common.js";

const SERVICE = "indexer";
const runtime = resolveRuntimeConfig(SERVICE);
const snapshotStore = createStore("indexer-snapshot", {
  polledAt: null,
  status: null,
  holders: [],
  blacklisted: [],
  audit: [],
});

async function pollNow() {
  const client = await createChainClient(runtime);
  const snapshot = {
    polledAt: new Date().toISOString(),
    status: await client.status(),
    holders: await client.listHolders(0),
    blacklisted: await client.listBlacklisted(),
    audit: await client.getAuditLog(),
  };
  snapshotStore.write(snapshot);
  if (process.env.SSS_WEBHOOK_URL) {
    try {
      await fetch(process.env.SSS_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "indexer.snapshot.updated",
          payload: snapshot,
        }),
      });
    } catch (error) {
      log(SERVICE, "error", "webhook_dispatch_failed", {
        error: error?.message ?? String(error),
      });
    }
  }
  return snapshot;
}

const pollIntervalMs = Number(process.env.SSS_INDEXER_INTERVAL_MS ?? 30000);
setInterval(() => {
  pollNow().catch((error) =>
    log(SERVICE, "error", "poll_failed", {
      error: error?.message ?? String(error),
    })
  );
}, pollIntervalMs).unref();

async function health() {
  const snapshot = snapshotStore.read();
  return {
    ok: true,
    service: SERVICE,
    rpcUrl: runtime.rpcUrl,
    lastPollAt: snapshot.polledAt,
    pollIntervalMs,
  };
}

async function handleSnapshot(_req, res) {
  sendJson(res, 200, { ok: true, snapshot: snapshotStore.read() });
}

async function handlePoll(_req, res) {
  sendJson(res, 200, { ok: true, snapshot: await pollNow() });
}

await startService(
  SERVICE,
  {
    "GET /snapshot": handleSnapshot,
    "POST /poll": handlePoll,
  },
  health
);
