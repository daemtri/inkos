/** 中 / EN 语言切换：经典布局头部与工作台 AppShell 头部共用。 */
export function LanguageToggle({ lang, onSelect }: {
  readonly lang: string;
  readonly onSelect: (lang: "zh" | "en") => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-muted/50 p-0.5">
      <button
        type="button"
        onClick={() => onSelect("zh")}
        aria-pressed={lang === "zh"}
        className={`rounded-md px-2.5 py-1 text-sm font-medium ${lang === "zh" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
      >
        中
      </button>
      <button
        type="button"
        onClick={() => onSelect("en")}
        aria-pressed={lang === "en"}
        className={`rounded-md px-2.5 py-1 text-sm font-medium ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
      >
        EN
      </button>
    </div>
  );
}
