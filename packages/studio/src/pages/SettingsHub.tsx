import type { TFunction } from "../hooks/use-i18n";
import { SETTINGS_HUB_ENTRIES } from "../components/app-shell-model";
import { ChevronRight, Settings } from "lucide-react";

interface SettingsHubNav {
  toServices: () => void;
  toProjectSettings: () => void;
}

/** 设置页：IconRail「设置」入口的目标页，汇总模型配置与项目设置。 */
export function SettingsHub({ nav, t }: { readonly nav: SettingsHubNav; readonly t: TFunction }) {
  const handlers: Record<string, () => void> = {
    services: nav.toServices,
    "project-settings": nav.toProjectSettings,
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-border/40 pb-6">
        <h1 className="font-serif text-3xl italic">{t("rail.settings")}</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SETTINGS_HUB_ENTRIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={handlers[entry.id]}
            className="paper-sheet group flex items-center gap-4 rounded-2xl p-5 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <Settings size={18} />
            </span>
            <span className="flex-1 text-[15px] font-medium text-foreground">{t(entry.labelKey)}</span>
            <ChevronRight size={16} className="text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
