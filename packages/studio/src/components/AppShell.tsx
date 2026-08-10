import type { ThemeMode } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import type { StudioNav } from "./app-shell-model";
import { IconRail } from "./IconRail";
import { House } from "lucide-react";

/**
 * 工作台布局外壳：IconRail（导航竖条）+ ContextPanel（页面上下文栏，可选/可折叠）
 * + 主工作区。主工作区是 flex 列，页面自己决定内部滚动。
 */
export function AppShell({ nav, activePage, t, themeMode, onCycleTheme, authEnabled, onLogout, contextPanel, headerExtras, children }: {
  readonly nav: StudioNav;
  readonly activePage: string;
  readonly t: TFunction;
  readonly themeMode: ThemeMode;
  readonly onCycleTheme: () => void;
  readonly authEnabled?: boolean;
  readonly onLogout?: () => void;
  readonly contextPanel?: React.ReactNode;
  readonly headerExtras?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground">
      <IconRail
        nav={nav}
        activePage={activePage}
        themeMode={themeMode}
        onCycleTheme={onCycleTheme}
        authEnabled={authEnabled}
        onLogout={onLogout}
        t={t}
      />

      {contextPanel}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/40 px-5">
          <button
            type="button"
            onClick={nav.toDashboard}
            className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/70 px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/50"
          >
            <House size={15} />
            <span>{t("bread.home")}</span>
            <span className="text-muted-foreground/70">/</span>
            <span className="font-serif">innk Studio</span>
          </button>
          <div className="flex items-center gap-3">{headerExtras}</div>
        </header>
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
