import type { TFunction } from "../hooks/use-i18n";
import { TOOLS_HUB_ENTRIES } from "../components/app-shell-model";
import {
  Boxes,
  ChevronRight,
  FileInput,
  Stethoscope,
  Terminal,
  Wand2,
  Zap,
} from "lucide-react";

interface ToolsHubNav {
  toGenres: () => void;
  toStyle: () => void;
  toImport: () => void;
  toDoctor: () => void;
  toDaemon: () => void;
  toLogs: () => void;
}

const ENTRY_ICONS: Record<string, React.ReactNode> = {
  genres: <Boxes size={18} />,
  style: <Wand2 size={18} />,
  import: <FileInput size={18} />,
  doctor: <Stethoscope size={18} />,
  daemon: <Zap size={18} />,
  logs: <Terminal size={18} />,
};

/** 工具页：IconRail「工具」入口的目标页，汇总所有工具入口。 */
export function ToolsHub({ nav, t }: { readonly nav: ToolsHubNav; readonly t: TFunction }) {
  const handlers: Record<string, () => void> = {
    genres: nav.toGenres,
    style: nav.toStyle,
    import: () => nav.toImport(),
    doctor: nav.toDoctor,
    daemon: nav.toDaemon,
    logs: nav.toLogs,
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-border/40 pb-6">
        <h1 className="font-serif text-3xl italic">{t("nav.tools")}</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS_HUB_ENTRIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={handlers[entry.id]}
            className="paper-sheet group flex items-center gap-4 rounded-2xl p-5 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              {ENTRY_ICONS[entry.id]}
            </span>
            <span className="flex-1 text-[15px] font-medium text-foreground">{t(entry.labelKey)}</span>
            <ChevronRight size={16} className="text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
