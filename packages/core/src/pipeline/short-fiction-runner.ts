import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AgentContext } from "../agents/base.js";
import {
  SHORT_FICTION_DEFAULT_CHAPTERS,
  SHORT_FICTION_DEFAULT_CHARS_PER_CHAPTER,
  SHORT_FICTION_EN_DEFAULT_WORDS_PER_CHAPTER,
  SHORT_FICTION_EN_MAX_WORDS_PER_CHAPTER,
  SHORT_FICTION_EN_MIN_WORDS_PER_CHAPTER,
  SHORT_FICTION_MAX_CHAPTERS,
  SHORT_FICTION_MAX_CHARS_PER_CHAPTER,
  SHORT_FICTION_MIN_CHAPTERS,
  SHORT_FICTION_MIN_CHARS_PER_CHAPTER,
  ShortFictionDraftReviewerAgent,
  ShortFictionDraftReviserAgent,
  ShortFictionOutlineAgent,
  ShortFictionOutlineReviewerAgent,
  ShortFictionOutlineReviserAgent,
  ShortFictionPackagingAgent,
  ShortFictionWriterAgent,
  findEmptyShortFictionChapters,
  formatShortFictionChapterHeading,
  renderShortFictionDraftMarkdown,
  validateShortFictionDraftForFinal,
  type ShortFictionBatchDraft,
  type ShortFictionLanguage,
  type ShortFictionReference,
  type ShortFictionSalesPackage,
} from "../agents/short-fiction.js";
import { safeChildPath } from "../utils/path-safety.js";
import { toPosixPath as projectPath } from "../utils/posix-path.js";

const SHORT_FICTION_DRAFT_COMPLETION_ATTEMPTS = 3;

export interface ShortFictionRunRuntimes {
  readonly planner: AgentContext;
  readonly outlineReview: AgentContext;
  readonly writer: AgentContext;
  readonly draftReview: AgentContext;
  readonly revise: AgentContext;
  readonly package: AgentContext;
}

export interface ShortFictionRunOptions {
  readonly projectRoot: string;
  readonly direction: string;
  readonly runtimes: ShortFictionRunRuntimes;
  readonly reference?: ShortFictionReference;
  readonly storyId?: string;
  readonly outDir?: string;
  readonly chapterCount?: number;
  // Per-chapter length in the language's native unit: zh characters or en words.
  readonly charsPerChapter?: number;
  readonly language?: ShortFictionLanguage;
  readonly signal?: AbortSignal;
  readonly onProgress?: (message: string) => void;
}

export interface ShortFictionRunResult {
  readonly storyId: string;
  readonly outlinePath: string;
  readonly outlineReviewPath: string;
  readonly draftReviewPath: string;
  readonly finalMarkdownPath: string;
  readonly finalJsonPath: string;
  readonly salesPackagePath: string;
}

export async function runShortFictionProduction(
  options: ShortFictionRunOptions,
): Promise<ShortFictionRunResult> {
  const root = options.projectRoot;
  const outDir = normalizeOutputDir(options.outDir ?? "shorts");
  const providedStoryId = options.storyId ? safeSegment(options.storyId) : undefined;

  // A stable storyId lets a re-run resume from disk instead of redoing finished
  // work — a transient failure in a late stage used to throw the whole short
  // away (orphaning outline/drafts). If it already finished, return it as-is.
  if (
    providedStoryId
    && await projectFileExists(root, join(outDir, providedStoryId, "final", "full.md"))
    && !await isFailedShortRun(root, join(outDir, providedStoryId, "status.json"))
  ) {
    return buildShortRunResult(providedStoryId, join(outDir, providedStoryId));
  }

  try {
    return await produceShort(options, root, outDir, providedStoryId);
  } catch (error) {
    // Mark the partial output as failed so drafts can't masquerade as a short.
    if (providedStoryId) {
      await writeJson(root, join(outDir, providedStoryId, "status.json"), {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function produceShort(
  options: ShortFictionRunOptions,
  root: string,
  outDir: string,
  providedStoryId: string | undefined,
): Promise<ShortFictionRunResult> {
  const language = options.language ?? "zh";
  const chapterCount = boundedInteger(
    options.chapterCount,
    SHORT_FICTION_DEFAULT_CHAPTERS,
    "chapterCount",
    SHORT_FICTION_MIN_CHAPTERS,
    SHORT_FICTION_MAX_CHAPTERS,
  );
  // charsPerChapter is the language's native unit: zh chars (900-1200) or en words (600-800).
  const charsPerChapter = language === "en"
    ? boundedInteger(
        options.charsPerChapter,
        SHORT_FICTION_EN_DEFAULT_WORDS_PER_CHAPTER,
        "charsPerChapter",
        SHORT_FICTION_EN_MIN_WORDS_PER_CHAPTER,
        SHORT_FICTION_EN_MAX_WORDS_PER_CHAPTER,
      )
    : boundedInteger(
        options.charsPerChapter,
        SHORT_FICTION_DEFAULT_CHARS_PER_CHAPTER,
        "charsPerChapter",
        SHORT_FICTION_MIN_CHARS_PER_CHAPTER,
        SHORT_FICTION_MAX_CHARS_PER_CHAPTER,
      );

  // Resume the (3-stage) outline from disk if v002 already exists for this id —
  // the writer + everything downstream only need the outline markdown.
  const resumedOutline = providedStoryId
    ? await tryReadProjectText(root, join(outDir, providedStoryId, "outline", "v002.md"))
    : undefined;

  let outlineMarkdown: string;
  let storyId: string;
  let baseDir: string;
  if (providedStoryId && resumedOutline?.trim()) {
    storyId = providedStoryId;
    baseDir = join(outDir, storyId);
    outlineMarkdown = resumedOutline;
    options.onProgress?.("Resuming from existing outline (skipping outline stages)...");
  } else {
    options.onProgress?.("Creating short fiction outline...");
    const outlineAgent = new ShortFictionOutlineAgent(options.runtimes.planner);
    const outlineV1 = await outlineAgent.createOutline({
      direction: options.direction,
      chapterCount,
      charsPerChapter,
      reference: options.reference,
      language,
    });

    storyId = providedStoryId ?? safeSegment(slugify(outlineV1.storyTitle || options.direction));
    baseDir = join(outDir, storyId);
    await writeText(root, join(baseDir, "outline", "v001.md"), outlineV1.rawContent);

    options.onProgress?.("Reviewing outline...");
    const outlineReviewer = new ShortFictionOutlineReviewerAgent(options.runtimes.outlineReview);
    const outlineReview = await outlineReviewer.reviewOutline({
      direction: options.direction,
      outline: outlineV1,
      reference: options.reference,
      language,
    });
    await writeText(root, join(baseDir, "reviews", "outline-v001.md"), outlineReview);

    options.onProgress?.("Revising outline once...");
    const outlineReviser = new ShortFictionOutlineReviserAgent(options.runtimes.planner);
    const outlineV2 = await outlineReviser.reviseOutline({
      direction: options.direction,
      outline: outlineV1,
      review: outlineReview,
      reference: options.reference,
      chapterCount,
      charsPerChapter,
      language,
    });
    await writeText(root, join(baseDir, "outline", "v002.md"), outlineV2.rawContent);
    outlineMarkdown = outlineV2.rawContent;
  }

  let finalDraft: ShortFictionBatchDraft;
  let revisionWarning: string | undefined;
  let salesPackage: ShortFictionSalesPackage;
  try {
    options.onProgress?.("Writing full short fiction draft...");
    const writer = new ShortFictionWriterAgent(options.runtimes.writer);
    let draftV1 = await writer.writeDraft({
      direction: options.direction,
      outlineMarkdown,
      chapterCount,
      charsPerChapter,
      language,
    });
    let missingFromDraft = findEmptyShortFictionChapters(draftV1);
    if (missingFromDraft.length > 0) {
      await writeDraftArtifacts(root, baseDir, "v001-partial", draftV1, language);
      for (let attempt = 1; missingFromDraft.length > 0 && attempt <= SHORT_FICTION_DRAFT_COMPLETION_ATTEMPTS; attempt += 1) {
        options.onProgress?.(`Completing missing short fiction chapters: ${missingFromDraft.join(", ")}...`);
        draftV1 = await writer.continueDraft({
          direction: options.direction,
          outlineMarkdown,
          chapterCount,
          charsPerChapter,
          language,
          draft: draftV1,
        });
        missingFromDraft = findEmptyShortFictionChapters(draftV1);
        if (missingFromDraft.length > 0) {
          await writeDraftArtifacts(root, baseDir, "v001-partial", draftV1, language);
        }
      }
    }
    validateShortFictionDraftForFinal(draftV1, { expectedChapters: chapterCount });
    await writeDraftArtifacts(root, baseDir, "v001", draftV1, language);

    options.onProgress?.("Reviewing full draft...");
    const draftReviewer = new ShortFictionDraftReviewerAgent(options.runtimes.draftReview);
    const draftReview = await draftReviewer.reviewDraft({
      direction: options.direction,
      outlineMarkdown,
      draft: draftV1,
      chapterCount,
      charsPerChapter,
      language,
    });
    await writeText(root, join(baseDir, "reviews", "draft-v001.md"), draftReview);

    finalDraft = draftV1;
    options.onProgress?.("Revising full draft once...");
    const reviser = new ShortFictionDraftReviserAgent(options.runtimes.revise);
    try {
      const draftV2 = await reviser.reviseDraft({
        direction: options.direction,
        outlineMarkdown,
        draft: draftV1,
        review: draftReview,
        chapterCount,
        charsPerChapter,
        language,
      });
      validateShortFictionDraftForFinal(draftV2, { expectedChapters: chapterCount });
      await writeDraftArtifacts(root, baseDir, "v002", draftV2, language);
      finalDraft = draftV2;
    } catch (error) {
      revisionWarning = error instanceof Error ? error.message : String(error);
      await writeText(root, join(baseDir, "reviews", "draft-v002-warning.md"), language === "en"
        ? [
            "# Second revision not adopted",
            "",
            "The system refused to overwrite the complete first draft with an incomplete or unparsable revision.",
            "",
            "## Reason",
            "",
            revisionWarning,
          ].join("\n")
        : [
            "# 第二轮改稿未采用",
            "",
            "系统没有用不完整或解析失败的改稿覆盖完整首稿。",
            "",
            "## 原因",
            "",
            revisionWarning,
          ].join("\n"));
    }

    await writeFinalArtifacts(root, baseDir, finalDraft, language);

    options.onProgress?.("Generating synopsis and selling points...");
    const packager = new ShortFictionPackagingAgent(options.runtimes.package);
    salesPackage = await packager.generatePackage({
      direction: options.direction,
      outlineMarkdown,
      draft: finalDraft,
      language,
    });
    await writePackageArtifacts(root, baseDir, salesPackage, language);
  } catch (error) {
    await writeShortRunStatus(root, baseDir, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  }

  if (revisionWarning) {
    await writeShortRunStatus(root, baseDir, {
      status: "complete",
      warning: `revision skipped: ${revisionWarning}`,
    }).catch(() => undefined);
  }

  return buildShortRunResult(storyId, baseDir);
}

function buildShortRunResult(
  storyId: string,
  baseDir: string,
): ShortFictionRunResult {
  return {
    storyId,
    outlinePath: projectPath(join(baseDir, "outline", "v002.md")),
    outlineReviewPath: projectPath(join(baseDir, "reviews", "outline-v001.md")),
    draftReviewPath: projectPath(join(baseDir, "reviews", "draft-v001.md")),
    finalMarkdownPath: projectPath(join(baseDir, "final", "full.md")),
    finalJsonPath: projectPath(join(baseDir, "final", "short-story.json")),
    salesPackagePath: projectPath(join(baseDir, "final", "sales-package.md")),
  };
}

async function projectFileExists(root: string, path: string): Promise<boolean> {
  try {
    await access(safeChildPath(root, path));
    return true;
  } catch {
    return false;
  }
}

async function isFailedShortRun(root: string, path: string): Promise<boolean> {
  const raw = await tryReadProjectText(root, path);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { status?: unknown };
    return parsed.status === "failed";
  } catch {
    return false;
  }
}

async function tryReadProjectText(root: string, path: string): Promise<string | undefined> {
  try {
    return await readFile(safeChildPath(root, path), "utf-8");
  } catch {
    return undefined;
  }
}

async function writeDraftArtifacts(
  root: string,
  baseDir: string,
  version: string,
  draft: ShortFictionBatchDraft,
  language: ShortFictionLanguage = "zh",
): Promise<void> {
  const draftDir = join(baseDir, "drafts", version);
  await writeText(root, join(draftDir, "full.md"), renderShortFictionDraftMarkdown(draft, language));
  await writeJson(root, join(draftDir, "draft.json"), draft);
  await Promise.all(draft.chapters.map((chapter) =>
    writeText(root, join(draftDir, "chapters", `${String(chapter.number).padStart(4, "0")}.md`), [
      `# ${formatShortFictionChapterHeading(chapter.number, chapter.title, language)}`,
      "",
      chapter.content,
    ].join("\n")),
  ));
}

async function writeFinalArtifacts(
  root: string,
  baseDir: string,
  draft: ShortFictionBatchDraft,
  language: ShortFictionLanguage = "zh",
): Promise<void> {
  const finalDir = join(baseDir, "final");
  const markdown = renderShortFictionDraftMarkdown(draft, language);
  await writeText(root, join(finalDir, "full.md"), markdown);
  await writeText(root, join(finalDir, `${safeFileName(draft.storyTitle)}.md`), markdown);
  await writeJson(root, join(finalDir, "short-story.json"), draft);
  await Promise.all(draft.chapters.map((chapter) =>
    writeText(root, join(finalDir, "chapters", `${String(chapter.number).padStart(4, "0")}.md`), [
      `# ${formatShortFictionChapterHeading(chapter.number, chapter.title, language)}`,
      "",
      chapter.content,
    ].join("\n")),
  ));
}

async function writePackageArtifacts(
  root: string,
  baseDir: string,
  salesPackage: ShortFictionSalesPackage,
  language: ShortFictionLanguage = "zh",
): Promise<void> {
  const finalDir = join(baseDir, "final");
  const headings = language === "en"
    ? { intro: "## Synopsis", sellingPoints: "## Selling Points" }
    : { intro: "## 简介", sellingPoints: "## 卖点" };
  await writeJson(root, join(finalDir, "sales-package.json"), salesPackage);
  await writeText(root, join(finalDir, "sales-package.md"), [
    `# ${salesPackage.title}`,
    "",
    headings.intro,
    "",
    salesPackage.intro,
    "",
    headings.sellingPoints,
    "",
    ...salesPackage.sellingPoints.map((point) => `- ${point}`),
  ].join("\n"));
}

async function writeShortRunStatus(
  root: string,
  baseDir: string,
  value: Record<string, unknown>,
): Promise<void> {
  await writeJson(root, join(baseDir, "status.json"), {
    ...value,
    updatedAt: new Date().toISOString(),
  });
}

async function writeJson(root: string, path: string, value: unknown): Promise<void> {
  await writeText(root, path, JSON.stringify(value, null, 2));
}

async function writeText(root: string, path: string, value: string): Promise<void> {
  const resolved = safeChildPath(root, path);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${value.trimEnd()}\n`, "utf-8");
}

function normalizeOutputDir(value: string): string {
  const trimmed = value.trim() || "shorts";
  const normalized = projectPath(trimmed).replace(/^\/+/u, "").replace(/\/+$/u, "") || "shorts";
  safeChildPath("/", normalized);
  return normalized;
}

function boundedInteger(value: number | undefined, fallback: number, name: string, min: number, max: number): number {
  const parsed = value ?? fallback;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `short-${Date.now()}`;
}

function safeSegment(value: string): string {
  const cleaned = value
    .replace(/[\\/:\0*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!cleaned || cleaned === "." || cleaned === "..") return `short-${Date.now()}`;
  return cleaned;
}

function safeFileName(value: string): string {
  const cleaned = value
    .replace(/[\\/:\0*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "short-fiction";
}
