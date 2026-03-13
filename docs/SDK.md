# SDK

## Imports

```js
import { OnchainSolanaStablecoin, Presets, SolanaStablecoin } from "solana-stablecoin-standard";
```

## Preset Initialization

```js
const stable = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_2,
  name: "My Stable",
  symbol: "MUSD",
  decimals: 6,
  authority: "admin",
});
```

## Custom Configuration

```js
const custom = await SolanaStablecoin.create(connection, {
  name: "Custom",
  symbol: "CUSD",
  decimals: 6,
  authority: "admin",
  extensions: {
    permanentDelegate: true,
    transferHook: false,
  },
});
```

## Core Operations

```js
await stable.setMinterQuota("desk-1", 10_000_000);
await stable.mint({ recipient: "alice", amount: 1_000_000, minter: "desk-1" });
await stable.transfer({ from: "alice", to: "bob", amount: 200_000 });
await stable.burn({ holder: "bob", amount: 100_000, burner: "ops" });
```

## On-Chain Initialization

```js
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection("http://127.0.0.1:8899", "confirmed");
const authority = Keypair.fromSecretKey(...);

const stable = await OnchainSolanaStablecoin.create(connection, {
  preset: Presets.SSS_2,
  name: "Local Stablecoin",
  symbol: "LUSD",
  decimals: 6,
  authority,
});

await stable.setMinterQuota(authority.publicKey, 1_000_000);
await stable.mint({ recipient: authority.publicKey, amount: 500_000 });
const status = await stable.status();
```

## Control Operations

- `freezeAccount({ address, authority })`
- `thawAccount({ address, authority })`
- `pause({ authority })`
- `unpause({ authority })`

## Compliance Operations (SSS-2)

- `compliance.blacklistAdd(address, reason)`
- `compliance.blacklistRemove(address)`
- `compliance.seize(from, to, amount)`

Compliance operations fail with explicit errors when the compliance module is disabled.


## Operator Views

- `listMinters()` for quota tracking
- `listHolders(minBalance)` for holder snapshots
- `getAuditLog(action?)` for action-specific audit trails

## Current On-Chain Status

The transfer-hook program is deployed and initialized, and localnet proof now covers both blacklist-enforced transfer blocking and admin seizure through the permanent-delegate path.
