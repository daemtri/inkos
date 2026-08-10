import type { ThemeMode } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import {
  BookOpen,
  House,
  LogOut,
  Monitor,
  Moon,
  Settings,
  SquarePen,
  Sun,
  Wrench,
} from "lucide-react";
import { InkosLogo } from "./InkosLogo";
import { CreateMenu } from "./CreateMenu";
import {
  SETTINGS_ACTIVE_PAGES,
  TOOLS_ACTIVE_PAGES,
  type StudioNav,
} from "./app-shell-model";

function RailButton({ label, active, onClick, children }: {
  readonly label: string;
  readonly active?: boolean;
  readonly onClick?: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${
        active
          ? "bg-secondary text-primary"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
    >
      {active && (
        <span className="absolute left-[-9px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
      )}
      {children}
    </button>
  );
}

export function IconRail({ nav, activePage, themeMode, onCycleTheme, authEnabled, onLogout, t }: {
  readonly nav: StudioNav;
  readonly activePage: string;
  readonly themeMode: ThemeMode;
  readonly onCycleTheme: () => void;
  readonly authEnabled?: boolean;
  readonly onLogout?: () => void;
  readonly t: TFunction;
}) {
  const booksActive = activePage.startsWith("book:") || activePage === "book-create";
  const toolsActive = TOOLS_ACTIVE_PAGES.includes(activePage);
  const settingsActive = SETTINGS_ACTIVE_PAGES.includes(activePage);

  const themeLabel = `${t("rail.theme")} · ${
    themeMode === "light" ? t("rail.themeLight") : themeMode === "dark" ? t("rail.themeDark") : t("rail.themeAuto")
  }`;

  return (
    <nav
      aria-label="innk Studio"
      className="flex w-14 shrink-0 flex-col items-center border-r border-border/60 bg-card/40 py-3 select-none"
    >
      <button
        type="button"
        onClick={nav.toDashboard}
        title="innk Studio"
        aria-label="innk Studio"
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 hover:scale-105"
      >
        <InkosLogo className="h-8 w-8" />
      </button>

      <div className="flex flex-col items-center gap-1.5">
        <RailButton label={t("bread.home")} active={activePage === "dashboard"} onClick={nav.toDashboard}>
          <House size={18} />
        </RailButton>

        {/* 书籍列表即首页 Dashboard */}
        <RailButton label={t("rail.books")} active={booksActive} onClick={nav.toDashboard}>
          <BookOpen size={18} />
        </RailButton>

        <CreateMenu
          nav={nav}
          t={t}
          triggerLabel={t("rail.create")}
          triggerClassName="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:brightness-110"
        >
          <SquarePen size={18} />
        </CreateMenu>

        <RailButton label={t("nav.tools")} active={toolsActive} onClick={nav.toTools}>
          <Wrench size={18} />
        </RailButton>

        <RailButton label={t("rail.settings")} active={settingsActive} onClick={nav.toSettingsHub}>
          <Settings size={18} />
        </RailButton>
      </div>

      <div className="mt-auto flex flex-col items-center gap-1.5">
        <RailButton label={themeLabel} onClick={onCycleTheme}>
          {themeMode === "light" ? <Sun size={18} /> : themeMode === "dark" ? <Moon size={18} /> : <Monitor size={18} />}
        </RailButton>
        {authEnabled && (
          <RailButton label={t("rail.logout")} onClick={onLogout}>
            <LogOut size={18} />
          </RailButton>
        )}
      </div>
    </nav>
  );
}
