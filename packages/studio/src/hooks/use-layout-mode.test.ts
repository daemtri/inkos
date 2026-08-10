import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT_MODE,
  LAYOUT_MODE_STORAGE_KEY,
  readLayoutMode,
  resolveLayoutMode,
  writeLayoutMode,
} from "./use-layout-mode";

describe("resolveLayoutMode", () => {
  it("accepts classic and workbench", () => {
    expect(resolveLayoutMode("classic")).toBe("classic");
    expect(resolveLayoutMode("workbench")).toBe("workbench");
  });

  it("defaults to workbench for missing or unknown values", () => {
    expect(DEFAULT_LAYOUT_MODE).toBe("workbench");
    expect(resolveLayoutMode(null)).toBe("workbench");
    expect(resolveLayoutMode(undefined)).toBe("workbench");
    expect(resolveLayoutMode("grid")).toBe("workbench");
  });
});

describe("readLayoutMode / writeLayoutMode", () => {
  it("persists the selection to localStorage under innk.layoutMode", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };

    expect(readLayoutMode(storage)).toBe("workbench");
    writeLayoutMode(storage, "classic");
    expect(store.get(LAYOUT_MODE_STORAGE_KEY)).toBe("classic");
    expect(readLayoutMode(storage)).toBe("classic");
  });

  it("tolerates a missing storage", () => {
    expect(readLayoutMode(null)).toBe("workbench");
    expect(() => writeLayoutMode(null, "classic")).not.toThrow();
  });
});
