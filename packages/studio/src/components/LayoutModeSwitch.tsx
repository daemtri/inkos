import { useLayoutMode } from "../hooks/use-layout-mode";
import type { TFunction } from "../hooks/use-i18n";
import { LayoutGrid, Columns3 } from "lucide-react";

/** 经典布局 / 工作台布局切换控件：书籍工作台页与 Chat 页顶部使用。 */
export function LayoutModeSwitch({ t }: { readonly t: TFunction }) {
  const { layoutMode, setLayoutMode } = useLayoutMode();

  return (
    <div
      role="group"
      aria-label={t("layout.switch")}
      className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/40 p-0.5"
    >
      <button
        type="button"
        onClick={() => setLayoutMode("classic")}
        aria-pressed={layoutMode === "classic"}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          layoutMode === "classic"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutGrid size={13} />
        {t("layout.classic")}
      </button>
      <button
        type="button"
        onClick={() => setLayoutMode("workbench")}
        aria-pressed={layoutMode === "workbench"}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          layoutMode === "workbench"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Columns3 size={13} />
        {t("layout.workbench")}
      </button>
    </div>
  );
}
