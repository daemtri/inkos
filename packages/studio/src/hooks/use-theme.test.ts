import { describe, expect, it } from "vitest";
import {
  getTimeBasedThemeForHour,
  nextThemeMode,
  readStoredThemeMode,
  resolveAutoTheme,
  resolveTheme,
} from "./use-theme";

describe("resolveTheme", () => {
  it("manual light/dark modes always win over system and clock", () => {
    expect(resolveTheme("light", { hour: 23, systemPrefersDark: true })).toBe("light");
    expect(resolveTheme("dark", { hour: 9, systemPrefersDark: false })).toBe("dark");
  });

  it("auto mode delegates to the auto resolver", () => {
    expect(resolveTheme("auto", { hour: 12, systemPrefersDark: true })).toBe("dark");
    expect(resolveTheme("auto", { hour: 12, systemPrefersDark: false })).toBe("light");
  });
});

describe("resolveAutoTheme", () => {
  it("follows prefers-color-scheme when the media query is available", () => {
    // 系统判定优先于时间：白天也可能用深色。
    expect(resolveAutoTheme({ hour: 12, systemPrefersDark: true })).toBe("dark");
    expect(resolveAutoTheme({ hour: 23, systemPrefersDark: false })).toBe("light");
  });

  it("falls back to the local clock when the media query is unavailable", () => {
    expect(resolveAutoTheme({ hour: 23, systemPrefersDark: null })).toBe("dark");
    expect(resolveAutoTheme({ hour: 9, systemPrefersDark: null })).toBe("light");
  });
});

describe("getTimeBasedThemeForHour", () => {
  it("treats 7:00–19:00 local time as light", () => {
    expect(getTimeBasedThemeForHour(6)).toBe("dark");
    expect(getTimeBasedThemeForHour(7)).toBe("light");
    expect(getTimeBasedThemeForHour(18)).toBe("light");
    expect(getTimeBasedThemeForHour(19)).toBe("dark");
  });
});

describe("readStoredThemeMode", () => {
  it("accepts light, dark and auto values from storage", () => {
    expect(readStoredThemeMode({ getItem: () => "light" })).toBe("light");
    expect(readStoredThemeMode({ getItem: () => "dark" })).toBe("dark");
    expect(readStoredThemeMode({ getItem: () => "auto" })).toBe("auto");
  });

  it("rejects unknown or missing values so the default (auto) applies", () => {
    expect(readStoredThemeMode({ getItem: () => "sepia" })).toBeNull();
    expect(readStoredThemeMode({ getItem: () => null })).toBeNull();
    expect(readStoredThemeMode(null)).toBeNull();
  });
});

describe("nextThemeMode", () => {
  it("cycles light → dark → auto → light", () => {
    expect(nextThemeMode("light")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("auto");
    expect(nextThemeMode("auto")).toBe("light");
  });
});
