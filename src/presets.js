export const Presets = Object.freeze({
  SSS_1: "sss-1",
  SSS_2: "sss-2",
});

const BASE_EXTENSION_FLAGS = Object.freeze({
  permanentDelegate: false,
  transferHook: false,
  defaultAccountFrozen: false,
});

export function normalizePreset(value) {
  const normalized = String(value || "").toLowerCase().trim();
  if (normalized === Presets.SSS_1 || normalized === Presets.SSS_2) {
    return normalized;
  }
  throw new Error(`Unknown preset: ${value}`);
}

export function presetConfig(preset) {
  const normalized = normalizePreset(preset);
  switch (normalized) {
    case Presets.SSS_1:
      return {
        preset: Presets.SSS_1,
        extensions: { ...BASE_EXTENSION_FLAGS },
        roles: ["master", "minter", "burner", "pauser"],
      };
    case Presets.SSS_2:
      return {
        preset: Presets.SSS_2,
        extensions: {
          ...BASE_EXTENSION_FLAGS,
          permanentDelegate: true,
          transferHook: true,
        },
        roles: ["master", "minter", "burner", "pauser", "blacklister", "seizer"],
      };
    default:
      throw new Error(`Unknown preset: ${preset}`);
  }
}

export function mergeCustomConfig(base, custom = {}) {
  return {
    ...base,
    ...custom,
    extensions: {
      ...base.extensions,
      ...(custom.extensions ?? {}),
    },
    roles: custom.roles ?? base.roles,
  };
}
