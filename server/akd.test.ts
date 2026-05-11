import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock LLM — returns pair-based structure OR single script ───────────────
// The LLM mock needs to handle 3 different call shapes:
// 1. Pair generation → returns { scripts: [...] }
// 2. Single script regeneration → returns { hookCategory, hookAngle, hookLine, body, cta }
// 3. KB rule conversion → returns a plain string rule
let llmCallCount = 0;
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockImplementation(() => {
    llmCallCount++;
    // KB rule conversion calls return a plain string
    // We detect them by call order — after a feedback save, the next call is KB rule
    // For simplicity, always return a valid response that covers all cases
    return Promise.resolve({
      choices: [
        {
          message: {
            content: JSON.stringify({
              // Covers pair generation
              scripts: [
                {
                  hookCategory: "Curiosity",
                  hookAngle1: "hid",
                  hookLine1: "They hid this from you for years.",
                  hookAngle2: "infuriating",
                  hookLine2: "This is infuriating — and you deserve to know.",
                  body: "Hernia mesh manufacturers knew their product was failing inside people's bodies. They kept selling it anyway. Tens of thousands of people suffered.",
                  cta: "Tap below to check your eligibility for free. 30 seconds. No obligation.",
                },
                {
                  hookCategory: "Betrayal",
                  hookAngle1: "warned",
                  hookLine1: "They never warned you this could happen.",
                  hookAngle2: "knew",
                  hookLine2: "They knew. They said nothing.",
                  body: "Internal reports showed the mesh was causing damage. Infections, chronic pain, failed repairs. They said nothing.",
                  cta: "Tap below to check your eligibility for free. 30 seconds. No obligation.",
                },
                {
                  hookCategory: "Compensation",
                  hookAngle1: "settlement",
                  hookLine1: "A major settlement just opened up.",
                  hookAngle2: "qualify",
                  hookLine2: "You may qualify for significant financial compensation.",
                  body: "Courts are now awarding compensation to hernia mesh victims. If you had surgery and experienced complications, you may have a case.",
                  cta: "Tap below to check your eligibility for free. 30 seconds. No obligation.",
                },
              ],
              // Covers single script regeneration
              hookCategory: "Curiosity",
              hookAngle: "stronger",
              hookLine: "This is stronger than the original hook.",
              body: "Regenerated body text that addresses the feedback.",
              cta: "Check if you qualify — it takes 30 seconds.",
            }),
          },
        },
      ],
    });
  }),
}));

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  saveGeneratedScripts: vi.fn().mockResolvedValue(42),
  getScriptHistory: vi.fn().mockResolvedValue([]),
  getScriptById: vi.fn().mockResolvedValue(null),
  saveFeedback: vi.fn().mockResolvedValue(undefined),
  getFeedbackForScript: vi.fn().mockResolvedValue([]),
  saveKbDocument: vi.fn().mockResolvedValue(undefined),
  getKbDocuments: vi.fn().mockResolvedValue([]),
}));

// ─── Mock fs ──────────────────────────────────────────────────────────────────
vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue("# AKD Knowledge Base\n\nTest KB content."),
    appendFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  readFileSync: vi.fn().mockReturnValue("# AKD Knowledge Base\n\nTest KB content."),
  appendFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// ─── Auth context helpers ─────────────────────────────────────────────────────
function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@akdmedia.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("meta.query", () => {
  it("returns lawsuits, hookCategories, and avatars", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.meta();
    expect(result.lawsuits).toContain("Hernia Mesh");
    expect(result.lawsuits).toContain("Snapchat Abuse");
    // New exact 10 categories
    expect(result.hookCategories).toContain("Symptom");
    expect(result.hookCategories).toContain("Compensation");
    expect(result.hookCategories).toContain("Betrayal");
    expect(result.hookCategories).toContain("Curiosity");
    expect(result.hookCategories).toContain("Story");
    expect(result.hookCategories).toContain("Pattern");
    expect(result.hookCategories).toContain("Urgency");
    expect(result.hookCategories).toContain("Family");
    expect(result.hookCategories).toContain("Question");
    expect(result.hookCategories).toContain("Authority");
    expect(result.hookCategories).toHaveLength(10);
    expect(result.avatars.length).toBeGreaterThan(0);
  });
});

describe("scripts.generate — pair-based structure", () => {
  it("returns 6 scripts for 3 pairs (2 scripts per pair)", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      hookCategory: "Curiosity",
      aggressiveScale: 2,
      avatar: "Patients",
      scriptNumberStart: 1,
      pairsCount: 3,
    });

    // 3 pairs × 2 scripts = 6 total
    expect(result.scripts).toHaveLength(6);
  });

  it("each pair produces 2 scripts with different hook angles but same body and CTA", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      aggressiveScale: 2,
      avatar: "Patients",
      scriptNumberStart: 1,
      pairsCount: 3,
    });

    // Check pair 0: scripts[0] and scripts[1] share body and CTA
    const scriptA = result.scripts[0]!;
    const scriptB = result.scripts[1]!;
    expect(scriptA.pairIndex).toBe(0);
    expect(scriptB.pairIndex).toBe(0);
    expect(scriptA.variantIndex).toBe(0);
    expect(scriptB.variantIndex).toBe(1);
    expect(scriptA.body).toBe(scriptB.body);
    expect(scriptA.cta).toBe(scriptB.cta);
    // But different hooks and angles
    expect(scriptA.hook).not.toBe(scriptB.hook);
    expect(scriptA.hookAngle).not.toBe(scriptB.hookAngle);
  });

  it("script names follow the naming convention with hook angle", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      hookCategory: "Curiosity",
      aggressiveScale: 2,
      avatar: "Patients",
      scriptNumberStart: 1,
      pairsCount: 3,
    });

    // Format: HM 1 (Curiosity) (hid) (Mo) (2-5)
    expect(result.scripts[0]?.name).toMatch(/^HM \d+ \(Curiosity\) \(.+\) \(Mo\) \(2-5\)$/);
    expect(result.scripts[1]?.name).toMatch(/^HM \d+ \(Curiosity\) \(.+\) \(Mo\) \(2-5\)$/);
  });

  it("uses correct lawsuit code for Snapchat Abuse", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.generate({
      lawsuit: "Snapchat Abuse",
      aggressiveScale: 2,
      avatar: "Parents (30-55)",
      scriptNumberStart: 1,
      pairsCount: 3,
    });
    expect(result.scripts[0]?.name).toMatch(/^SAB /);
  });

  it("returns a sessionId from the DB insert", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      aggressiveScale: 1,
      avatar: "Patients",
      scriptNumberStart: 1,
    });
    expect(typeof result.sessionId).toBe("number");
    expect(result.sessionId).toBe(42);
  });

  it("accepts Meta platform parameter", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      aggressiveScale: 1,
      avatar: "Patients",
      platform: "Meta",
      scriptNumberStart: 1,
    });
    expect(result.scripts.length).toBeGreaterThan(0);
  });
});

describe("scripts.history", () => {
  it("returns an array (empty or populated)", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.history();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("kb.getContent", () => {
  it("returns KB content string", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.kb.getContent();
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  });
});

describe("kb.getDocuments", () => {
  it("returns an array", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.kb.getDocuments();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("feedback.save", () => {
  it("saves feedback, returns success and a kbRule string", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.feedback.save({
      scriptId: 42,
      scriptName: "HM 1 (Curiosity) (hid) (Mo) (2-5)",
      feedbackText: "Hook is too weak, needs more energy.",
    });
    expect(result.success).toBe(true);
    // kbRule should be a non-empty string derived from the LLM
    expect(typeof result.kbRule).toBe("string");
    expect(result.kbRule!.length).toBeGreaterThan(0);
  });

  it("accepts optional scriptContent for context", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.feedback.save({
      scriptId: 42,
      scriptName: "HM 2 (Betrayal) (warned) (Mo) (2-5)",
      feedbackText: "Not very powerful, needs more authority.",
      scriptContent: {
        hook: "They never warned you this could happen.",
        body: "Internal reports showed the mesh was causing damage.",
        cta: "Tap below.",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("scripts.regenerateOne", () => {
  it("returns a single regenerated script with correct structure", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.regenerateOne({
      lawsuit: "Hernia Mesh",
      aggressiveScale: 2,
      avatar: "Patients",
      platform: "Other",
      scriptNumber: 1,
      existingScript: {
        name: "HM 1 (Curiosity) (hid) (Mo) (2-5)",
        hook: "They hid this from you for years.",
        hookAngle: "hid",
        body: "Hernia mesh manufacturers knew their product was failing.",
        cta: "Tap below.",
        pairIndex: 0,
        variantIndex: 0,
      },
      feedbackText: "Not powerful enough, needs more urgency.",
    });
    expect(result.script).toBeDefined();
    expect(typeof result.script.name).toBe("string");
    expect(typeof result.script.hook).toBe("string");
    expect(typeof result.script.hookAngle).toBe("string");
    expect(typeof result.script.body).toBe("string");
    expect(typeof result.script.cta).toBe("string");
    // pairIndex and variantIndex should be preserved from the original
    expect(result.script.pairIndex).toBe(0);
    expect(result.script.variantIndex).toBe(0);
  });

  it("works without feedback text (general improvement)", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.regenerateOne({
      lawsuit: "Snapchat Abuse",
      aggressiveScale: 3,
      avatar: "Parents (30-55)",
      platform: "Meta",
      scriptNumber: 2,
      existingScript: {
        name: "SAB 2 (Betrayal) (warned) (Mo) (3-5)",
        hook: "They never warned you.",
        hookAngle: "warned",
        body: "Body text here.",
        cta: "Check eligibility.",
        pairIndex: 1,
        variantIndex: 1,
      },
    });
    expect(result.script).toBeDefined();
    expect(result.script.pairIndex).toBe(1);
    expect(result.script.variantIndex).toBe(1);
  });
});

describe("auth.logout", () => {
  it("clears the session cookie", async () => {
    const ctx = createAuthContext();
    const clearedCookies: string[] = [];
    ctx.res.clearCookie = (name: string) => { clearedCookies.push(name); };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies.length).toBe(1);
  });
});
