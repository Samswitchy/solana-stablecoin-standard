import fs from "node:fs";
import { Keypair } from "@solana/web3.js";

export function loadKeypairFromFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export class KeypairWallet {
  constructor(payer) {
    this.payer = payer;
    this.publicKey = payer.publicKey;
  }

  async signTransaction(tx) {
    tx.partialSign(this.payer);
    return tx;
  }

  async signAllTransactions(txs) {
    return txs.map((tx) => {
      tx.partialSign(this.payer);
      return tx;
    });
  }
}
