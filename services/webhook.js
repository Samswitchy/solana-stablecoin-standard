import {
  createStore,
  readJsonBody,
  resolveRuntimeConfig,
  sendJson,
  startService,
} from "./common.js";

const SERVICE = "webhook";
const runtime = resolveRuntimeConfig(SERVICE);
const subscriptions = createStore("webhook-subscriptions", []);
const deliveries = createStore("webhook-deliveries", []);

async function health() {
  return {
    ok: true,
    service: SERVICE,
    port: runtime.port,
    subscriptions: subscriptions.read().length,
    deliveries: deliveries.read().length,
  };
}

async function deliver(subscription, event, payload) {
  const maxAttempts = Number(process.env.SSS_WEBHOOK_RETRIES ?? 3);
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(subscription.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event, payload }),
      });
      const result = {
        subscription: subscription.url,
        event,
        status: response.status,
        attempt,
        deliveredAt: new Date().toISOString(),
      };
      deliveries.update((items) => [...items, result]);
      return result;
    } catch (error) {
      lastError = error;
    }
  }
  const failed = {
    subscription: subscription.url,
    event,
    error: lastError?.message ?? "delivery_failed",
    deliveredAt: new Date().toISOString(),
  };
  deliveries.update((items) => [...items, failed]);
  return failed;
}

async function handleSubscribe(req, res) {
  const body = await readJsonBody(req);
  const entry = {
    id: `${Date.now()}-${subscriptions.read().length + 1}`,
    url: body.url,
    events: body.events ?? ["*"],
    createdAt: new Date().toISOString(),
  };
  subscriptions.update((items) => [...items, entry]);
  sendJson(res, 200, { ok: true, subscription: entry });
}

async function handleSubscriptions(_req, res) {
  sendJson(res, 200, { ok: true, items: subscriptions.read() });
}

async function handleDispatch(req, res) {
  const body = await readJsonBody(req);
  const active = subscriptions
    .read()
    .filter((subscription) => subscription.events.includes("*") || subscription.events.includes(body.event));
  const results = [];
  for (const subscription of active) {
    results.push(await deliver(subscription, body.event, body.payload));
  }
  sendJson(res, 200, { ok: true, results });
}

async function handleDeliveries(_req, res) {
  sendJson(res, 200, { ok: true, items: deliveries.read() });
}

await startService(
  SERVICE,
  {
    "POST /subscriptions": handleSubscribe,
    "GET /subscriptions": handleSubscriptions,
    "POST /dispatch": handleDispatch,
    "GET /deliveries": handleDeliveries,
  },
  health
);
