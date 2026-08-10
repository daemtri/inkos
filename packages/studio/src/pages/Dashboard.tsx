import { fetchJson, useApi, postApi } from "../hooks/use-api";
import { useEffect, useMemo, useState, useRef } from "react";
import { useServiceStore } from "../store/service";
import type { SSEMessage } from "../hooks/use-sse";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { deriveActiveBookIds, shouldRefetchBookCollections } from "../hooks/use-book-activity";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CreateMenu } from "../components/CreateMenu";
import {
  Plus,
  BookOpen,
  BarChart2,
  Zap,
  Clock,
  AlertCircle,
  MoreVertical,
  Flame,
  Trash2,
  Settings,
  Download,
  PenLine,
  Loader2,
} from "lucide-react";

interface BookSummary {
  readonly id: string;
  readonly title: string;
  readonly genre: string;
  readonly status: string;
  readonly chaptersWritten: number;
  readonly targetChapters?: number;
  readonly language?: string;
  readonly fanficMode?: string;
}

interface Nav {
  toBook: (id: string) => void;
  toBookSettings: (id: string) => void;
  toAnalytics: (id: string) => void;
  toBookCreate: () => void;
  toServices: () => void;
  toChat: () => void;
  toTranslation: () => void;
  toImport: (tab?: "chapters" | "canon" | "fanfic" | "spinoff" | "imitation") => void;
}

function BookMenu({ bookId, bookTitle, nav, t, onDelete, onOpenChange }: {
  readonly bookId: string;
  readonly bookTitle: string;
  readonly nav: Nav;
  readonly t: TFunction;
  readonly onDelete: () => void;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenRaw] = useState(false);
  const setOpen = (next: boolean) => {
    setOpenRaw(next);
    onOpenChange?.(next);
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleDelete = async () => {
    setConfirmDelete(false);
    setOpen(false);
    await fetchJson(`/books/${bookId}`, { method: "DELETE" });
    onDelete();
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
      >
        <MoreVertical size={17} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-lg shadow-primary/5 py-1 z-50 fade-in">
          <button
            onClick={() => { setOpen(false); nav.toBookSettings(bookId); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <Settings size={14} className="text-muted-foreground" />
            {t("book.settings")}
          </button>
          <a
            href={`/api/v1/books/${bookId}/export?format=txt`}
            download
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <Download size={14} className="text-muted-foreground" />
            {t("book.export")}
          </a>
          <div className="border-t border-border/50 my-1" />
          <button
            onClick={() => { setOpen(false); setConfirmDelete(true); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
            {t("book.deleteBook")}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={t("book.deleteBook")}
        message={`${t("book.confirmDelete")}\n\n"${bookTitle}"`}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function bookStatusLabel(book: BookSummary, t: TFunction): string {
  return book.status === "active" ? t("book.statusActive")
    : book.status === "paused" ? t("book.statusPaused")
    : book.status === "outlining" ? t("book.statusOutlining")
    : book.status === "completed" ? t("book.statusCompleted")
    : book.status === "dropped" ? t("book.statusDropped")
    : book.status;
}

function bookStatusDot(status: string): string {
  if (status === "active") return "bg-primary";
  if (status === "completed") return "bg-emerald-500";
  if (status === "paused") return "bg-amber-500";
  return "bg-muted-foreground/50";
}

export function Dashboard({ nav, sse, theme, t }: { nav: Nav; sse: { messages: ReadonlyArray<SSEMessage> }; theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const [menuOpenBookId, setMenuOpenBookId] = useState<string | null>(null);
  const { data, loading, error, refetch } = useApi<{ books: ReadonlyArray<BookSummary> }>("/books");
  const writingBooks = useMemo(() => deriveActiveBookIds(sse.messages), [sse.messages]);
  const serviceStoreServices = useServiceStore((s) => s.services);
  const fetchServices = useServiceStore((s) => s.fetchServices);
  useEffect(() => { void fetchServices(); }, [fetchServices]);
  const hasServices = serviceStoreServices.some((s) => s.connected);

  const logEvents = sse.messages.filter((m) => m.event === "log").slice(-8);
  const progressEvent = sse.messages.filter((m) => m.event === "llm:progress").slice(-1)[0];

  useEffect(() => {
    const recent = sse.messages.at(-1);
    if (!recent) return;
    if (shouldRefetchBookCollections(recent)) {
      refetch();
    }
  }, [refetch, sse.messages]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground animate-pulse">Gathering manuscripts...</span>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 border border-destructive/20 rounded-2xl">
      <AlertCircle className="text-destructive mb-4" size={32} />
      <h2 className="text-lg font-semibold text-destructive">Failed to load library</h2>
      <p className="text-sm text-muted-foreground mt-1">{error}</p>
    </div>
  );

  if (!data?.books.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center fade-in">
        <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-8">
          <BookOpen size={40} className="text-primary/30" />
        </div>
        <h2 className="font-serif text-3xl italic text-foreground/80 mb-3">{t("dash.noBooks")}</h2>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-10">
          {t("dash.createFirst")}
        </p>
        <CreateMenu
          nav={nav}
          t={t}
          side="bottom"
          align="center"
          triggerClassName="group flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          {t("nav.newBook")}
        </CreateMenu>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {!hasServices && (
        <div className="rounded-lg border border-border/60 bg-card px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">还没有配置 AI 模型</div>
            <div className="text-xs text-muted-foreground mt-0.5">配好一个服务商才能开始创作</div>
          </div>
          <button
            onClick={nav.toServices}
            className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:brightness-110 transition-colors shrink-0"
          >
            去配置
          </button>
        </div>
      )}

      {/* 欢迎区 */}
      <div className="flex items-end justify-between gap-6 border-b border-border/40 pb-8">
        <div>
          <h1 className="font-serif text-4xl italic mb-2">{t("dash.welcome")}</h1>
          <p className="text-sm text-muted-foreground">{t("dash.welcomeSubtitle")}</p>
        </div>
        <CreateMenu
          nav={nav}
          t={t}
          side="bottom"
          align="end"
          triggerClassName="group flex shrink-0 items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-primary/20"
        >
          <Plus size={16} />
          {t("nav.newBook")}
        </CreateMenu>
      </div>

      {/* 最近书籍卡片 */}
      <div className="grid gap-5 xl:grid-cols-2">
        {data.books.map((book, index) => {
          const isWriting = writingBooks.has(book.id);
          const progress = book.targetChapters && book.targetChapters > 0
            ? Math.min(100, Math.round((book.chaptersWritten / book.targetChapters) * 100))
            : null;
          const staggerClass = `stagger-${Math.min(index + 1, 5)}`;
          return (
            <article
              key={book.id}
              className={`paper-sheet group relative flex flex-col rounded-2xl p-6 fade-in ${staggerClass} ${menuOpenBookId === book.id ? "z-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${bookStatusDot(book.status)}`} />
                    <button
                      onClick={() => nav.toBook(book.id)}
                      className="truncate text-left font-serif text-xl font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {book.title}
                    </button>
                    {isWriting && (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                        <Loader2 size={11} className="animate-spin" />
                        {t("dash.writing")}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="rounded bg-secondary/60 px-1.5 py-0.5 uppercase tracking-wider">{book.genre}</span>
                    <span>{bookStatusLabel(book, t)}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {book.chaptersWritten} {t("dash.chapters")}
                    </span>
                    {book.language === "en" && (
                      <span className="rounded border border-primary/20 px-1 py-0.5 text-[10px] font-bold text-primary">EN</span>
                    )}
                    {book.fanficMode && (
                      <span className="flex items-center gap-1 text-purple-500">
                        <Zap size={11} />
                        <span className="italic">{book.fanficMode}</span>
                      </span>
                    )}
                  </div>
                </div>
                <BookMenu
                  bookId={book.id}
                  bookTitle={book.title}
                  nav={nav}
                  t={t}
                  onDelete={() => refetch()}
                  onOpenChange={(isOpen) => setMenuOpenBookId(isOpen ? book.id : null)}
                />
              </div>

              {/* 进度条：有目标章数时显示百分比，否则只显示已写章数 */}
              <div className="mt-5">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground/70">
                  <span className="uppercase tracking-wider">{t("dash.progress")}</span>
                  <span className="tabular-nums">
                    {progress !== null ? `${book.chaptersWritten}/${book.targetChapters} · ${progress}%` : `${book.chaptersWritten} ${t("dash.chapters")}`}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full bg-primary transition-[width] duration-500 ${isWriting ? "animate-pulse" : ""}`}
                    style={{ width: `${progress ?? (book.chaptersWritten > 0 ? 100 : 4)}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <button
                  onClick={() => nav.toBook(book.id)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] shadow-sm shadow-primary/20"
                >
                  <PenLine size={15} />
                  {t("dash.continue")}
                </button>
                <button
                  onClick={async () => {
                    try { await postApi(`/books/${book.id}/write-next`); }
                    catch (e) { alert(e instanceof Error ? e.message : "Write failed"); }
                  }}
                  disabled={isWriting}
                  title={t("dash.writeNext")}
                  className={`flex items-center gap-2 rounded-xl border border-border/50 px-4 py-2.5 text-sm font-semibold transition-all ${
                    isWriting
                      ? "cursor-wait text-primary animate-pulse"
                      : "bg-secondary text-foreground hover:border-primary/40 hover:text-primary active:scale-95"
                  }`}
                >
                  <Zap size={15} />
                  {t("dash.writeNext")}
                </button>
                <button
                  onClick={() => nav.toAnalytics(book.id)}
                  className="flex items-center justify-center rounded-xl border border-border/50 bg-secondary p-2.5 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary active:scale-95"
                  title={t("dash.stats")}
                >
                  <BarChart2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* 实时生成追踪 */}
      {writingBooks.size > 0 && logEvents.length > 0 && (
        <div className="glass-panel rounded-2xl p-8 border-primary/20 bg-primary/[0.02] shadow-2xl shadow-primary/5 fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Flame size={18} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary"> Manuscript Foundry</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Real-time LLM generation tracking</p>
              </div>
            </div>
            {progressEvent && (
              <div className="flex items-center gap-4 text-xs font-bold text-primary px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Clock size={12} />
                  <span>{Math.round(((progressEvent.data as { elapsedMs?: number })?.elapsedMs ?? 0) / 1000)}s</span>
                </div>
                <div className="w-px h-3 bg-primary/20" />
                <div className="flex items-center gap-2">
                  <Zap size={12} />
                  <span>{((progressEvent.data as { totalChars?: number })?.totalChars ?? 0).toLocaleString()} Chars</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 font-mono text-xs bg-black/5 dark:bg-black/20 p-6 rounded-xl border border-border/50 max-h-[200px] overflow-y-auto scrollbar-thin">
            {logEvents.map((msg, i) => {
              const d = msg.data as { tag?: string; message?: string };
              return (
                <div key={i} className="flex gap-3 leading-relaxed animate-in fade-in slide-in-from-left-2 duration-300">
                  <span className="text-primary/60 font-bold shrink-0">[{d.tag}]</span>
                  <span className="text-muted-foreground">{d.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
