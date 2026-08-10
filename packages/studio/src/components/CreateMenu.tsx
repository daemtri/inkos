import type { TFunction } from "../hooks/use-i18n";
import { setProjectChatSessionId } from "../pages/chat-page-state";
import { useChatStore } from "../store/chat";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  BookPlus,
  BookCopy,
  Feather,
  FileInput,
  Languages,
  Rows3,
  Clapperboard,
  ScrollText,
  Wand2,
} from "lucide-react";
import { CREATE_ENTRIES, type CreateEntryId, type CreateNav } from "./app-shell-model";

const CREATE_ICONS: Record<CreateEntryId, React.ReactNode> = {
  novel: <BookPlus size={15} />,
  short: <ScrollText size={15} />,
  script: <Clapperboard size={15} />,
  storyboard: <Rows3 size={15} />,
  fanfic: <Feather size={15} />,
  spinoff: <BookCopy size={15} />,
  imitation: <Wand2 size={15} />,
  continuation: <FileInput size={15} />,
  translation: <Languages size={15} />,
};

/**
 * 「新建创作」菜单：IconRail 与 Dashboard 的「新建书籍」按钮共用。
 * 行为与旧 Sidebar 的创作区块一致：长篇进建书会话，短篇/剧本/分镜起草项目会话
 * 跳 Chat，同人/番外/仿写/续写进导入页对应标签，翻译进翻译页。
 */
export function CreateMenu({ nav, t, side = "right", align = "start", triggerClassName, triggerLabel, children }: {
  readonly nav: CreateNav;
  readonly t: TFunction;
  readonly side?: "right" | "bottom";
  readonly align?: "start" | "center" | "end";
  readonly triggerClassName?: string;
  /** 触发按钮的无障碍标注与悬停提示（图标按钮时必传）。 */
  readonly triggerLabel?: string;
  readonly children: React.ReactNode;
}) {
  const createDraftSession = useChatStore((s) => s.createDraftSession);
  const setInput = useChatStore((s) => s.setInput);

  // 与旧 Sidebar 一致：短篇/剧本/分镜直接起草一个项目会话并跳转 Chat。
  const launchProjectMode = (kind: "short" | "script" | "storyboard") => {
    const sessionId = createDraftSession(null, kind);
    setProjectChatSessionId(sessionId);
    setInput("");
    nav.toChat();
  };

  const handleCreate = (id: CreateEntryId) => {
    if (id === "novel") nav.toBookCreate();
    else if (id === "short" || id === "script" || id === "storyboard") launchProjectMode(id);
    else if (id === "fanfic") nav.toImport("fanfic");
    else if (id === "spinoff") nav.toImport("spinoff");
    else if (id === "imitation") nav.toImport("imitation");
    else if (id === "continuation") nav.toImport("chapters");
    else nav.toTranslation();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={triggerClassName}
        title={triggerLabel}
        aria-label={triggerLabel}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} sideOffset={10} className="w-52">
        {/* base-ui 的 GroupLabel 必须包在 Menu.Group 里，否则菜单一打开就抛错 */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
            {t("nav.createSection")}
          </DropdownMenuLabel>
          {CREATE_ENTRIES.map((entry) => (
            <DropdownMenuItem key={entry.id} onClick={() => handleCreate(entry.id)} className="gap-2.5">
              <span className="text-muted-foreground">{CREATE_ICONS[entry.id]}</span>
              <span>{t(entry.labelKey)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
