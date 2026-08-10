import type { StringKey } from "../hooks/use-i18n";

/**
 * AppShell / IconRail 的导航模型。纯数据定义，组件与冒烟测试共用，
 * 保证「导航项齐全、已隐藏的入口不再出现」有单一事实来源。
 */

export interface StudioNav {
  toDashboard: () => void;
  toChat: () => void;
  toBook: (id: string) => void;
  toBookCreate: () => void;
  toServices: () => void;
  toProjectSettings: () => void;
  toDaemon: () => void;
  toLogs: () => void;
  toGenres: () => void;
  toStyle: () => void;
  toTranslation: () => void;
  toDoctor: () => void;
  toTools: () => void;
  toSettingsHub: () => void;
  toImport: (tab?: "chapters" | "canon" | "fanfic" | "spinoff" | "imitation") => void;
}

/** 新建创作菜单需要的导航方法子集（Dashboard 等页面也复用 CreateMenu）。 */
export interface CreateNav {
  toBookCreate: () => void;
  toChat: () => void;
  toTranslation: () => void;
  toImport: (tab?: "chapters" | "canon" | "fanfic" | "spinoff" | "imitation") => void;
}

/** IconRail 一级入口（自上而下）：首页、书籍、新建创作、工具、设置。 */
export const RAIL_ITEMS = ["home", "books", "create", "tools", "settings"] as const;
export type RailItemId = (typeof RAIL_ITEMS)[number];

/**
 * 「新建创作」菜单条目：与经典 Sidebar 的创作区块一致。
 * 互动影游 / 分支互动 / 开放世界 / 市场雷达为已隐藏入口，刻意不在此列。
 */
export type CreateEntryId =
  | "novel"
  | "short"
  | "script"
  | "storyboard"
  | "fanfic"
  | "spinoff"
  | "imitation"
  | "continuation"
  | "translation";

export interface CreateEntry {
  readonly id: CreateEntryId;
  readonly labelKey: StringKey;
}

export const CREATE_ENTRIES: ReadonlyArray<CreateEntry> = [
  { id: "novel", labelKey: "nav.createNovel" },
  { id: "short", labelKey: "nav.createShort" },
  { id: "script", labelKey: "nav.createScript" },
  { id: "storyboard", labelKey: "nav.createStoryboard" },
  { id: "fanfic", labelKey: "nav.createFanfic" },
  { id: "spinoff", labelKey: "nav.createSpinoff" },
  { id: "imitation", labelKey: "nav.createImitation" },
  { id: "continuation", labelKey: "nav.createContinuation" },
  { id: "translation", labelKey: "nav.createTranslation" },
];

/** 工具页（ToolsHub）卡片条目。 */
export type ToolsHubEntryId = "genres" | "style" | "import" | "doctor" | "daemon" | "logs";

export interface HubEntry {
  readonly id: string;
  readonly labelKey: StringKey;
}

export const TOOLS_HUB_ENTRIES: ReadonlyArray<HubEntry> = [
  { id: "genres", labelKey: "create.genre" },
  { id: "style", labelKey: "nav.style" },
  { id: "import", labelKey: "nav.import" },
  { id: "doctor", labelKey: "nav.doctor" },
  { id: "daemon", labelKey: "nav.daemon" },
  { id: "logs", labelKey: "nav.logs" },
];

/** 设置页（SettingsHub）卡片条目。 */
export const SETTINGS_HUB_ENTRIES: ReadonlyArray<HubEntry> = [
  { id: "services", labelKey: "nav.config" },
  { id: "project-settings", labelKey: "nav.projectSettings" },
];

/** IconRail 高亮：工具/设置入口覆盖的页面集合。 */
export const TOOLS_ACTIVE_PAGES: ReadonlyArray<string> = [
  "tools",
  "genres",
  "style",
  "import",
  "doctor",
  "daemon",
  "logs",
];

export const SETTINGS_ACTIVE_PAGES: ReadonlyArray<string> = [
  "settings-hub",
  "services",
  "project-settings",
  "service-detail",
];
