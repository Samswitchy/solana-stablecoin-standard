# SDK

## Imports

```js
import { SolanaStablecoin, Presets } from "solana-stablecoin-standard";
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
