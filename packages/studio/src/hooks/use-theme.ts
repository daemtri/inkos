import { useEffect, useState } from "react";

/** 解析后的实际主题。组件里的 `theme` prop 一直是这个类型。 */
export type Theme = "light" | "dark";
/** 用户选择的主题模式：浅色 / 深色 / 自动（跟随系统，系统不可用时按时间）。 */
export type ThemeMode = "light" | "dark" | "auto";

const THEME_STORAGE_KEY = "inkos:studio:theme";

interface ThemeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 时间兜底：7:00–19:00 为浅色，其余深色（仅在系统主题不可用时使用）。 */
export function getTimeBasedThemeForHour(hour: number): Theme {
  return hour >= 7 && hour < 19 ? "light" : "dark";
}

function getThemeStorage(): ThemeStorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredThemeMode(
  storage: Pick<ThemeStorageLike, "getItem"> | null | undefined,
): ThemeMode | null {
  const stored = storage?.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "auto" ? stored : null;
}

export interface AutoThemeContext {
  readonly hour: number;
  /** null 表示系统不支持 prefers-color-scheme 查询，退回到按时间判断。 */
  readonly systemPrefersDark: boolean | null;
}

export function resolveAutoTheme(ctx: AutoThemeContext): Theme {
  if (ctx.systemPrefersDark !== null) {
    return ctx.systemPrefersDark ? "dark" : "light";
  }
  return getTimeBasedThemeForHour(ctx.hour);
}

export function resolveTheme(mode: ThemeMode, ctx: AutoThemeContext): Theme {
  return mode === "auto" ? resolveAutoTheme(ctx) : mode;
}

/** IconRail 主题按钮的循环顺序：浅色 → 深色 → 自动。 */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return mode === "light" ? "dark" : mode === "dark" ? "auto" : "light";
}

function readSystemPrefersDark(): boolean | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(
    () => readStoredThemeMode(getThemeStorage()) ?? "auto",
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean | null>(readSystemPrefersDark);
  // 时间兜底需要随时间推进重算（媒体查询不可用时）；有系统主题时这个 tick 无害。
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClockTick((tick) => tick + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const theme = resolveTheme(mode, {
    // clockTick 仅用于触发重算，hour 本身每次取当前值。
    hour: new Date().getHours() + clockTick * 0,
    systemPrefersDark,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setMode = (nextMode: ThemeMode) => {
    const storage = getThemeStorage();
    try {
      storage?.setItem(THEME_STORAGE_KEY, nextMode);
    } catch {
      // 存储失败时仅保留本次会话的内存偏好。
    }
    setModeState(nextMode);
  };

  const setTheme = (nextTheme: Theme) => setMode(nextTheme);

  return { theme, mode, setMode, setTheme };
}
