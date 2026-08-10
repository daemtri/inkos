import { useState, useEffect, useCallback, lazy, Suspense, type ReactNode } from "react";
import { useHashRoute } from "./hooks/use-hash-route";
import type { HashRoute } from "./hooks/use-hash-route";
import { AppShell } from "./components/AppShell";
import { ContextPanel, RecentBooksPanel, ChapterListPanel, SessionListPanel } from "./components/ContextPanel";
import { LanguageToggle } from "./components/LanguageToggle";
import { ProjectArtifactDrawer } from "./components/chat/ProjectArtifactDrawer";
import { Dashboard } from "./pages/Dashboard";
import { ChatPage } from "./pages/ChatPage";
import { BookWorkbench } from "./pages/BookWorkbench";
import { BookDetail } from "./pages/BookDetail";
import { ChapterReader } from "./pages/ChapterReader";
import { Analytics } from "./pages/Analytics";
import { ServiceListPage } from "./pages/ServiceListPage";
import { ServiceDetailPage } from "./pages/ServiceDetailPage";
import { ProjectSettings } from "./pages/ProjectSettings";
import { TruthFiles } from "./pages/TruthFiles";
import { DaemonControl } from "./pages/DaemonControl";
import { LogViewer } from "./pages/LogViewer";
import { GenreManager } from "./pages/GenreManager";
import { StyleManager } from "./pages/StyleManager";
import { TranslationManager } from "./pages/TranslationManager";
import { ImportManager } from "./pages/ImportManager";
import { RadarView } from "./pages/RadarView";
import { DoctorView } from "./pages/DoctorView";
import { ToolsHub } from "./pages/ToolsHub";
import { SettingsHub } from "./pages/SettingsHub";
import { StoryPlayer } from "./pages/StoryPlayer";
import { StoryGraphTree } from "./pages/StoryGraphTree";
const FlowView = lazy(() => import("./pages/FlowView"));
const FilmWizard = lazy(() => import("./pages/FilmWizard"));
import { LanguageSelector } from "./pages/LanguageSelector";
import { useSSE } from "./hooks/use-sse";
import { useSessionEvents } from "./hooks/use-session-events";
import { useTheme, nextThemeMode } from "./hooks/use-theme";
import { useI18n } from "./hooks/use-i18n";
import { setAppLanguage, tr } from "./lib/app-language";
import { fetchJson, postApi, putApi, useApi, UNAUTHORIZED_EVENT } from "./hooks/use-api";
import { useChatStore } from "./store/chat";
import { LoginPage } from "./pages/LoginPage";

export type { HashRoute as Route } from "./hooks/use-hash-route";

export function deriveActiveBookId(route: HashRoute): string | undefined {
  if ("bookId" in route) return route.bookId;
  return undefined;
}

export function isBookCreateChatRoute(route: HashRoute): boolean {
  return route.page === "book-create";
}

export function deriveStartupGate(input: {
  readonly ready: boolean;
  readonly projectError: string | null;
}): "ready" | "loading" | "error" {
  if (input.ready) return "ready";
  return input.projectError ? "error" : "loading";
}

export function App() {
  const { route, setRoute } = useHashRoute();
  const sse = useSSE();
  const { theme, mode: themeMode, setMode: setThemeMode } = useTheme();
  const projectArtifactPath = useChatStore((s) => s.projectArtifactPath);
  const { t, lang: currentLang } = useI18n();
  const { data: project, error: projectError, refetch: refetchProject } = useApi<{ language: string; languageExplicit: boolean }>("/project");
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [ready, setReady] = useState(false);
  const [authState, setAuthState] = useState<"checking" | "need-login" | "authed">("checking");
  const [authEnabled, setAuthEnabled] = useState(false);

  // 启动时检查认证状态；authEnabled 且未认证时只渲染登录页。
  const checkAuth = useCallback(async () => {
    try {
      const status = await fetchJson<{ authEnabled: boolean; authenticated: boolean }>("/auth/status");
      setAuthEnabled(status.authEnabled);
      setAuthState(status.authEnabled && !status.authenticated ? "need-login" : "authed");
    } catch {
      // 状态接口不可达（如服务未起）时不把用户锁在登录页，交给后续的项目配置错误屏兜底。
      setAuthState("authed");
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Cookie 过期或登出后，任一请求的 401 都会广播此事件，跳回登录页。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleUnauthorized = () => setAuthState("need-login");
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const handleLoginSuccess = useCallback(() => {
    void checkAuth();
    // 未认证时 /project 已经 401 失败过，登录成功后需要重新拉取。
    void refetchProject();
  }, [checkAuth, refetchProject]);

  const handleLogout = useCallback(async () => {
    await postApi("/auth/logout").catch(() => undefined);
    await checkAuth();
  }, [checkAuth]);

  const handleSelectLanguage = useCallback(async (lang: "zh" | "en") => {
    await putApi("/project", { language: lang });
    refetchProject();
  }, [refetchProject]);

  // 全局语言同步：app-language 是模块级单例，供用不了 hook 的代码（lib 纯函数、
  // store slice）读取。这里在渲染期同步赋值，让子组件在同一次渲染里调用 tr() 时
  // 就读到正确语言（只用 effect 的话，effect 要等本次渲染提交后才执行，本次渲染
  // 里的 tr() 会读到旧语言）。赋值是幂等的模块变量写入，StrictMode 重复渲染无影
  // 响；下面的 effect 在语言加载完成和切换时再设置一次，保证提交后的值也正确。
  setAppLanguage(currentLang);
  useEffect(() => {
    setAppLanguage(currentLang);
  }, [currentLang]);

  useEffect(() => {
    if (project) {
      if (!project.languageExplicit) {
        setShowLanguageSelector(true);
      }
      setReady(true);
    }
  }, [project]);

  useSessionEvents(sse, route, setRoute);

  const nav = {
    toDashboard: () => setRoute({ page: "dashboard" }),
    toChat: () => setRoute({ page: "chat" }),
    toBook: (bookId: string) => setRoute({ page: "book", bookId }),
    toBookSettings: (bookId: string) => setRoute({ page: "book-settings", bookId }),
    toBookCreate: () => setRoute({ page: "book-create" }),
    toChapter: (bookId: string, chapterNumber: number) =>
      setRoute({ page: "chapter", bookId, chapterNumber }),
    toAnalytics: (bookId: string) => setRoute({ page: "analytics", bookId }),
    toServices: () => setRoute({ page: "services" }),
    toProjectSettings: () => setRoute({ page: "project-settings" }),
    toServiceDetail: (id: string) => setRoute({ page: "service-detail", serviceId: id }),
    toTruth: (bookId: string) => setRoute({ page: "truth", bookId }),
    toDaemon: () => setRoute({ page: "daemon" }),
    toLogs: () => setRoute({ page: "logs" }),
    toGenres: () => setRoute({ page: "genres" }),
    toStyle: () => setRoute({ page: "style" }),
    toTranslation: () => setRoute({ page: "translation" }),
    toImport: (tab?: "chapters" | "canon" | "fanfic" | "spinoff" | "imitation") => setRoute({ page: "import", ...(tab ? { tab } : {}) }),
    toRadar: () => setRoute({ page: "radar" }),
    toDoctor: () => setRoute({ page: "doctor" }),
    toTools: () => setRoute({ page: "tools" }),
    toSettingsHub: () => setRoute({ page: "settings-hub" }),
    toPlay: (projectId: string) => setRoute({ page: "play", projectId }),
    toFilm: (projectId: string) => setRoute({ page: "film", projectId }),
    toFlow: (projectId: string) => setRoute({ page: "flow", projectId }),
    toFilmAuthor: (projectId: string) => setRoute({ page: "film-author", projectId }),
    toFilmStudio: (projectId: string) => setRoute({ page: "film-studio", projectId }),
  };

  const activeBookId = deriveActiveBookId(route);
  const activePage =
    activeBookId
      ? `book:${activeBookId}`
      : route.page === "service-detail"
        ? "services"
        : route.page;

  const startupGate = deriveStartupGate({ ready, projectError });

  if (authState === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (authState === "need-login") {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  if (startupGate === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-destructive">无法加载项目配置 / Failed to load project config</h1>
            <p className="mt-2 text-sm text-muted-foreground break-all">{projectError}</p>
          </div>
          {/* 项目配置没加载出来，语言未知，所以这屏中英双语并排展示。 */}
          <p className="text-sm text-muted-foreground">
            请检查项目根目录下的 inkos.json 是否存在且为合法 JSON，然后重试。
            <br />
            Check that inkos.json in the project root exists and is valid JSON, then retry.
          </p>
          <button
            type="button"
            onClick={() => refetchProject()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            重试 / Retry
          </button>
        </div>
      </div>
    );
  }

  if (startupGate === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (showLanguageSelector) {
    return (
      <LanguageSelector
        onSelect={async (lang) => {
          await postApi("/project/language", { language: lang });
          setShowLanguageSelector(false);
          refetchProject();
        }}
      />
    );
  }

  // ── 整站唯一外壳：AppShell（IconRail + ContextPanel + 主工作区）──
  // 经典/新版布局切换只存在于书籍工作台页内部（见 BookWorkbench）。
  {
    const scrollPage = (node: ReactNode, wide = false) => (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={`mx-auto px-6 py-12 fade-in md:px-12 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>{node}</div>
      </div>
    );

    const contextPanel =
      route.page === "dashboard" ? (
        <ContextPanel title={t("context.recentBooks")} t={t}>
          <RecentBooksPanel nav={nav} sse={sse} />
        </ContextPanel>
      ) : route.page === "book" ? (
        <ContextPanel title={t("context.chapters")} t={t}>
          <ChapterListPanel bookId={route.bookId} />
        </ContextPanel>
      ) : route.page === "chat" ? (
        <ContextPanel title={t("context.sessions")} t={t}>
          <SessionListPanel nav={nav} />
        </ContextPanel>
      ) : undefined;

    return (
      <AppShell
        nav={nav}
        activePage={activePage}
        t={t}
        themeMode={themeMode}
        onCycleTheme={() => setThemeMode(nextThemeMode(themeMode))}
        authEnabled={authEnabled}
        onLogout={() => void handleLogout()}
        contextPanel={contextPanel}
        headerExtras={
          <LanguageToggle lang={currentLang} onSelect={(lang) => void handleSelectLanguage(lang)} />
        }
      >
        {route.page === "dashboard" && scrollPage(<Dashboard nav={nav} sse={sse} theme={theme} t={t} />)}
        {isBookCreateChatRoute(route) && (
          <ChatPage mode="book-create" nav={nav} theme={theme} t={t} sse={sse} />
        )}
        {route.page === "chat" && (
          <div className="flex min-h-0 min-w-0 flex-1">
            <ChatPage mode="project-chat" nav={nav} theme={theme} t={t} sse={sse} hideArtifactDrawer />
            {projectArtifactPath && (
              <aside className="w-[420px] shrink-0 border-l border-border/60" aria-label={t("workbench.artifactPreview")}>
                <ProjectArtifactDrawer variant="inline" />
              </aside>
            )}
          </div>
        )}
        {route.page === "book" && (
          <BookWorkbench bookId={route.bookId} nav={nav} theme={theme} t={t} sse={sse} />
        )}
        {route.page === "book-settings" && scrollPage(<BookDetail bookId={route.bookId} nav={nav} theme={theme} t={t} sse={sse} />)}
        {route.page === "chapter" && scrollPage(<ChapterReader bookId={route.bookId} chapterNumber={route.chapterNumber} nav={nav} theme={theme} t={t} />, true)}
        {route.page === "analytics" && scrollPage(<Analytics bookId={route.bookId} nav={nav} theme={theme} t={t} />)}
        {route.page === "services" && scrollPage(<ServiceListPage nav={nav} />)}
        {route.page === "project-settings" && scrollPage(<ProjectSettings nav={nav} theme={theme} t={t} />)}
        {route.page === "service-detail" && scrollPage(<ServiceDetailPage serviceId={route.serviceId} nav={nav} />)}
        {route.page === "truth" && scrollPage(<TruthFiles bookId={route.bookId} nav={nav} theme={theme} t={t} />)}
        {route.page === "daemon" && scrollPage(<DaemonControl nav={nav} theme={theme} t={t} sse={sse} />)}
        {route.page === "logs" && scrollPage(<LogViewer nav={nav} theme={theme} t={t} />)}
        {route.page === "genres" && scrollPage(<GenreManager nav={nav} theme={theme} t={t} />)}
        {route.page === "style" && scrollPage(<StyleManager nav={nav} theme={theme} t={t} />)}
        {route.page === "translation" && scrollPage(<TranslationManager nav={nav} theme={theme} t={t} />, true)}
        {route.page === "import" && scrollPage(<ImportManager nav={nav} theme={theme} t={t} initialTab={route.tab} />)}
        {route.page === "radar" && scrollPage(<RadarView nav={nav} theme={theme} t={t} />)}
        {route.page === "doctor" && scrollPage(<DoctorView nav={nav} theme={theme} t={t} />)}
        {route.page === "tools" && scrollPage(<ToolsHub nav={nav} t={t} />)}
        {route.page === "settings-hub" && scrollPage(<SettingsHub nav={nav} t={t} />)}
        {route.page === "play" && scrollPage(<StoryPlayer projectId={route.projectId} nav={nav} theme={theme} t={t} />)}
        {route.page === "film" && scrollPage(<StoryGraphTree projectId={route.projectId} nav={nav} theme={theme} t={t} />)}
        {route.page === "film-author" && (
          <ChatPage activeBookId={route.projectId} mode="interactive-film-authoring" nav={nav} theme={theme} t={t} sse={sse} />
        )}
        {route.page === "film-studio" && (
          <div className="relative min-h-0 flex-1">
            <Suspense fallback={<div className="p-6 text-sm">{tr("加载创作向导…", "Loading creation wizard…")}</div>}>
              <FilmWizard projectId={route.projectId} nav={nav} theme={theme} t={t} sse={sse} />
            </Suspense>
          </div>
        )}
        {route.page === "flow" && (
          <div className="relative min-h-0 flex-1">
            <Suspense fallback={<div className="p-6 text-sm">{tr("加载流程图…", "Loading flow view…")}</div>}>
              <FlowView projectId={route.projectId} nav={nav} theme={theme} t={t} />
            </Suspense>
          </div>
        )}
      </AppShell>
    );
  }
}
