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
  // Lawsuit updates
  getLawsuitUpdates: vi.fn().mockResolvedValue([]),
  getLastScrapeTime: vi.fn().mockResolvedValue(null),
  saveLawsuitUpdates: vi.fn().mockResolvedValue(undefined),
  // Research docs
  listResearchDocs: vi.fn().mockResolvedValue([
    { id: 1, lawsuitKey: "Hernia Mesh", title: "Hernia Mesh Brief", summary: "Test summary", updatedAt: new Date() },
  ]),
  getResearchDocByKey: vi.fn().mockResolvedValue(null), // null = no research doc for this lawsuit (safe default)
  getResearchDocById: vi.fn().mockResolvedValue({
    id: 1, lawsuitKey: "Hernia Mesh", title: "Hernia Mesh Brief", content: "# Research\n\nTest content.", summary: "Test summary", createdAt: new Date(), updatedAt: new Date(),
  }),
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
