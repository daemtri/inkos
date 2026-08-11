import { describe, expect, it } from "vitest";
import { buildShortFictionExportArtifact } from "../interaction/export-artifact.js";

const markdown = "# 大唐女帝\n\n冷宫签到，诛仙开局。\n\n第二章内容。";

describe("buildShortFictionExportArtifact", () => {
  it("returns the markdown body as plain text for txt", async () => {
    const artifact = await buildShortFictionExportArtifact({
      storyId: "demo",
      title: "大唐女帝",
      markdown,
      format: "txt",
    });

    expect(artifact.fileName).toBe("demo.txt");
    expect(artifact.contentType).toContain("text/plain");
    expect(artifact.payload).toBe(markdown);
  });

  it("returns markdown content type for md", async () => {
    const artifact = await buildShortFictionExportArtifact({
      storyId: "demo",
      title: "大唐女帝",
      markdown,
      format: "md",
    });

    expect(artifact.fileName).toBe("demo.md");
    expect(artifact.contentType).toContain("text/markdown");
    expect(artifact.payload).toBe(markdown);
  });

  it("builds a valid epub zip payload", async () => {
    const artifact = await buildShortFictionExportArtifact({
      storyId: "demo",
      title: "大唐女帝",
      markdown,
      format: "epub",
    });

    expect(artifact.fileName).toBe("demo.epub");
    expect(artifact.contentType).toBe("application/epub+zip");
    expect(Buffer.isBuffer(artifact.payload)).toBe(true);
    expect((artifact.payload as Buffer).subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("defaults to txt when format is omitted", async () => {
    const artifact = await buildShortFictionExportArtifact({
      storyId: "demo",
      title: "大唐女帝",
      markdown,
    });

    expect(artifact.format).toBe("txt");
    expect(artifact.fileName).toBe("demo.txt");
  });
});
