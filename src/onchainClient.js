import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import anchorPkg from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  AccountState,
  AuthorityType,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeDefaultAccountStateInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMint2Instruction,
  createInitializePermanentDelegateInstruction,
  createInitializeTransferHookInstruction,
  createSetAuthorityInstruction,
  createTransferCheckedWithTransferHookInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getMintLen,
  getOrCreateAssociatedTokenAccount,
  tokenMetadataInitializeWithRentTransfer,
  unpackAccount,
} from "@solana/spl-token";
import { pack } from "@solana/spl-token-metadata";
import { DEFAULT_PROGRAM_IDS, loadIdl } from "./anchorArtifacts.js";
import { KeypairWallet } from "./keypair.js";
import { Presets, mergeCustomConfig, presetConfig } from "./presets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { AnchorProvider, BN, Program } = anchorPkg;

function ensureRequired(config) {
  for (const key of ["name", "symbol", "decimals", "authority"]) {
    if (config[key] === undefined || config[key] === null || config[key] === "") {
      throw new Error(`Missing required config field: ${key}`);
    }
  }
}

function toPublicKey(value, fieldName = "public key") {
  if (value instanceof PublicKey) return value;
  if (value instanceof Keypair) return value.publicKey;
  if (typeof value === "string") return new PublicKey(value);
  throw new Error(`Invalid ${fieldName}`);
}

function toSigner(value, fallback) {
  if (!value) return fallback;
  if (value instanceof Keypair) return value;
  if (value?.payer instanceof Keypair) return value.payer;
  throw new Error("Expected a Keypair signer.");
}

function amountToBn(value) {
  const amount = BigInt(value);
  if (amount <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }
  return new BN(amount.toString());
}

function maybeClusterUrl(value) {
  if (!value) return clusterApiUrl("devnet");
  if (value === "devnet" || value === "testnet" || value === "mainnet-beta") {
    return clusterApiUrl(value);
  }
  return value;
}

function metadataTemplate({ authority, mint, name, symbol, uri }) {
  return {
    updateAuthority: authority,
    mint,
    name,
    symbol,
    uri,
    additionalMetadata: [],
  };
}

function idlWithAddress(name, address) {
  const idl = loadIdl(name);
  return {
    ...idl,
    address: address.toBase58(),
  };
}

function deriveConfigPda(mint, stablecoinProgramId) {
  return PublicKey.findProgramAddressSync([Buffer.from("config"), mint.toBuffer()], stablecoinProgramId);
}

function deriveHookConfigPda(mint, hookProgramId) {
  return PublicKey.findProgramAddressSync([Buffer.from("hook-config"), mint.toBuffer()], hookProgramId);
}

function deriveMinterQuotaPda(config, minter, stablecoinProgramId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("minter"), config.toBuffer(), minter.toBuffer()],
    stablecoinProgramId
  );
}

function deriveBlacklistPda(config, wallet, stablecoinProgramId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("blacklist"), config.toBuffer(), wallet.toBuffer()],
    stablecoinProgramId
  );
}

function deriveHookBlacklistPda(config, wallet, hookProgramId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("hook-blacklist"), config.toBuffer(), wallet.toBuffer()],
    hookProgramId
  );
}

function buildConfig(options, authority) {
  let base = { preset: "custom", extensions: {}, roles: [] };
  if (options.preset) {
    base = presetConfig(options.preset);
  }
  const merged = mergeCustomConfig(base, options);
  merged.authority = authority.publicKey.toBase58();
  ensureRequired(merged);
  return merged;
}

export class OnchainSolanaStablecoin {
  constructor({ connection, authority, config, addresses, provider, programs, rpcUrl }) {
    this.connection = connection;
    this.authority = authority;
    this.config = config;
    this.addresses = addresses;
    this.provider = provider;
    this.programs = programs;
    this.rpcUrl = rpcUrl;
  }

  static async create(connection, options) {
    const authority = toSigner(options.authority);
    const rpcUrl = connection?.rpcEndpoint ?? maybeClusterUrl(options.rpcUrl);
    const stablecoinProgramId = toPublicKey(
      options.programIds?.stablecoinCore ?? DEFAULT_PROGRAM_IDS.stablecoinCore,
      "stablecoin program id"
    );
    const transferHookProgramId = toPublicKey(
      options.programIds?.transferHook ?? DEFAULT_PROGRAM_IDS.transferHook,
      "transfer hook program id"
    );
    const finalConfig = buildConfig(options, authority);
    const provider = new AnchorProvider(connection, new KeypairWallet(authority), {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    const stablecoinProgram = new Program(idlWithAddress("stablecoin_core", stablecoinProgramId), provider);
    const hookProgram = new Program(idlWithAddress("transfer_hook", transferHookProgramId), provider);
    const mint = Keypair.generate();
    const [configAddress] = deriveConfigPda(mint.publicKey, stablecoinProgramId);
    const [hookConfig] = deriveHookConfigPda(mint.publicKey, transferHookProgramId);

    const extensions = [ExtensionType.MetadataPointer];
    if (finalConfig.extensions?.permanentDelegate) {
      extensions.push(ExtensionType.PermanentDelegate);
    }
    if (finalConfig.extensions?.transferHook) {
      extensions.push(ExtensionType.TransferHook);
    }
    if (finalConfig.extensions?.defaultAccountFrozen) {
      extensions.push(ExtensionType.DefaultAccountState);
    }

    const metadata = metadataTemplate({
      authority: authority.publicKey,
      mint: mint.publicKey,
      name: finalConfig.name,
      symbol: finalConfig.symbol,
      uri: finalConfig.uri ?? "",
    });
    const mintLen = getMintLen(extensions);
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports,
        space: mintLen,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        authority.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );

    if (finalConfig.extensions?.permanentDelegate) {
      createMintTx.add(
        createInitializePermanentDelegateInstruction(
          mint.publicKey,
          configAddress,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }
    if (finalConfig.extensions?.transferHook) {
      createMintTx.add(
        createInitializeTransferHookInstruction(
          mint.publicKey,
          authority.publicKey,
          transferHookProgramId,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }
    if (finalConfig.extensions?.defaultAccountFrozen) {
      createMintTx.add(
        createInitializeDefaultAccountStateInstruction(
          mint.publicKey,
          AccountState.Frozen,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }
    createMintTx.add(
      createInitializeMint2Instruction(
        mint.publicKey,
        finalConfig.decimals,
        authority.publicKey,
        authority.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, createMintTx, [authority, mint], {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    await tokenMetadataInitializeWithRentTransfer(
      connection,
      authority,
      mint.publicKey,
      authority.publicKey,
      authority,
      finalConfig.name,
      finalConfig.symbol,
      finalConfig.uri ?? "",
      [],
      { commitment: "confirmed", preflightCommitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    const authorityTx = new Transaction().add(
      createSetAuthorityInstruction(
        mint.publicKey,
        authority.publicKey,
        AuthorityType.MintTokens,
        configAddress,
        [],
        TOKEN_2022_PROGRAM_ID
      ),
      createSetAuthorityInstruction(
        mint.publicKey,
        authority.publicKey,
        AuthorityType.FreezeAccount,
        configAddress,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, authorityTx, [authority], {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    const roles = {
      master: authority.publicKey,
      mintAuthority: toPublicKey(options.roles?.mintAuthority ?? authority.publicKey, "mint authority"),
      burnerAuthority: toPublicKey(options.roles?.burnerAuthority ?? authority.publicKey, "burner authority"),
      pauserAuthority: toPublicKey(options.roles?.pauserAuthority ?? authority.publicKey, "pauser authority"),
      freezeAuthority: toPublicKey(options.roles?.freezeAuthority ?? authority.publicKey, "freeze authority"),
      blacklisterAuthority: toPublicKey(options.roles?.blacklisterAuthority ?? authority.publicKey, "blacklister authority"),
      seizerAuthority: toPublicKey(options.roles?.seizerAuthority ?? authority.publicKey, "seizer authority"),
    };

    await stablecoinProgram.methods
      .initialize({
        name: finalConfig.name,
        symbol: finalConfig.symbol,
        uri: finalConfig.uri ?? "",
        decimals: finalConfig.decimals,
        enablePermanentDelegate: Boolean(finalConfig.extensions?.permanentDelegate),
        enableTransferHook: Boolean(finalConfig.extensions?.transferHook),
        defaultAccountFrozen: Boolean(finalConfig.extensions?.defaultAccountFrozen),
        masterAuthority: roles.master,
        mintAuthority: roles.mintAuthority,
        burnerAuthority: roles.burnerAuthority,
        pauserAuthority: roles.pauserAuthority,
        freezeAuthority: roles.freezeAuthority,
        blacklisterAuthority: roles.blacklisterAuthority,
        seizerAuthority: roles.seizerAuthority,
      })
      .accounts({
        payer: authority.publicKey,
        masterAuthority: authority.publicKey,
        mint: mint.publicKey,
        config: configAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    if (finalConfig.extensions?.transferHook) {
      await hookProgram.methods
        .initialize({
          label: `${finalConfig.symbol}-hook`,
          enforceBlacklist: true,
        })
        .accounts({
          payer: authority.publicKey,
          authority: authority.publicKey,
          mint: mint.publicKey,
          config: hookConfig,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    }

    return new OnchainSolanaStablecoin({
      connection,
      authority,
      config: finalConfig,
      addresses: {
        mint: mint.publicKey,
        config: configAddress,
        hookConfig: finalConfig.extensions?.transferHook ? hookConfig : null,
      },
      provider,
      programs: {
        stablecoin: stablecoinProgram,
        hook: hookProgram,
        stablecoinProgramId,
        transferHookProgramId,
      },
      rpcUrl,
    });
  }

  static async fromDeployment(options) {
    const authority = toSigner(options.authority);
    const rpcUrl = maybeClusterUrl(options.rpcUrl);
    const connection = options.connection ?? new Connection(rpcUrl, "confirmed");
    const provider = new AnchorProvider(connection, new KeypairWallet(authority), {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    const stablecoinProgramId = toPublicKey(
      options.programIds?.stablecoinCore ?? DEFAULT_PROGRAM_IDS.stablecoinCore,
      "stablecoin program id"
    );
    const transferHookProgramId = toPublicKey(
      options.programIds?.transferHook ?? DEFAULT_PROGRAM_IDS.transferHook,
      "transfer hook program id"
    );
    const stablecoinProgram = new Program(idlWithAddress("stablecoin_core", stablecoinProgramId), provider);
    const hookProgram = new Program(idlWithAddress("transfer_hook", transferHookProgramId), provider);
    return new OnchainSolanaStablecoin({
      connection,
      authority,
      config: options.config ?? {},
      addresses: {
        mint: toPublicKey(options.mint, "mint"),
        config: toPublicKey(options.configAddress, "config"),
        hookConfig: options.hookConfig ? toPublicKey(options.hookConfig, "hook config") : null,
      },
      provider,
      programs: {
        stablecoin: stablecoinProgram,
        hook: hookProgram,
        stablecoinProgramId,
        transferHookProgramId,
      },
      rpcUrl,
    });
  }

  serialize() {
    return {
      mode: "chain",
      rpcUrl: this.rpcUrl,
      mint: this.addresses.mint.toBase58(),
      configAddress: this.addresses.config.toBase58(),
      hookConfig: this.addresses.hookConfig?.toBase58() ?? null,
      programIds: {
        stablecoinCore: this.programs.stablecoinProgramId.toBase58(),
        transferHook: this.programs.transferHookProgramId.toBase58(),
      },
      config: this.config,
    };
  }

  async fetchConfig() {
    return this.programs.stablecoin.account.stablecoinConfig.fetch(this.addresses.config);
  }

  async getTotalSupply() {
    const mint = await getMint(this.connection, this.addresses.mint, "confirmed", TOKEN_2022_PROGRAM_ID);
    return mint.supply.toString();
  }

  async status() {
    const [config, mint, blacklists, holders] = await Promise.all([
      this.fetchConfig(),
      getMint(this.connection, this.addresses.mint, "confirmed", TOKEN_2022_PROGRAM_ID),
      this.listBlacklisted(),
      this.listHolders(0),
    ]);
    return {
      mint: this.addresses.mint.toBase58(),
      config: this.addresses.config.toBase58(),
      paused: config.paused,
      totalSupply: mint.supply.toString(),
      blacklistSize: blacklists.length,
      frozenSize: holders.filter((holder) => holder.isFrozen).length,
      decimals: mint.decimals,
    };
  }

  async mint({ recipient, amount, minter }) {
    const signer = toSigner(minter, this.authority);
    const owner = toPublicKey(recipient, "recipient");
    const destination = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.authority,
      this.addresses.mint,
      owner,
      true,
      "confirmed",
      { commitment: "confirmed", preflightCommitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );
    const [minterQuota] = deriveMinterQuotaPda(
      this.addresses.config,
      signer.publicKey,
      this.programs.stablecoinProgramId
    );
    const signature = await this.programs.stablecoin.methods
      .mint(amountToBn(amount))
      .accounts({
        minter: signer.publicKey,
        config: this.addresses.config,
        mint: this.addresses.mint,
        destination: destination.address,
        minterQuota,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers(signer.publicKey.equals(this.authority.publicKey) ? [] : [signer])
      .rpc();
    return { ok: true, signature, destination: destination.address.toBase58(), amount: String(amount) };
  }

  async burn({ holder, amount, burner, holderAuthority }) {
    const burnerSigner = toSigner(burner, this.authority);
    const holderSigner = toSigner(holderAuthority, burnerSigner);
    const owner = toPublicKey(holder, "holder");
    const source = getAssociatedTokenAddressSync(this.addresses.mint, owner, true, TOKEN_2022_PROGRAM_ID);
    const signature = await this.programs.stablecoin.methods
      .burn(amountToBn(amount))
      .accounts({
        burner: burnerSigner.publicKey,
        holderAuthority: holderSigner.publicKey,
        config: this.addresses.config,
        mint: this.addresses.mint,
        source,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers(
        [burnerSigner, holderSigner].filter(
          (signer, index, all) =>
            !signer.publicKey.equals(this.authority.publicKey) &&
            all.findIndex((entry) => entry.publicKey.equals(signer.publicKey)) === index
        )
      )
      .rpc();
    return { ok: true, signature, source: source.toBase58(), amount: String(amount) };
  }

  async transfer({ from, to, amount, owner }) {
    const ownerSigner = toSigner(owner, this.authority);
    const fromOwner = toPublicKey(from, "from owner");
    const toOwner = toPublicKey(to, "to owner");
    const source = getAssociatedTokenAddressSync(this.addresses.mint, fromOwner, true, TOKEN_2022_PROGRAM_ID);
    const destination = getAssociatedTokenAddressSync(this.addresses.mint, toOwner, true, TOKEN_2022_PROGRAM_ID);
    const ensureAtaTx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        this.authority.publicKey,
        destination,
        toOwner,
        this.addresses.mint,
        TOKEN_2022_PROGRAM_ID
      )
    );
    await this.provider.sendAndConfirm(ensureAtaTx, []);

    const mint = await getMint(this.connection, this.addresses.mint, "confirmed", TOKEN_2022_PROGRAM_ID);
    const transferIx = mint.tlvData.length > 0 && this.config.extensions?.transferHook
      ? await createTransferCheckedWithTransferHookInstruction(
          this.connection,
          source,
          this.addresses.mint,
          destination,
          ownerSigner.publicKey,
          BigInt(amount),
          mint.decimals,
          [],
          "confirmed",
          TOKEN_2022_PROGRAM_ID
        )
      : createTransferCheckedInstruction(
          source,
          this.addresses.mint,
          destination,
          ownerSigner.publicKey,
          BigInt(amount),
          mint.decimals,
          [],
          TOKEN_2022_PROGRAM_ID
        );
    const tx = new Transaction().add(transferIx);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      ownerSigner.publicKey.equals(this.authority.publicKey) ? [this.authority] : [this.authority, ownerSigner],
      { commitment: "confirmed", preflightCommitment: "confirmed" }
    );
    return { ok: true, signature, source: source.toBase58(), destination: destination.toBase58() };
  }

  async freezeAccount({ address, authority }) {
    const signer = toSigner(authority, this.authority);
    const owner = toPublicKey(address, "freeze target");
    const tokenAccount = getAssociatedTokenAddressSync(
      this.addresses.mint,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    const signature = await this.programs.stablecoin.methods
      .freezeAccount()
      .accounts({
        freezeAuthority: signer.publicKey,
        config: this.addresses.config,
        mint: this.addresses.mint,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers(signer.publicKey.equals(this.authority.publicKey) ? [] : [signer])
      .rpc();
    return { ok: true, signature, tokenAccount: tokenAccount.toBase58() };
  }

  async thawAccount({ address, authority }) {
    const signer = toSigner(authority, this.authority);
    const owner = toPublicKey(address, "thaw target");
    const tokenAccount = getAssociatedTokenAddressSync(
      this.addresses.mint,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    const signature = await this.programs.stablecoin.methods
      .thawAccount()
      .accounts({
        freezeAuthority: signer.publicKey,
        config: this.addresses.config,
        mint: this.addresses.mint,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers(signer.publicKey.equals(this.authority.publicKey) ? [] : [signer])
      .rpc();
    return { ok: true, signature, tokenAccount: tokenAccount.toBase58() };
  }

  async pause({ authority }) {
    const signer = toSigner(authority, this.authority);
    const signature = await this.programs.stablecoin.methods
      .pause()
      .accounts({
        pauser: signer.publicKey,
        config: this.addresses.config,
      })
      .signers(signer.publicKey.equals(this.authority.publicKey) ? [] : [signer])
      .rpc();
    return { ok: true, signature };
  }

  async unpause({ authority }) {
    const signer = toSigner(authority, this.authority);
    const signature = await this.programs.stablecoin.methods
      .unpause()
      .accounts({
        pauser: signer.publicKey,
        config: this.addresses.config,
      })
      .signers(signer.publicKey.equals(this.authority.publicKey) ? [] : [signer])
      .rpc();
    return { ok: true, signature };
  }

  async setMinterQuota(minter, quota, authority) {
    const signer = toSigner(authority, this.authority);
    const minterKey = toPublicKey(minter, "minter");
    const [minterQuota] = deriveMinterQuotaPda(
      this.addresses.config,
      minterKey,
      this.programs.stablecoinProgramId
    );
    const signature = await this.programs.stablecoin.methods
      .setMinterQuota(amountToBn(quota))
      .accounts({
        payer: this.authority.publicKey,
        authority: signer.publicKey,
        config: this.addresses.config,
        minter: minterKey,
        minterQuota,
        systemProgram: SystemProgram.programId,
      })
      .signers(signer.publicKey.equals(this.authority.publicKey) ? [] : [signer])
      .rpc();
    return { ok: true, signature, minter: minterKey.toBase58(), quota: String(quota) };
  }

  async removeMinterQuota(minter, authority) {
    const signer = toSigner(authority, this.authority);
    const minterKey = toPublicKey(minter, "minter");
    const [minterQuota] = deriveMinterQuotaPda(
      this.addresses.config,
      minterKey,
      this.programs.stablecoinProgramId
    );
    const signature = await this.programs.stablecoin.methods
      .removeMinterQuota()
      .accounts({
        authority: signer.publicKey,
        config: this.addresses.config,
        receiver: this.authority.publicKey,
        minterQuota,
      })
      .signers(signer.publicKey.equals(this.authority.publicKey) ? [] : [signer])
      .rpc();
    return { ok: true, signature, minter: minterKey.toBase58() };
  }

  async listMinters() {
    const accounts = await this.programs.stablecoin.account.minterQuota.all([
      { memcmp: { offset: 9, bytes: this.addresses.config.toBase58() } },
    ]);
    return accounts.map(({ account }) => ({
      minter: account.minter.toBase58(),
      max: account.maxAllowance.toString(),
      used: account.mintedAmount.toString(),
      remaining: (BigInt(account.maxAllowance.toString()) - BigInt(account.mintedAmount.toString())).toString(),
    }));
  }

  async listBlacklisted() {
    const accounts = await this.programs.stablecoin.account.blacklistEntry.all([
      { memcmp: { offset: 9, bytes: this.addresses.config.toBase58() } },
    ]);
    return accounts.map(({ publicKey, account }) => ({
      publicKey: publicKey.toBase58(),
      wallet: account.wallet.toBase58(),
      reason: account.reason,
    }));
  }

  async listHolders(minBalance = 0) {
    const min = BigInt(minBalance);
    const accounts = await this.connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
      filters: [{ memcmp: { offset: 0, bytes: this.addresses.mint.toBase58() } }],
    });
    return accounts
      .map(({ pubkey, account }) => {
        const parsed = unpackAccount(pubkey, account, TOKEN_2022_PROGRAM_ID);
        return {
          tokenAccount: pubkey.toBase58(),
          holder: parsed.owner.toBase58(),
          balance: parsed.amount.toString(),
          isFrozen: parsed.isFrozen,
        };
      })
      .filter((holder) => BigInt(holder.balance) >= min)
      .sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
  }

  async getAuditLog(action) {
    const signatures = await this.connection.getSignaturesForAddress(this.addresses.config, { limit: 50 });
    const items = [];
    for (const entry of signatures) {
      const tx = await this.connection.getTransaction(entry.signature, { maxSupportedTransactionVersion: 0 });
      const logs = tx?.meta?.logMessages ?? [];
      const matchedAction = action
        ? logs.some((line) => line.toLowerCase().includes(action.toLowerCase()))
        : true;
      if (!matchedAction) continue;
      items.push({
        signature: entry.signature,
        slot: entry.slot,
        err: entry.err,
        logs,
      });
    }
    return items;
  }

  get compliance() {
    const enabled = this.config.preset === Presets.SSS_2 || this.config.extensions?.transferHook;
    if (!enabled) {
      throw new Error("Compliance module is not enabled for this stablecoin instance.");
    }
    return {
      blacklistAdd: async (address, reason = "unspecified", authority) => {
        const signer = toSigner(authority, this.authority);
        const wallet = toPublicKey(address, "blacklist wallet");
        const [blacklistEntry] = deriveBlacklistPda(
          this.addresses.config,
          wallet,
          this.programs.stablecoinProgramId
        );
        const signature = await this.programs.stablecoin.methods
          .addToBlacklist(reason)
          .accounts({
            payer: this.authority.publicKey,
            blacklister: signer.publicKey,
            config: this.addresses.config,
            wallet,
            blacklistEntry,
            systemProgram: SystemProgram.programId,
          })
          .signers(signer.publicKey.equals(this.authority.publicKey) ? [] : [signer])
          .rpc();

        if (this.addresses.hookConfig) {
          const [hookBlacklist] = deriveHookBlacklistPda(
            this.addresses.hookConfig,
            wallet,
            this.programs.transferHookProgramId
          );
          await this.programs.hook.methods
            .addToBlacklist(reason)
            .accounts({
              payer: this.authority.publicKey,
              authority: this.authority.publicKey,
              config: this.addresses.hookConfig,
              wallet,
              blacklistEntry: hookBlacklist,
              systemProgram: SystemProgram.programId,
            })
            .signers([])
            .rpc();
        }

        return { ok: true, signature, address: wallet.toBase58(), reason };
      },
      blacklistRemove: async (address, authority) => {
        const signer = toSigner(authority, this.authority);
        const wallet = toPublicKey(address, "blacklist wallet");
        const [blacklistEntry] = deriveBlacklistPda(
          this.addresses.config,
          wallet,
          this.programs.stablecoinProgramId
        );
        const signature = await this.programs.stablecoin.methods
          .removeFromBlacklist()
          .accounts({
            blacklister: signer.publicKey,
            config: this.addresses.config,
            receiver: this.authority.publicKey,
            blacklistEntry,
          })
          .signers(signer.publicKey.equals(this.authority.publicKey) ? [] : [signer])
          .rpc();

        if (this.addresses.hookConfig) {
          const [hookBlacklist] = deriveHookBlacklistPda(
            this.addresses.hookConfig,
            wallet,
            this.programs.transferHookProgramId
          );
          await this.programs.hook.methods
            .removeFromBlacklist()
            .accounts({
              authority: this.authority.publicKey,
              config: this.addresses.hookConfig,
              receiver: this.authority.publicKey,
              blacklistEntry: hookBlacklist,
            })
            .signers([])
            .rpc();
        }

        return { ok: true, signature, address: wallet.toBase58() };
      },
      seize: async (from, to, amount, authority) => {
        const signer = toSigner(authority, this.authority);
        const fromOwner = toPublicKey(from, "seize source owner");
        const toOwner = toPublicKey(to, "seize destination owner");
        const source = getAssociatedTokenAddressSync(
          this.addresses.mint,
          fromOwner,
          true,
          TOKEN_2022_PROGRAM_ID
        );
        const destination = await getOrCreateAssociatedTokenAccount(
          this.connection,
          this.authority,
          this.addresses.mint,
          toOwner,
          true,
          "confirmed",
          { commitment: "confirmed", preflightCommitment: "confirmed" },
          TOKEN_2022_PROGRAM_ID
        );
        const [blacklistEntry] = deriveBlacklistPda(
          this.addresses.config,
          fromOwner,
          this.programs.stablecoinProgramId
        );
        const signature = await this.programs.stablecoin.methods
          .seize(amountToBn(amount))
          .accounts({
            seizer: signer.publicKey,
            config: this.addresses.config,
            mint: this.addresses.mint,
            source,
            destination: destination.address,
            blacklistedOwner: fromOwner,
            blacklistEntry,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers(signer.publicKey.equals(this.authority.publicKey) ? [] : [signer])
          .rpc();
        return {
          ok: true,
          signature,
          from: fromOwner.toBase58(),
          to: destination.address.toBase58(),
          amount: String(amount),
        };
      },
    };
  }
}
