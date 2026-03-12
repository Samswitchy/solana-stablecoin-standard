import { Presets, mergeCustomConfig, presetConfig } from "./presets.js";

function ensureRequired(config) {
  for (const key of ["name", "symbol", "decimals", "authority"]) {
    if (config[key] === undefined || config[key] === null || config[key] === "") {
      throw new Error(`Missing required config field: ${key}`);
    }
  }
}

function amountToBigInt(value) {
  const amount = BigInt(value);
  if (amount <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }
  return amount;
}

export class SolanaStablecoin {
  constructor(connection, config) {
    this.connection = connection;
    this.config = config;
    this.auditLog = [];
    this.paused = false;
    this.totalSupply = 0n;
    this.balances = new Map();
    this.frozenAccounts = new Set();
    this.blacklist = new Map();
    this.minterQuotas = new Map();
  }

  static async create(connection, options) {
    let base = { preset: "custom", extensions: {}, roles: [] };
    if (options.preset) {
      base = presetConfig(options.preset);
    }
    const finalConfig = mergeCustomConfig(base, options);
    ensureRequired(finalConfig);
    return new SolanaStablecoin(connection, finalConfig);
  }

  log(action, payload) {
    this.auditLog.push({ action, payload, timestamp: new Date().toISOString() });
  }

  assertNotPaused() {
    if (this.paused) {
      throw new Error("Token operations are paused.");
    }
  }

  assertNotBlacklisted(address) {
    if (this.blacklist.has(address)) {
      throw new Error(`Address is blacklisted: ${address}`);
    }
  }

  getBalance(address) {
    return this.balances.get(address) ?? 0n;
  }

  setMinterQuota(minter, quota) {
    const max = BigInt(quota);
    if (max <= 0n) {
      throw new Error("Quota must be greater than zero.");
    }
    const existing = this.minterQuotas.get(minter);
    this.minterQuotas.set(minter, { max, used: existing?.used ?? 0n });
    this.log("set_minter_quota", { minter, quota: max.toString() });
    return { ok: true, minter, quota: max.toString() };
  }

  removeMinterQuota(minter) {
    const existed = this.minterQuotas.delete(minter);
    this.log("remove_minter_quota", { minter, existed });
    return { ok: true, minter, existed };
  }

  listMinters() {
    return [...this.minterQuotas.entries()].map(([minter, q]) => ({
      minter,
      max: q.max.toString(),
      used: q.used.toString(),
      remaining: (q.max - q.used).toString(),
    }));
  }

  listHolders(minBalance = 0) {
    const minimum = BigInt(minBalance);
    return [...this.balances.entries()]
      .filter(([, amount]) => amount >= minimum)
      .map(([holder, balance]) => ({ holder, balance: balance.toString() }))
      .sort((a, b) => BigInt(b.balance) > BigInt(a.balance) ? 1 : -1);
  }

  getAuditLog(action) {
    if (!action) return this.auditLog;
    return this.auditLog.filter((item) => item.action === action);
  }

  async mint({ recipient, amount, minter }) {
    this.assertNotPaused();
    this.assertNotBlacklisted(recipient);
    const mintAmount = amountToBigInt(amount);
    if (minter && this.minterQuotas.has(minter)) {
      const quota = this.minterQuotas.get(minter);
      if (quota.used + mintAmount > quota.max) {
        throw new Error(`Minter quota exceeded for ${minter}`);
      }
      quota.used += mintAmount;
      this.minterQuotas.set(minter, quota);
    }
    const next = this.getBalance(recipient) + mintAmount;
    this.balances.set(recipient, next);
    this.totalSupply += mintAmount;
    this.log("mint", { recipient, amount: mintAmount.toString(), minter });
    return { ok: true, txKind: "mint", recipient, amount: mintAmount.toString() };
  }

  async burn({ holder, amount, burner }) {
    this.assertNotPaused();
    const burnAmount = amountToBigInt(amount);
    const bal = this.getBalance(holder);
    if (bal < burnAmount) {
      throw new Error("Insufficient balance for burn.");
    }
    this.balances.set(holder, bal - burnAmount);
    this.totalSupply -= burnAmount;
    this.log("burn", { holder, amount: burnAmount.toString(), burner });
    return { ok: true, txKind: "burn", amount: burnAmount.toString() };
  }

  async transfer({ from, to, amount }) {
    this.assertNotPaused();
    if (this.frozenAccounts.has(from)) throw new Error(`Source account is frozen: ${from}`);
    if (this.frozenAccounts.has(to)) throw new Error(`Destination account is frozen: ${to}`);
    this.assertNotBlacklisted(from);
    this.assertNotBlacklisted(to);

    const transferAmount = amountToBigInt(amount);
    const fromBal = this.getBalance(from);
    if (fromBal < transferAmount) {
      throw new Error("Insufficient balance for transfer.");
    }
    this.balances.set(from, fromBal - transferAmount);
    this.balances.set(to, this.getBalance(to) + transferAmount);
    this.log("transfer", { from, to, amount: transferAmount.toString() });
    return { ok: true, txKind: "transfer", from, to, amount: transferAmount.toString() };
  }

  async freezeAccount({ address, authority }) {
    this.frozenAccounts.add(address);
    this.log("freeze", { address, authority });
    return { ok: true, txKind: "freeze", address };
  }

  async thawAccount({ address, authority }) {
    this.frozenAccounts.delete(address);
    this.log("thaw", { address, authority });
    return { ok: true, txKind: "thaw", address };
  }

  async pause({ authority }) {
    this.paused = true;
    this.log("pause", { authority });
    return { ok: true, txKind: "pause" };
  }

  async unpause({ authority }) {
    this.paused = false;
    this.log("unpause", { authority });
    return { ok: true, txKind: "unpause" };
  }

  async getTotalSupply() {
    return this.totalSupply.toString();
  }

  get compliance() {
    if (this.config.preset !== Presets.SSS_2 && !this.config.extensions.transferHook) {
      throw new Error("Compliance module is not enabled for this stablecoin instance.");
    }

    return {
      blacklistAdd: async (address, reason) => {
        this.blacklist.set(address, reason ?? "unspecified");
        this.log("blacklist_add", { address, reason });
        return { ok: true, address, reason };
      },
      blacklistRemove: async (address) => {
        this.blacklist.delete(address);
        this.log("blacklist_remove", { address });
        return { ok: true, address };
      },
      seize: async (from, to, amount) => {
        const seizeAmount = amountToBigInt(amount);
        const sourceBal = this.getBalance(from);
        if (sourceBal < seizeAmount) {
          throw new Error("Insufficient balance to seize.");
        }
        this.balances.set(from, sourceBal - seizeAmount);
        this.balances.set(to, this.getBalance(to) + seizeAmount);
        this.log("seize", { from, to, amount: seizeAmount.toString() });
        return { ok: true, from, to, amount: seizeAmount.toString() };
      },
    };
  }
}
