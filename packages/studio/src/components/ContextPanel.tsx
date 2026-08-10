import { useEffect, useMemo, useState } from "react";
import { fetchJson, useApi } from "../hooks/use-api";
import type { SSEMessage } from "../hooks/use-sse";
import { shouldRefetchBookCollections } from "../hooks/use-book-activity";
import type { TFunction } from "../hooks/use-i18n";
import { tr } from "../lib/app-language";
import { setProjectChatSessionId } from "../pages/chat-page-state";
import { useChatStore } from "../store/chat";
import type { StudioNav } from "./app-shell-model";
import { Loader2, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";

/* ── 面板外壳：标题栏 + 整栏折叠 ── */

export function ContextPanel({ title, t, children, headerAction }: {
  readonly title: string;
  readonly t: TFunction;
  readonly children: React.ReactNode;
  readonly headerAction?: React.ReactNode;
}) {
  // 整栏折叠：面板自管状态，折叠后只剩一条带展开按钮的细条。
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-r border-border/60 bg-card/30 py-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title={t("context.expand")}
          aria-label={t("context.expand")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <PanelLeftOpen size={15} />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border/60 bg-card/30 select-none">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-4">
        <span className="flex-1 truncate text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </span>
        {headerAction}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title={t("context.collapse")}
          aria-label={t("context.collapse")}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

/* ── 首页：最近书籍 ── */

interface PanelBookSummary {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly chaptersWritten: number;
}

function bookStatusDot(status: string): string {
  if (status === "active") return "bg-primary";
  if (status === "completed") return "bg-emerald-500";
  if (status === "paused") return "bg-amber-500";
  return "bg-muted-foreground/50";
}

export function RecentBooksPanel({ nav, sse, activeBookId }: {
  readonly nav: StudioNav;
  readonly sse: { messages: ReadonlyArray<SSEMessage> };
  readonly activeBookId?: string;
}) {
  const { data, refetch } = useApi<{ books: ReadonlyArray<PanelBookSummary> }>("/books");

  useEffect(() => {
    const recent = sse.messages.at(-1);
    if (recent && shouldRefetchBookCollections(recent)) {
      refetch();
    }
  }, [refetch, sse.messages]);

  const books = data?.books ?? [];

  return (
    <div className="p-2">
      {books.length === 0 && (
        <p className="px-3 py-6 text-center text-xs italic text-muted-foreground/60">{tr("还没有书", "No books yet")}</p>
      )}
      {books.map((book) => (
        <button
          key={book.id}
          type="button"
          onClick={() => nav.toBook(book.id)}
          className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
            activeBookId === book.id ? "bg-secondary/70" : "hover:bg-secondary/50"
          }`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${bookStatusDot(book.status)}`} />
          <span className={`flex-1 truncate text-sm ${activeBookId === book.id ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
            {book.title}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground/50">
            {book.chaptersWritten}{tr("章", "ch")}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── 书籍页：章节列表（状态点 + 字数） ── */

export interface PanelChapterMeta {
  readonly number: number;
  readonly title: string;
  readonly status: string;
  readonly wordCount: number;
}

function chapterStatusDot(status: string): string {
  if (status === "approved") return "bg-emerald-500";
  if (status === "ready-for-review") return "bg-amber-500";
  if (status === "needs-revision" || status === "audit-failed") return "bg-destructive";
  if (status === "imported") return "bg-blue-500";
  return "bg-muted-foreground/50";
}

export function chapterStatusLabel(status: string): string {
  if (status === "approved") return tr("定稿", "Approved");
  if (status === "ready-for-review") return tr("待审", "Review");
  if (status === "needs-revision") return tr("需修订", "Revise");
  if (status === "imported") return tr("已导入", "Imported");
  return tr("草稿", "Draft");
}

export function ChapterListPanel({ bookId }: { readonly bookId: string }) {
  const [chapters, setChapters] = useState<ReadonlyArray<PanelChapterMeta>>([]);
  const bookDataVersion = useChatStore((s) => s.bookDataVersion);
  const artifactChapter = useChatStore((s) => s.artifactChapter);
  const openChapterArtifact = useChatStore((s) => s.openChapterArtifact);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ chapters: PanelChapterMeta[] }>(`/books/${bookId}`)
      .then((data) => { if (!cancelled) setChapters(data.chapters); })
      .catch(() => { if (!cancelled) setChapters([]); });
    return () => { cancelled = true; };
  }, [bookId, bookDataVersion]);

  return (
    <div className="p-2">
      {chapters.length === 0 && (
        <p className="px-3 py-6 text-center text-xs italic text-muted-foreground/60">{tr("暂无章节", "No chapters")}</p>
      )}
      {chapters.map((chapter) => {
        const isActive = artifactChapter === chapter.number;
        return (
          <button
            key={`${chapter.number}-${chapter.title ?? ""}`}
            type="button"
            onClick={() => openChapterArtifact(chapter.number)}
            className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
              isActive ? "bg-secondary/70" : "hover:bg-secondary/50"
            }`}
            title={chapterStatusLabel(chapter.status)}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${chapterStatusDot(chapter.status)}`} />
            <span className={`flex-1 truncate text-sm ${isActive ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
              {String(chapter.number).padStart(2, "0")} {chapter.title || tr(`第${chapter.number}章`, `Chapter ${chapter.number}`)}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground/50">
              {(chapter.wordCount ?? 0).toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Chat 页：会话列表 ── */

export function SessionListPanel({ nav }: { readonly nav: StudioNav }) {
  const sessions = useChatStore((s) => s.sessions);
  const sessionIdsByBook = useChatStore((s) => s.sessionIdsByBook);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const bookDataVersion = useChatStore((s) => s.bookDataVersion);
  const loadSessionList = useChatStore((s) => s.loadSessionList);
  const loadSessionDetail = useChatStore((s) => s.loadSessionDetail);
  const activateSession = useChatStore((s) => s.activateSession);
  const createDraftSession = useChatStore((s) => s.createDraftSession);
  const setInput = useChatStore((s) => s.setInput);

  useEffect(() => {
    void loadSessionList(null);
  }, [bookDataVersion, loadSessionList]);

  const projectSessions = useMemo(
    () =>
      (sessionIdsByBook["__null__"] ?? [])
        .map((sessionId) => sessions[sessionId])
        .filter((session): session is NonNullable<typeof session> => {
          if (!session) return false;
          return Boolean(session.title)
            || session.messages.length > 0
            || session.isDraft
            || session.sessionId === activeSessionId;
        }),
    [activeSessionId, sessionIdsByBook, sessions],
  );

  const openSession = (sessionId: string) => {
    setInput("");
    activateSession(sessionId);
    setProjectChatSessionId(sessionId);
    nav.toChat();
    void loadSessionDetail(sessionId);
  };

  const handleCreateSession = () => {
    const sessionId = createDraftSession(null, "chat");
    setProjectChatSessionId(sessionId);
    setInput("");
    nav.toChat();
  };

  return (
    <div className="p-2">
      {projectSessions.map((session) => {
        const isActive = activeSessionId === session.sessionId;
        const firstUserMsg = session.messages.find((m) => m.role === "user")?.content?.trim();
        const label = session.title
          ?? (firstUserMsg ? (firstUserMsg.replace(/\s+/g, " ").slice(0, 20) || tr("新会话", "New session")) : tr("新会话", "New session"));
        return (
          <button
            key={session.sessionId}
            type="button"
            onClick={() => openSession(session.sessionId)}
            className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
              isActive ? "bg-secondary/70" : "hover:bg-secondary/50"
            }`}
          >
            <span className={`flex-1 truncate text-sm ${isActive ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
              {label}
            </span>
            {session.isStreaming && <Loader2 size={12} className="shrink-0 animate-spin text-primary" />}
          </button>
        );
      })}
      {projectSessions.length === 0 && (
        <p className="px-3 py-6 text-center text-xs italic text-muted-foreground/60">{tr("还没有会话", "No sessions yet")}</p>
      )}
      <button
        type="button"
        onClick={handleCreateSession}
        className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground/70 transition-colors hover:bg-secondary/50 hover:text-foreground"
      >
        <Plus size={13} />
        <span>{tr("新建会话", "New session")}</span>
      </button>
    </div>
  );
}
