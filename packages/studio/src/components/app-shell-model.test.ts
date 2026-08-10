import { describe, expect, it } from "vitest";
import {
  CREATE_ENTRIES,
  RAIL_ITEMS,
  SETTINGS_ACTIVE_PAGES,
  SETTINGS_HUB_ENTRIES,
  TOOLS_ACTIVE_PAGES,
  TOOLS_HUB_ENTRIES,
} from "./app-shell-model";

describe("app-shell nav model", () => {
  it("exposes all five primary rail entries in order", () => {
    expect([...RAIL_ITEMS]).toEqual(["home", "books", "create", "tools", "settings"]);
  });

  it("keeps every creation entry from the classic sidebar", () => {
    expect(CREATE_ENTRIES.map((entry) => entry.id)).toEqual([
      "novel",
      "short",
      "script",
      "storyboard",
      "fanfic",
      "spinoff",
      "imitation",
      "continuation",
      "translation",
    ]);
  });

  it("never surfaces the hidden entries (interactive film / play / branching / open world / radar)", () => {
    const hidden = ["interactive-film", "play", "branching", "open-world", "radar"];
    const allIds = [
      ...CREATE_ENTRIES.map((entry) => entry.id),
      ...TOOLS_HUB_ENTRIES.map((entry) => entry.id),
      ...SETTINGS_HUB_ENTRIES.map((entry) => entry.id),
      ...TOOLS_ACTIVE_PAGES,
      ...SETTINGS_ACTIVE_PAGES,
    ];
    for (const id of hidden) {
      expect(allIds).not.toContain(id);
    }
  });

  it("covers the tools hub with all tool pages", () => {
    expect(TOOLS_HUB_ENTRIES.map((entry) => entry.id)).toEqual([
      "genres",
      "style",
      "import",
      "doctor",
      "daemon",
      "logs",
    ]);
    for (const entry of TOOLS_HUB_ENTRIES) {
      expect(TOOLS_ACTIVE_PAGES).toContain(entry.id);
    }
    expect(TOOLS_ACTIVE_PAGES).toContain("tools");
  });

  it("covers the settings hub with model config and project settings", () => {
    expect(SETTINGS_HUB_ENTRIES.map((entry) => entry.id)).toEqual(["services", "project-settings"]);
    for (const entry of SETTINGS_HUB_ENTRIES) {
      expect(SETTINGS_ACTIVE_PAGES).toContain(entry.id);
    }
    expect(SETTINGS_ACTIVE_PAGES).toContain("settings-hub");
  });
});
