import { describe, expect, it } from "vitest";
import { parseBookRules } from "../models/book-rules.js";

describe("detectNarrativePerson (via parseBookRules)", () => {
  it("keeps third person when the POV section declares 第三人称 first and only mentions 第一人称 in a later exception clause", () => {
    // Real-world shape from a generated book_rules.md: the 视角 section opens
    // with the third-person declaration, then grants a first-person exception.
    const raw = [
      "## 写作规则",
      "",
      "### 视角",
      "- 全书严格使用第三人称有限视角，绑定主角的感官与内心活动。",
      "- 仅在主角复制到他人记忆碎片的章节，允许插入第一人称碎片式段落。",
      "- 禁止直接描写其他角色的内心独白。",
    ].join("\n");

    expect(parseBookRules(raw)?.rules.narrativePerson).toBe("third");
  });

  it("keeps first person when the POV section declares 第一人称 even if a prohibition mentions 第三人称", () => {
    const raw = [
      "## 叙事人称",
      "- 第一人称",
      "",
      "## 禁止事项",
      "- 禁止切换为第三人称全知视角",
    ].join("\n");

    expect(parseBookRules(raw)?.rules.narrativePerson).toBe("first");
  });

  it("keeps third person for a plain 叙事人称 section", () => {
    const raw = ["## 叙事人称", "第三人称单一视角。"].join("\n");
    expect(parseBookRules(raw)?.rules.narrativePerson).toBe("third");
  });

  it("keeps first person for a plain 叙事人称 section", () => {
    const raw = ["## 叙事人称", "- 第一人称"].join("\n");
    expect(parseBookRules(raw)?.rules.narrativePerson).toBe("first");
  });

  it("returns undefined when no person is mentioned at all", () => {
    const raw = ["## 主角", "- 名字：沈临", "", "## 禁止事项", "- 不要突然开挂。"].join("\n");
    expect(parseBookRules(raw)?.rules.narrativePerson).toBeUndefined();
  });
});
