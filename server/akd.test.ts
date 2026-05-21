import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { invokeLLM } from "./_core/llm";

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
              // Covers structured feedback rule conversion (category + rule required)
              category: "hook",
              rule: "Always write hooks with strong emotional urgency and specific details.",
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
  // Lawsuit updates
  getLawsuitUpdates: vi.fn().mockResolvedValue([]),
  getLastScrapeTime: vi.fn().mockResolvedValue(null),
  saveLawsuitUpdates: vi.fn().mockResolvedValue(undefined),
  saveScriptToDashboard: vi.fn().mockResolvedValue(1),
  listSavedScripts: vi.fn().mockResolvedValue([]),
  deleteSavedScript: vi.fn().mockResolvedValue(undefined),
  // Script comments (session thread)
  addScriptComment: vi.fn().mockResolvedValue(99),
  getScriptCommentsByName: vi.fn().mockResolvedValue([]),
  promoteScriptComment: vi.fn().mockResolvedValue(undefined),
  getUnpromotedComments: vi.fn().mockResolvedValue([]),
  // Research docs
  listResearchDocs: vi.fn().mockResolvedValue([
    { id: 1, lawsuitKey: "Hernia Mesh", title: "Hernia Mesh Brief", summary: "Test summary", updatedAt: new Date() },
  ]),
  getResearchDocByKey: vi.fn().mockResolvedValue(null), // null = no research doc for this lawsuit (safe default)
  getResearchDocById: vi.fn().mockResolvedValue({
    id: 1, lawsuitKey: "Hernia Mesh", title: "Hernia Mesh Brief", content: "# Research\n\nTest content.", summary: "Test summary", createdAt: new Date(), updatedAt: new Date(),
  }),
  // Buyer specs
  listBuyerSpecs: vi.fn().mockResolvedValue([]),
  getBuyerSpecById: vi.fn().mockResolvedValue(null),
  getBuyerSpecByName: vi.fn().mockResolvedValue(null),
  upsertBuyerSpec: vi.fn().mockResolvedValue(1),
  deleteBuyerSpec: vi.fn().mockResolvedValue(undefined),
  // Hooks
  listHooks: vi.fn().mockResolvedValue([]),
  insertHook: vi.fn().mockResolvedValue(101),
  updateHook: vi.fn().mockResolvedValue(undefined),
  deleteHook: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock lawsuitScraper — prevent real HTTP calls ──────────────────────────
vi.mock("./lawsuitScraper", () => ({
  scrapeAllLawsuits: vi.fn().mockResolvedValue({
    "Hernia Mesh": [{ title: "Hernia Mesh Update", url: "https://example.com/hm", excerpt: "Test excerpt", publishedAt: "May 2026" }],
    "PowerPort": [],
    "Depo-Provera": [],
    "Social Media Addiction": [],
    "NY Juvenile Detention": [],
    "Illinois Juvenile Detention": [],
  }),
  scrapeUpdatesForLawsuit: vi.fn().mockResolvedValue([
    { title: "Test Article", url: "https://example.com/article", excerpt: "Test excerpt", publishedAt: "May 2026" },
  ]),
}));

// ─── Mock kbParser — prevent real file reads, return structured feedback rule ──
vi.mock("./kbParser", () => ({
  buildKBContext: vi.fn().mockReturnValue("## CORE WRITING RULES\n\nTest KB context."),
  appendStructuredFeedbackRule: vi.fn(),
  getFeedbackRulesList: vi.fn().mockReturnValue([]),
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
      complianceLevel: 2,
      scriptNumberStart: 1,
    });
    expect(result.scripts.length).toBeGreaterThan(0);
  });

  it("accepts complianceLevel 1, 2, and 3", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    for (const level of [1, 2, 3] as const) {
      const result = await caller.scripts.generate({
        lawsuit: "Hernia Mesh",
        aggressiveScale: 2,
        avatar: "Patients",
        complianceLevel: level,
        scriptNumberStart: 1,
      });
      expect(result.scripts.length).toBeGreaterThan(0);
    }
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

  it("accepts complianceLevel 1, 2, and 3 for regeneration", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    for (const level of [1, 2, 3] as const) {
      const result = await caller.scripts.regenerateOne({
        lawsuit: "Hernia Mesh",
        aggressiveScale: 2,
        avatar: "Patients",
        platform: "Other",
        complianceLevel: level,
        scriptNumber: 1,
        existingScript: {
          name: "HM 1 (Curiosity) (hid) (Mo) (2-5)",
          hook: "They hid this from you.",
          hookAngle: "hid",
          body: "Body text.",
          cta: "Check eligibility.",
          pairIndex: 0,
          variantIndex: 0,
        },
      });
      expect(result.script).toBeDefined();
      expect(typeof result.script.hook).toBe("string");
    }
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

describe("research.list", () => {
  it("returns an array of research doc summaries", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.research.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("lawsuitKey");
    expect(result[0]).toHaveProperty("title");
    expect(result[0]).toHaveProperty("summary");
  });
});

describe("research.getById", () => {
  it("returns a full research doc with content", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.research.getById({ id: 1 });
    expect(result).toBeDefined();
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.lawsuitKey).toBe("Hernia Mesh");
  });
});

describe("research.getByKey", () => {
  it("throws NOT_FOUND when no doc exists for the key", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.research.getByKey({ lawsuitKey: "Unknown Lawsuit" })).rejects.toThrow();
  });
});

describe("scripts.generate — research injection", () => {
  it("generates scripts for a lawsuit with a research doc (Hernia Mesh) without error", async () => {
    // Override mock to return a research doc for Hernia Mesh
    const { getResearchDocByKey } = await import("./db");
    (getResearchDocByKey as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1,
      lawsuitKey: "Hernia Mesh",
      title: "Hernia Mesh Brief",
      content: "# Research\n\nHernia mesh complications include pain, infection, and mesh migration.",
      summary: "Test summary",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      aggressiveScale: 1,
      avatar: "Patients",
      complianceLevel: 1,
      scriptNumberStart: 1,
    });
    expect(result.scripts.length).toBeGreaterThan(0);
    expect(result.sessionId).toBe(42);
  });
});

// ─── Updates router tests ────────────────────────────────────────────────────

describe("updates.getAll", () => {
  it("returns updates and lastScrape when no filter applied", async () => {
    const { getLawsuitUpdates, getLastScrapeTime } = await import("./db");
    (getLawsuitUpdates as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        lawsuitKey: "Hernia Mesh",
        title: "New Hernia Mesh Settlement",
        summary: "Courts awarded compensation to victims.",
        url: "https://www.lawsuit-information-center.com/hernia-mesh-settlement",
        publishedAt: "May 2026",
        scrapedAt: new Date(),
      },
    ]);
    (getLastScrapeTime as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Date());
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.updates.getAll({});
    expect(Array.isArray(result.updates)).toBe(true);
    expect(result.updates.length).toBeGreaterThan(0);
    expect(result.updates[0]).toHaveProperty("lawsuitKey");
    expect(result.updates[0]).toHaveProperty("title");
    expect(result.updates[0]).toHaveProperty("url");
  });

  it("filters updates by lawsuitKey when provided", async () => {
    const { getLawsuitUpdates, getLastScrapeTime } = await import("./db");
    (getLawsuitUpdates as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 2,
        lawsuitKey: "Depo-Provera",
        title: "Depo-Provera Lawsuit Update",
        summary: "New filings in 2026.",
        url: "https://www.lawsuit-information-center.com/depo-provera",
        publishedAt: "April 2026",
        scrapedAt: new Date(),
      },
    ]);
    (getLastScrapeTime as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.updates.getAll({ lawsuitKey: "Depo-Provera" });
    expect(result.updates.length).toBeGreaterThan(0);
    expect(result.updates[0].lawsuitKey).toBe("Depo-Provera");
  });
});

describe("meta — grouped lawsuit dropdown", () => {
  it("returns researchBackedLawsuits as a separate array", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.meta();
    expect(Array.isArray(result.researchBackedLawsuits)).toBe(true);
    expect(result.researchBackedLawsuits).toContain("Hernia Mesh");
    expect(result.researchBackedLawsuits).toContain("Depo-Provera");
    expect(result.researchBackedLawsuits).toContain("PowerPort");
    expect(result.researchBackedLawsuits).toContain("Social Media Addiction");
    expect(result.researchBackedLawsuits).toContain("NY Juvenile Detention");
    expect(result.researchBackedLawsuits).toContain("Illinois Juvenile Detention");
    // All research-backed lawsuits should also appear in the main lawsuits list
    for (const l of result.researchBackedLawsuits) {
      expect(result.lawsuits).toContain(l);
    }
  });
});

describe("savedScripts — save, list, delete", () => {
  it("saves a script to the dashboard and returns an id", async () => {
    const { saveScriptToDashboard } = await import("./db");
    (saveScriptToDashboard as ReturnType<typeof vi.fn>).mockResolvedValueOnce(99);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.savedScripts.save({
      name: "HM 1 (Curiosity) (hidden) (Mo) (2-5)",
      lawsuit: "Hernia Mesh",
      hookCategory: "Curiosity",
      hookAngle: "hidden",
      hook: "They never told you this about hernia mesh.",
      body: "Thousands of patients were implanted with defective mesh.",
      cta: "Tap below to see if you qualify.",
      complianceLevel: 3,
      platform: "Meta",
      aggressiveScale: 3,
      sessionId: 1,
    });
    expect(result.id).toBe(99);
  });

  it("lists saved scripts grouped by lawsuit", async () => {
    const { listSavedScripts } = await import("./db");
    (listSavedScripts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        name: "HM 1 (Curiosity) (hidden) (Mo) (2-5)",
        lawsuit: "Hernia Mesh",
        hookCategory: "Curiosity",
        hookAngle: "hidden",
        hook: "They never told you this.",
        body: "Thousands affected.",
        cta: "Tap below.",
        complianceLevel: 3,
        platform: "Meta",
        aggressiveScale: 3,
        sessionId: 1,
        savedAt: new Date(),
      },
    ]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.savedScripts.list();
    expect(Array.isArray(result.scripts)).toBe(true);
    expect(result.scripts.length).toBe(1);
    expect(result.grouped["Hernia Mesh"]).toBeDefined();
    expect(result.grouped["Hernia Mesh"].length).toBe(1);
  });

  it("deletes a saved script by id", async () => {
    const { deleteSavedScript } = await import("./db");
    (deleteSavedScript as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.savedScripts.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

// ─── Phase 12: AI Architecture Tests ─────────────────────────────────────────

describe("Phase 12 — structured KB context injection", () => {
  it("generate uses buildKBContext (structured KB parser) instead of raw file read", async () => {
    const { buildKBContext } = await import("./kbParser");
    const caller = appRouter.createCaller(createAuthContext());
    await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      aggressiveScale: 2,
      avatar: "Patients",
      scriptNumberStart: 1,
      pairsCount: 1,
    });
    expect(buildKBContext).toHaveBeenCalled();
    // Should be called with the lawsuit key so lawsuit-specific facts are injected
    const callArgs = (buildKBContext as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({ lawsuitKey: "Hernia Mesh" });
  });

  it("generate injects recent lawsuit news articles into the prompt", async () => {
    const { getLawsuitUpdates } = await import("./db");
    (getLawsuitUpdates as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 1, lawsuitKey: "Hernia Mesh", title: "New Hernia Mesh Ruling", summary: "Court rules in favour of plaintiffs.", url: "https://example.com/1", publishedAt: "May 2026", scrapedAt: new Date() },
      { id: 2, lawsuitKey: "Hernia Mesh", title: "Hernia Mesh Settlement Update", summary: "Settlement fund expanded.", url: "https://example.com/2", publishedAt: "April 2026", scrapedAt: new Date() },
    ]);
    const { invokeLLM } = await import("./_core/llm");
    const caller = appRouter.createCaller(createAuthContext());
    await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      aggressiveScale: 2,
      avatar: "Patients",
      scriptNumberStart: 1,
      pairsCount: 1,
    });
    // The LLM should have been called — check that it was invoked
    expect(invokeLLM).toHaveBeenCalled();
    // The system message content should include the news article title
    const llmCall = (invokeLLM as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => {
        const args = call[0] as { messages?: Array<{ role: string; content: string }> };
        return args?.messages?.some((m) => m.role === "system" && m.content.includes("New Hernia Mesh Ruling"));
      }
    );
    expect(llmCall).toBeDefined();
  });

  it("generate injects few-shot examples from saved Dashboard scripts", async () => {
    const { listSavedScripts } = await import("./db");
    (listSavedScripts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        name: "HM 1 (Curiosity) (hidden) (Mo) (3-5)",
        lawsuit: "Hernia Mesh",
        hookCategory: "Curiosity",
        hookAngle: "hidden",
        hook: "They never told you this about hernia mesh.",
        body: "Thousands of patients were implanted with defective mesh that was never safe.",
        cta: "Tap below to see if you qualify — it takes 30 seconds.",
        complianceLevel: 3,
        platform: "Meta",
        aggressiveScale: 3,
        sessionId: 1,
        savedAt: new Date(),
      },
    ]);
    const { invokeLLM } = await import("./_core/llm");
    const caller = appRouter.createCaller(createAuthContext());
    await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      aggressiveScale: 3,
      avatar: "Patients",
      scriptNumberStart: 1,
      pairsCount: 1,
    });
    expect(invokeLLM).toHaveBeenCalled();
    // System prompt should include the saved script as a few-shot example
    const llmCall = (invokeLLM as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => {
        const args = call[0] as { messages?: Array<{ role: string; content: string }> };
        return args?.messages?.some((m) => m.role === "system" && m.content.includes("They never told you this about hernia mesh."));
      }
    );
    expect(llmCall).toBeDefined();
  });
});

describe("Phase 12 — structured feedback categorisation", () => {
  it("feedback.save returns a structured kbRule with category and rule fields", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.feedback.save({
      scriptId: 42,
      scriptName: "HM 1 (Curiosity) (hid) (Mo) (2-5)",
      feedbackText: "The hook is too weak and passive — needs more urgency.",
    });
    expect(result.success).toBe(true);
    // kbRule should be a non-empty string
    expect(typeof result.kbRule).toBe("string");
    expect(result.kbRule!.length).toBeGreaterThan(0);
    // appendStructuredFeedbackRule should have been called to update the KB
    const { appendStructuredFeedbackRule } = await import("./kbParser");
    expect(appendStructuredFeedbackRule).toHaveBeenCalled();
  });

  it("feedback.save with scriptContent provides full context to the AI", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.feedback.save({
      scriptId: 42,
      scriptName: "HM 2 (Betrayal) (warned) (Mo) (2-5)",
      feedbackText: "CTA sounds robotic — no one talks like that.",
      scriptContent: {
        hook: "They never warned you this could happen.",
        body: "Internal reports showed the mesh was causing damage.",
        cta: "Tap below. 30 seconds. Free.",
      },
    });
    expect(result.success).toBe(true);
    expect(typeof result.kbRule).toBe("string");
  });
});

// ─── Phase 13: Session Comment Thread Tests ───────────────────────────────────

describe("Phase 13 — scriptComments session thread", () => {
  it("scriptComments.add saves a comment and returns an id", async () => {
    const { addScriptComment } = await import("./db");
    (addScriptComment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(99);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scriptComments.add({
      sessionId: 42,
      scriptName: "HM 1 (Curiosity) (hid) (Mo) (2-5)",
      comment: "Include compensation in the hook",
    });
    expect(result.id).toBe(99);
    expect(result.success).toBe(true);
  });

  it("scriptComments.list returns all comments for a script", async () => {
    const { getScriptCommentsByName } = await import("./db");
    (getScriptCommentsByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 99, sessionId: 42, scriptName: "HM 1 (Curiosity) (hid) (Mo) (2-5)", comment: "Include compensation in the hook", promoted: false, createdAt: new Date() },
      { id: 100, sessionId: 42, scriptName: "HM 1 (Curiosity) (hid) (Mo) (2-5)", comment: "Make the tone more urgent", promoted: false, createdAt: new Date() },
    ]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scriptComments.list({
      sessionId: 42,
      scriptName: "HM 1 (Curiosity) (hid) (Mo) (2-5)",
    });
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].comment).toBe("Include compensation in the hook");
    expect(result.comments[1].comment).toBe("Make the tone more urgent");
  });

  it("scriptComments.promote converts comment to KB rule and marks as promoted", async () => {
    const { promoteScriptComment } = await import("./db");
    (promoteScriptComment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scriptComments.promote({
      commentId: 99,
      comment: "Include compensation in the hook",
      scriptName: "HM 1 (Curiosity) (hid) (Mo) (2-5)",
    });
    expect(result.success).toBe(true);
    expect(typeof result.kbRule).toBe("string");
    expect(result.kbRule.length).toBeGreaterThan(0);
    expect(promoteScriptComment).toHaveBeenCalledWith(99, expect.any(String));
  });

  it("regenerateOne with _commentThread passes all accumulated notes to the AI", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as ReturnType<typeof vi.fn>).mockClear();
    const caller = appRouter.createCaller(createAuthContext());
    await caller.scripts.regenerateOne({
      lawsuit: "Hernia Mesh",
      aggressiveScale: 3,
      avatar: "Patients",
      platform: "Meta",
      complianceLevel: 3,
      scriptNumber: 1,
      existingScript: {
        name: "HM 1 (Curiosity) (hid) (Mo) (2-5)",
        hook: "They hid this from you.",
        hookAngle: "hid",
        body: "Internal documents show the manufacturer knew.",
        cta: "Call now for a free review.",
        pairIndex: 0,
        variantIndex: 0,
      },
      _commentThread: ["Include compensation in the hook", "Make the tone more urgent"],
    });
    expect(invokeLLM).toHaveBeenCalled();
    const llmCall = (invokeLLM as ReturnType<typeof vi.fn>).mock.calls[0];
    const messages = (llmCall[0] as { messages: Array<{ role: string; content: string }> }).messages;
    // Comment thread is injected into the user prompt (not system prompt)
    const allContent = messages.map(m => m.content).join(" ");
    expect(allContent).toContain("Include compensation in the hook");
    expect(allContent).toContain("Make the tone more urgent");
  });
});

// ─── Phase 16: Iterate + DetectLawsuit tests ─────────────────────────────────

describe("scripts.generate — avatar defaults to General Public when omitted", () => {
  it("generates scripts without requiring avatar to be provided", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    // No avatar field — should default to "General Public" and succeed
    const result = await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      aggressiveScale: 2,
      scriptNumberStart: 1,
      pairsCount: 1,
    });
    expect(result.scripts).toBeDefined();
    expect(result.scripts.length).toBeGreaterThan(0);
  });
});

describe("scripts.detectLawsuit", () => {
  it("returns a lawsuit name and confidence level from script text", async () => {
    // The LLM mock returns JSON with a 'lawsuit' field — override to return detect-specific JSON
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ lawsuit: "Hernia Mesh", confidence: "high" }),
          },
        },
      ],
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.detectLawsuit({
      scriptText: "If you had hernia mesh surgery and experienced complications like pain or infection, you may be entitled to compensation.",
    });

    expect(result).toHaveProperty("lawsuit");
    expect(result).toHaveProperty("confidence");
    // The mock returns "Hernia Mesh" which is in LAWSUITS list → should pass through
    expect(result.lawsuit).toBe("Hernia Mesh");
    expect(result.confidence).toBe("high");
  });

  it("returns null lawsuit when detected lawsuit is not in the known list", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ lawsuit: "Unknown Lawsuit XYZ", confidence: "low" }),
          },
        },
      ],
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.detectLawsuit({
      scriptText: "This is some random text that doesn't match any known lawsuit.",
    });

    expect(result.lawsuit).toBeNull();
    expect(result.confidence).toBe("low");
  });
});

describe("scripts.iterate", () => {
  it("returns 9 iterations with the correct shape", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const iterationTypes = [
      "WINNING_ANGLE_REFRAMED",
      "DIFFERENT_SEVERITY_TIER",
      "DIFFERENT_ANGLE",
      "MORE_AGGRESSIVE",
      "SHORT_VERSION",
      "COMPENSATION_VERSION",
      "SYNONYM",
      "SLANG",
      "DIFFERENT_POV",
    ];
    const mockIterations = iterationTypes.map((type) => ({
      type,
      label: type.replace(/_/g, " ").toLowerCase(),
      hook: `Hook for ${type}`,
      body: `Body text for ${type} iteration.`,
      cta: "Check your eligibility for free.",
    }));

    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ iterations: mockIterations }),
          },
        },
      ],
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.iterate({
      originalScript: "HOOK\nThey hid this from you.\n\nBODY\nHernia mesh manufacturers knew.\n\nCTA\nCheck eligibility.",
      lawsuit: "Hernia Mesh",
      complianceLevel: 3,
      platform: "Meta",
    });

    expect(result.iterations).toHaveLength(9);
    expect(result.sessionId).toBe(42); // saveGeneratedScripts mock returns 42

    // Each iteration must have type, label, hook, body, cta
    for (const it of result.iterations) {
      expect(it).toHaveProperty("type");
      expect(it).toHaveProperty("label");
      expect(it).toHaveProperty("hook");
      expect(it).toHaveProperty("body");
      expect(it).toHaveProperty("cta");
      expect(typeof it.hook).toBe("string");
      expect(it.hook.length).toBeGreaterThan(0);
    }

    // All 9 iteration types must be present
    const types = result.iterations.map((it) => it.type);
    expect(types).toContain("WINNING_ANGLE_REFRAMED");
    expect(types).toContain("MORE_AGGRESSIVE");
    expect(types).toContain("SHORT_VERSION");
    expect(types).toContain("DIFFERENT_POV");
  });

  it("accepts buyerSpecId and complianceLevel without error", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              iterations: Array.from({ length: 9 }, (_, i) => ({
                type: `TYPE_${i}`,
                label: `Label ${i}`,
                hook: `Hook ${i}`,
                body: `Body ${i}`,
                cta: `CTA ${i}`,
              })),
            }),
          },
        },
      ],
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.iterate({
      originalScript: "HOOK\nThey hid this.\n\nBODY\nDetails here.\n\nCTA\nCheck now.",
      lawsuit: "Depo-Provera",
      complianceLevel: 1,
      platform: "TikTok",
    });

    expect(result.iterations).toBeDefined();
    expect(Array.isArray(result.iterations)).toBe(true);
  });
});

// ─── Phase 17: Hooks Library tests ───────────────────────────────────────────

describe("hooks.list — returns array (empty DB in test env)", () => {
  it("returns an array from hooks.list", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.hooks.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("accepts category filter without throwing", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.hooks.list({ category: "Curiosity" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("accepts isWinning filter without throwing", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.hooks.list({ isWinning: true });
    expect(Array.isArray(result)).toBe(true);
  });

  it("accepts search filter without throwing", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.hooks.list({ search: "shocking" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("hooks.add — inserts a hook and returns id", () => {
  it("adds a hook and returns a numeric id", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.hooks.add({
      hookLine: "TEST HOOK — auto-test entry",
      category: "Curiosity",
      source: "vitest",
      isWinning: false,
    });
    expect(typeof result.id).toBe("number");
    expect(result.id).toBeGreaterThan(0);
  });
});

describe("hooks.update — updates an existing hook", () => {
  it("updates a hook without throwing", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    // First add a hook to get a real id
    const added = await caller.hooks.add({
      hookLine: "UPDATE TEST HOOK",
      category: "Betrayal",
      source: "vitest",
    });
    const result = await caller.hooks.update({
      id: added.id,
      hookLine: "UPDATED HOOK LINE",
      isWinning: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("hooks.delete — deletes a hook", () => {
  it("deletes a hook without throwing", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const added = await caller.hooks.add({
      hookLine: "DELETE TEST HOOK",
      category: "Urgency",
      source: "vitest",
    });
    const result = await caller.hooks.delete({ id: added.id });
    expect(result.success).toBe(true);
  });
});

describe("hooks.extractFromScript — extracts hook via AI", () => {
  it("extracts a hook line and category from a script", async () => {
    // LLM mock returns JSON with hookLine and category fields
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              hookLine: "They hid this from you for years.",
              category: "Betrayal",
            }),
          },
        },
      ],
    });
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.hooks.extractFromScript({
      scriptText: "They hid this from you for years.\n\nHernia mesh was failing.\n\nCheck your eligibility.",
      lawsuitKey: "Hernia Mesh",
      isWinning: true,
    });
    expect(result.hookLine).toBeDefined();
    expect(result.category).toBeDefined();
    expect(typeof result.id).toBe("number");
  });
});
