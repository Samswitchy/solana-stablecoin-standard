import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PROGRAM_IDS = Object.freeze({
  stablecoinCore: "DNU6Zz4eBYdh5gMGppGrGXMjA3atST2dSsiX6XZCF7v1",
  transferHook: "4eY1C8wjyJXTA3zUju9tKmND1netsJw9ViW7uBRCdzGQ",
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

function artifactPath(...segments) {
  return path.join(PROJECT_ROOT, ...segments);
}

export function loadIdl(name) {
  const idlPath = artifactPath("target", "idl", `${name}.json`);
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Run \`anchor build\` first.`);
  }
  return JSON.parse(fs.readFileSync(idlPath, "utf8"));
}

export function hasIdl(name) {
  return fs.existsSync(artifactPath("target", "idl", `${name}.json`));
}

export function resolveProjectPath(...segments) {
  return artifactPath(...segments);
}
