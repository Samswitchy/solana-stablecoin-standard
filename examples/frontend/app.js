const state = {
  activeTab: "sdk",
  snapshot: null,
};

const presetNotes = {
  "sss-1": [
    {
      title: "Minimal issue surface",
      body: "Mint, burn, freeze, thaw, pause, and metadata only. This is the leanest route for internal settlement or treasury usage.",
    },
    {
      title: "Reactive compliance only",
      body: "No hook-enforced blacklist. Operators rely on freeze and thaw when intervention is needed.",
    },
  ],
  "sss-2": [
    {
      title: "Hook-enforced blacklist",
      body: "Transfers from or to blacklisted wallets fail at the Token-2022 hook layer, not just in off-chain policy.",
    },
    {
      title: "Permanent-delegate seizure path",
      body: "Admin seizure remains available for regulated issuer workflows while standard blacklisted user transfers stay blocked.",
    },
  ],
};

const form = document.querySelector("#profileForm");
const snippetOutput = document.querySelector("#snippetOutput");
const presetBadge = document.querySelector("#presetBadge");
const supplyLabel = document.querySelector("#supplyLabel");
const mintLabel = document.querySelector("#mintLabel");
const blacklistLabel = document.querySelector("#blacklistLabel");
const presetCallouts = document.querySelector("#presetCallouts");
const serviceLog = document.querySelector("#serviceLog");
const statusList = document.querySelector("#statusList");
const holdersList = document.querySelector("#holdersList");
const blacklistList = document.querySelector("#blacklistList");
const auditList = document.querySelector("#auditList");
const servicesState = document.querySelector("#servicesState");
const operatorAuthority = document.querySelector("#operatorAuthority");

function currentConfig() {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function formatPresetLabel(value) {
  return value.toUpperCase();
}

function renderCallouts(config) {
  presetCallouts.innerHTML = "";
  for (const note of presetNotes[config.preset] ?? []) {
    const div = document.createElement("div");
    div.className = "callout";
    div.innerHTML = `<strong>${note.title}</strong><span>${note.body}</span>`;
    presetCallouts.appendChild(div);
  }
}

function sdkSnippet(config) {
  const presetLabel = config.preset === "sss-1" ? "Presets.SSS_1" : "Presets.SSS_2";
  return `import { Connection, Keypair } from "@solana/web3.js";
import { OnchainSolanaStablecoin, Presets } from "solana-stablecoin-standard";

const connection = new Connection("${config.rpcUrl}", "confirmed");
const authority = Keypair.fromSecretKey(/* load secret key */);

const stable = await OnchainSolanaStablecoin.create(connection, {
  preset: ${presetLabel},
  name: "${config.name}",
  symbol: "${config.symbol}",
  decimals: ${config.decimals},
  authority,
});

await stable.setMinterQuota(authority.publicKey, 1_000_000);
await stable.mint({ recipient: authority.publicKey, amount: 500_000 });
const status = await stable.status();
console.log(status);`;
}

function cliSnippet(config) {
  return `./bin/sss-token.js init --preset ${config.preset} \\
  --rpc-url ${config.rpcUrl} \\
  --keypair ${config.keypairPath} \\
  --state ${config.statePath}

./bin/sss-token.js minters add <AUTHORITY_PUBKEY> 1000000 \\
  --rpc-url ${config.rpcUrl} \\
  --keypair ${config.keypairPath} \\
  --state ${config.statePath}

./bin/sss-token.js mint <AUTHORITY_PUBKEY> 500000 \\
  --rpc-url ${config.rpcUrl} \\
  --keypair ${config.keypairPath} \\
  --state ${config.statePath}`;
}

function servicesSnippet() {
  return `docker compose up --build

# mint / burn
curl -X POST http://127.0.0.1:8081/mint \\
  -H "content-type: application/json" \\
  -d '{"recipient":"<wallet>","amount":500000}'

# compliance
curl -X POST http://127.0.0.1:8082/blacklist/add \\
  -H "content-type: application/json" \\
  -d '{"address":"<wallet>","reason":"watchlist"}'

# indexer
curl -X POST http://127.0.0.1:8083/poll

# webhook
curl -X POST http://127.0.0.1:8084/subscriptions \\
  -H "content-type: application/json" \\
  -d '{"url":"https://example.com/hook","events":["indexer.snapshot.updated"]}'`;
}

function updateSnippet() {
  const config = currentConfig();
  const source =
    state.activeTab === "sdk"
      ? sdkSnippet(config)
      : state.activeTab === "cli"
        ? cliSnippet(config)
        : servicesSnippet(config);
  snippetOutput.textContent = source;
  presetBadge.textContent = formatPresetLabel(config.preset);
  renderCallouts(config);
}

async function copySnippet() {
  await navigator.clipboard.writeText(snippetOutput.textContent);
  const button = document.querySelector("#copySnippet");
  const original = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

function getBaseUrl(key) {
  if (key === "mint") return document.querySelector("#mintBurnUrl").value.replace(/\/$/, "");
  if (key === "burn") return document.querySelector("#mintBurnUrl").value.replace(/\/$/, "");
  if (key === "blacklist-add") return document.querySelector("#complianceUrl").value.replace(/\/$/, "");
  if (key === "seize") return document.querySelector("#complianceUrl").value.replace(/\/$/, "");
  return "";
}

function actionPath(key) {
  if (key === "mint") return "/mint";
  if (key === "burn") return "/burn";
  if (key === "blacklist-add") return "/blacklist/add";
  if (key === "seize") return "/seize";
  return "/";
}

function appendLog(title, payload, isError = false) {
  const header = `${new Date().toLocaleTimeString()} ${title}`;
  const body = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  serviceLog.textContent = `${header}\n${body}\n\n${serviceLog.textContent}`;
  serviceLog.style.borderColor = isError ? "rgba(185, 28, 28, 0.45)" : "rgba(15, 118, 110, 0.25)";
}

function renderKeyValueList(target, values) {
  target.innerHTML = "";
  const entries = Object.entries(values ?? {});
  for (const [key, value] of entries) {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    target.append(dt, dd);
  }
}

function renderListBox(target, items, mapper) {
  target.innerHTML = "";
  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "list-empty";
    empty.textContent = "Nothing to show.";
    target.appendChild(empty);
    return;
  }
  for (const item of items) {
    const entry = document.createElement("div");
    entry.className = "list-item";
    entry.innerHTML = mapper(item);
    target.appendChild(entry);
  }
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data.failure?.error ??
        data.error ??
        data.message ??
        `Request failed with ${response.status}`
    );
  }
  return data;
}

function populateAuthorityFields(authority) {
  if (!authority) return;
  operatorAuthority.textContent = authority;
  document.querySelector('.action-card[data-action="mint"] input[name="recipient"]').value ||= authority;
  document.querySelector('.action-card[data-action="burn"] input[name="holder"]').value ||= authority;
  document.querySelector('.action-card[data-action="blacklist-add"] input[name="address"]').value ||= authority;
  document.querySelector('.action-card[data-action="seize"] input[name="from"]').value ||= authority;
}

async function refreshServicesHealth() {
  const mintBurnBase = document.querySelector("#mintBurnUrl").value.replace(/\/$/, "");
  const complianceBase = document.querySelector("#complianceUrl").value.replace(/\/$/, "");
  const indexerBase = document.querySelector("#indexerUrl").value.replace(/\/$/, "");
  try {
    const [mintBurnHealth] = await Promise.all([
      getJson(`${mintBurnBase}/health`),
      getJson(`${complianceBase}/health`),
      getJson(`${indexerBase}/health`),
    ]);
    populateAuthorityFields(mintBurnHealth.authority);
    servicesState.textContent = "All service endpoints reachable";
    servicesState.classList.add("status-pill-live");
  } catch (error) {
    servicesState.textContent = "One or more service endpoints unavailable";
    appendLog("health check failed", error.message, true);
  }
}

async function refreshSnapshot() {
  const indexerBase = document.querySelector("#indexerUrl").value.replace(/\/$/, "");
  const complianceBase = document.querySelector("#complianceUrl").value.replace(/\/$/, "");
  const [snapshotRes, blacklistRes, auditRes] = await Promise.all([
    getJson(`${indexerBase}/snapshot`),
    getJson(`${complianceBase}/blacklist`),
    getJson(`${complianceBase}/audit`),
  ]);

  state.snapshot = snapshotRes.snapshot;
  const status = state.snapshot?.status ?? {};
  renderKeyValueList(statusList, status);
  renderListBox(
    holdersList,
    state.snapshot?.holders ?? [],
    (holder) =>
      `<strong>${holder.holder}</strong><code>${holder.balance}</code><span>Frozen: ${holder.isFrozen}</span>`
  );
  renderListBox(
    blacklistList,
    blacklistRes.items ?? [],
    (entry) => `<strong>${entry.wallet}</strong><span>${entry.reason}</span>`
  );
  renderListBox(
    auditList,
    auditRes.items ?? [],
    (entry) =>
      `<strong>${entry.action}</strong><span>${entry.createdAt ?? ""}</span><code>${entry.signature ?? ""}</code>`
  );

  mintLabel.textContent = status.mint ?? "Not loaded";
  supplyLabel.textContent = status.totalSupply ?? "0";
  blacklistLabel.textContent = String(status.blacklistSize ?? 0);
}

async function runAction(event) {
  event.preventDefault();
  const formEl = event.currentTarget;
  const action = formEl.dataset.action;
  const payload = Object.fromEntries(new FormData(formEl).entries());
  try {
    const data = await getJson(`${getBaseUrl(action)}${actionPath(action)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    appendLog(`${action} success`, data);
    await refreshSnapshot();
  } catch (error) {
    appendLog(`${action} failed`, error.message, true);
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    state.activeTab = tab.dataset.tab;
    updateSnippet();
  });
});

document.querySelectorAll(".action-card").forEach((card) => {
  card.addEventListener("submit", runAction);
});

form.addEventListener("input", updateSnippet);
document.querySelector("#copySnippet").addEventListener("click", copySnippet);
document.querySelector("#pollSnapshot").addEventListener("click", async () => {
  try {
    const indexerBase = document.querySelector("#indexerUrl").value.replace(/\/$/, "");
    await getJson(`${indexerBase}/poll`, { method: "POST" });
    await refreshSnapshot();
    appendLog("indexer poll", "Snapshot refreshed.");
  } catch (error) {
    appendLog("indexer poll failed", error.message, true);
  }
});
document.querySelector("#refreshAll").addEventListener("click", async () => {
  await refreshServicesHealth();
  try {
    await refreshSnapshot();
  } catch (error) {
    appendLog("refresh failed", error.message, true);
  }
});

updateSnippet();
refreshServicesHealth();
