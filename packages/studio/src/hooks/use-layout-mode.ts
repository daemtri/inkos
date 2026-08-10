import { useEffect, useState } from "react";

/**
 * 布局模式：classic（经典布局，260px Sidebar）/ workbench（三栏工作台）。
 * 全局一个开关，书籍工作台页和 Chat 页顶部的切换控件都写这里。
 */
export type LayoutMode = "classic" | "workbench";

export const LAYOUT_MODE_STORAGE_KEY = "innk.layoutMode";
export const LAYOUT_MODE_CHANGED_EVENT = "innk:layout-mode-changed";

export const DEFAULT_LAYOUT_MODE: LayoutMode = "workbench";

interface LayoutStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function resolveLayoutMode(stored: string | null | undefined): LayoutMode {
  return stored === "classic" || stored === "workbench" ? stored : DEFAULT_LAYOUT_MODE;
}

export function readLayoutMode(
  storage: Pick<LayoutStorageLike, "getItem"> | null | undefined,
): LayoutMode {
  return resolveLayoutMode(storage?.getItem(LAYOUT_MODE_STORAGE_KEY));
}

export function writeLayoutMode(
  storage: Pick<LayoutStorageLike, "setItem"> | null | undefined,
  mode: LayoutMode,
): void {
  try {
    storage?.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
  } catch {
    // 存储失败时仅保留本次会话的内存偏好。
  }
}

function getStorage(): LayoutStorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useLayoutMode() {
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => readLayoutMode(getStorage()));

  // 事件通知：同一页面里多个切换控件（书籍工作台 / Chat 页）保持同步。
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onChanged = () => setLayoutModeState(readLayoutMode(getStorage()));
    window.addEventListener(LAYOUT_MODE_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(LAYOUT_MODE_CHANGED_EVENT, onChanged);
  }, []);

  const setLayoutMode = (nextMode: LayoutMode) => {
    writeLayoutMode(getStorage(), nextMode);
    setLayoutModeState(nextMode);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(LAYOUT_MODE_CHANGED_EVENT));
    }
  };

  return { layoutMode, setLayoutMode };
}
