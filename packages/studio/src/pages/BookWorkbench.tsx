import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson, postApi, useApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import type { SSEMessage } from "../hooks/use-sse";
import { useChatStore } from "../store/chat";
import { useLayoutMode } from "../hooks/use-layout-mode";
import { tr } from "../lib/app-language";
import { ChatPage } from "./ChatPage";
import { chapterStatusLabel, type PanelChapterMeta } from "../components/ContextPanel";
import { LayoutModeSwitch } from "../components/LayoutModeSwitch";
import { BookSidebar, BookSidebarToggle } from "../components/chat/BookSidebar";
import {
  CheckCircle2,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Save,
  Type,
  X,
  XCircle,
} from "lucide-react";

interface WorkbenchNav {
  toDashboard: () => void;
  toBook: (id: string) => void;
  toServices: () => void;
  toImport: (tab?: "chapters" | "canon" | "fanfic" | "spinoff" | "imitation") => void;
  toStyle: () => void;
  toFilm: (projectId: string) => void;
  toFilmStudio: (projectId: string) => void;
}

const CHAT_MIN_WIDTH = 340;
const CHAT_MAX_WIDTH = 760;
const CHAT_DEFAULT_WIDTH = 440;

/* ── 文稿面板：章节阅读 / 编辑 ── */

function ManuscriptPane({ bookId, chapterNumber, onChanged }: {
  readonly bookId: string;
  readonly chapterNumber: number;
  readonly onChanged: () => void;
}) {
  const { data, loading, error, refetch } = useApi<{ content: string }>(
    `/books/${bookId}/chapters/${chapterNumber}`,
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(false);
  }, [bookId, chapterNumber]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchJson(`/books/${bookId}/chapters/${chapterNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      setEditing(false);
      refetch();
      onChanged();
    } catch {
      // 保存失败时停留在编辑态，不丢草稿。
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      await postApi(`/books/${bookId}/chapters/${chapterNumber}/approve`);
      refetch();
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approve failed");
    }
  };

  const handleReject = async () => {
    try {
      await postApi(`/books/${bookId}/chapters/${chapterNumber}/reject`);
      refetch();
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reject failed");
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground/70">
        {error ?? tr("章节内容加载失败。", "Failed to load the chapter.")}
      </div>
    );
  }

  const lines = data.content.split("\n");
  const titleLine = lines.find((line) => line.startsWith("# "));
  const title = titleLine?.replace(/^#\s*/, "") ?? tr(`第 ${chapterNumber} 章`, `Chapter ${chapterNumber}`);
  const body = lines.filter((line) => line !== titleLine).join("\n").trim();
  const paragraphs = body.split(/\n\n+/).filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-5 py-2.5">
        <span className="min-w-0 flex-1 truncate font-serif text-[17px] italic text-foreground/90">{title}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground/70">
          <Type size={12} />
          {body.length.toLocaleString()}
        </span>
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {tr("保存", "Save")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              aria-label={tr("取消", "Cancel")}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setDraft(data.content); setEditing(true); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              title={tr("编辑", "Edit")}
              aria-label={tr("编辑", "Edit")}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => void handleApprove()}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-500"
              title={tr("通过", "Approve")}
              aria-label={tr("通过", "Approve")}
            >
              <CheckCircle2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => void handleReject()}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
              title={tr("驳回", "Reject")}
              aria-label={tr("驳回", "Reject")}
            >
              <XCircle size={15} />
            </button>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {editing ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            className="min-h-full w-full resize-none bg-transparent px-6 py-5 font-serif text-[16px] leading-8 text-foreground/90 outline-none"
            autoFocus
          />
        ) : (
          <article className="mx-auto max-w-[72ch] px-6 py-8">
            <h2 className="mb-8 font-serif text-2xl italic leading-snug text-foreground">{title}</h2>
            {paragraphs.map((para, index) => (
              <p key={index} className="mb-5 font-serif text-[16.5px] leading-[1.9] text-foreground/85">
                {para}
              </p>
            ))}
            {paragraphs.length === 0 && (
              <p className="text-sm italic text-muted-foreground/60">{tr("本章还没有正文。", "This chapter is empty.")}</p>
            )}
          </article>
        )}
      </div>
    </div>
  );
}

/* ── 书籍工作台：文稿 | 分隔条 | Chat ── */

export function BookWorkbench({ bookId, nav, theme, t, sse }: {
  readonly bookId: string;
  readonly nav: WorkbenchNav;
  readonly theme: Theme;
  readonly t: TFunction;
  readonly sse: { messages: ReadonlyArray<SSEMessage>; connected: boolean };
}) {
  const artifactChapter = useChatStore((s) => s.artifactChapter);
  const bumpBookDataVersion = useChatStore((s) => s.bumpBookDataVersion);
  const [chapters, setChapters] = useState<ReadonlyArray<PanelChapterMeta>>([]);
  const bookDataVersion = useChatStore((s) => s.bookDataVersion);

  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_WIDTH);
  const draggingRef = useRef(false);
  const { layoutMode } = useLayoutMode();

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ chapters: PanelChapterMeta[] }>(`/books/${bookId}`)
      .then((data) => { if (!cancelled) setChapters(data.chapters); })
      .catch(() => { if (!cancelled) setChapters([]); });
    return () => { cancelled = true; };
  }, [bookId, bookDataVersion]);

  // 未显式选章时默认读最新一章。
  const activeChapter = artifactChapter ?? chapters.at(-1)?.number ?? null;
  const activeChapterMeta = chapters.find((chapter) => chapter.number === activeChapter);

  const onDragStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    draggingRef.current = true;
    const startX = event.clientX;
    const startWidth = chatWidth;
    const onMove = (moveEvent: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = startX - moveEvent.clientX;
      setChatWidth(Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, startWidth + delta)));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [chatWidth]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* 顶条：布局切换只出现在书籍工作台页，只控制本页内部布局 */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 px-4">
        <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t("workbench.manuscript")}
        </span>
        <LayoutModeSwitch t={t} />
      </div>

      {layoutMode === "classic" ? (
        /* 经典形态：旧版单栏 —— 对话区 + 书籍信息侧栏（复用旧路由的渲染路径） */
        <div className="flex min-h-0 min-w-0 flex-1">
          <ChatPage mode="book" activeBookId={bookId} nav={nav} theme={theme} t={t} sse={sse} />
          <BookSidebar bookId={bookId} theme={theme} t={t} sse={sse} />
          <BookSidebarToggle bookId={bookId} theme={theme} t={t} sse={sse} />
        </div>
      ) : (
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* 文稿区 */}
      <section className="flex min-w-0 flex-1 flex-col" aria-label={t("workbench.manuscript")}>
        {activeChapter === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="font-serif text-xl italic text-foreground/70">{t("book.noChapters")}</p>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground/70">
              {t("workbench.selectChapter")}
            </p>
          </div>
        ) : (
          <>
            {activeChapterMeta && (
              <div className="flex shrink-0 items-center gap-2 border-b border-border/40 bg-card/30 px-5 py-1.5">
                <span className="text-xs text-muted-foreground/70">
                  {tr(`第 ${activeChapterMeta.number} 章`, `Chapter ${activeChapterMeta.number}`)}
                </span>
                <span className="text-border">·</span>
                <span className="text-xs text-muted-foreground/70">{chapterStatusLabel(activeChapterMeta.status)}</span>
              </div>
            )}
            <div className="min-h-0 flex-1">
              <ManuscriptPane
                key={`${bookId}-${activeChapter}`}
                bookId={bookId}
                chapterNumber={activeChapter}
                onChanged={bumpBookDataVersion}
              />
            </div>
          </>
        )}
      </section>

      {chatOpen ? (
        <>
          {/* 可拖拽分隔条 */}
          <div
            onMouseDown={onDragStart}
            className="w-1 shrink-0 cursor-col-resize border-l border-border/60 transition-colors hover:bg-primary/20 active:bg-primary/30"
            role="separator"
            aria-orientation="vertical"
          />
          <aside
            className="flex shrink-0 flex-col border-l border-border/40 bg-card/20"
            style={{ width: chatWidth }}
            aria-label={t("workbench.chat")}
          >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/40 px-3">
              <span className="flex-1 text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {t("workbench.chat")}
              </span>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                title={t("workbench.collapseChat")}
                aria-label={t("workbench.collapseChat")}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              >
                <PanelRightClose size={15} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <ChatPage mode="book" activeBookId={bookId} nav={nav} theme={theme} t={t} sse={sse} />
            </div>
          </aside>
        </>
      ) : (
        <div className="flex w-10 shrink-0 flex-col items-center border-l border-border/60 bg-card/30 py-3">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            title={t("workbench.expandChat")}
            aria-label={t("workbench.expandChat")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            <PanelRightOpen size={15} />
          </button>
        </div>
      )}
    </div>
      )}
    </div>
  );
}
