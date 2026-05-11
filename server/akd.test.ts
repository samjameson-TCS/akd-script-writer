import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock LLM ────────────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            scripts: [
              {
                hookAngle: "Can't Believe",
                hookA: "I can't believe this isn't being talked about more.",
                hookB: "Hernia mesh manufacturers were hiding the risks from us.",
                body: "These companies knew their mesh was failing inside people's bodies. They kept selling it anyway. Tens of thousands of people suffered.",
                cta: "Tap below to check your eligibility for free. 30 seconds. No obligation.",
              },
              {
                hookAngle: "Breaking News",
                hookA: "This just became a major lawsuit.",
                hookB: "And families are qualifying for compensation right now.",
                body: "Hernia mesh manufacturers knew their product was defective. They sold it anyway. Now the courts are catching up.",
                cta: "Tap below to check your eligibility for free. 30 seconds. No obligation.",
              },
              {
                hookAngle: "Secret",
                hookA: "Here's what hernia mesh manufacturers don't want you to know.",
                hookB: "They had the data. They kept selling anyway.",
                body: "Internal reports showed the mesh was causing damage. Infections, chronic pain, failed repairs. They said nothing.",
                cta: "Tap below to check your eligibility for free. 30 seconds. No obligation.",
              },
            ],
          }),
        },
      },
    ],
  }),
}));

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  saveGeneratedScripts: vi.fn().mockResolvedValue(undefined),
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
    expect(result.hookCategories).toContain("Pattern");
    expect(result.avatars.length).toBeGreaterThan(0);
  });
});

describe("scripts.generate", () => {
  it("returns 3 named scripts with correct naming convention", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.generate({
      lawsuit: "Hernia Mesh",
      hookCategory: "Pattern",
      hookAngle: "Can't",
      aggressiveScale: 1,
      avatar: "Patients",
      scriptNumberStart: 13,
    });

    expect(result.scripts).toHaveLength(3);
    // Check naming convention: CODE (hookCategory) (hookAngle) (Mo) (scale-5)
    expect(result.scripts[0]?.name).toMatch(/^HM \d+ \(.+\) \(.+\) \(Mo\) \(\d-5\)$/);
    expect(result.scripts[0]?.hookA).toBeTruthy();
    expect(result.scripts[0]?.hookB).toBeTruthy();
    expect(result.scripts[0]?.body).toBeTruthy();
    expect(result.scripts[0]?.cta).toBeTruthy();
  });

  it("uses correct lawsuit code in script name", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scripts.generate({
      lawsuit: "Snapchat Abuse",
      hookCategory: "Educational",
      hookAngle: "Break It Down",
      aggressiveScale: 2,
      avatar: "Parents (30-55)",
      scriptNumberStart: 1,
    });
    expect(result.scripts[0]?.name).toMatch(/^SAB /);
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
  it("saves feedback and returns success", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.feedback.save({
      scriptId: 1,
      scriptName: "HM 13 (Pattern) (Can't) (Mo) (1-5)",
      feedbackText: "Hook is too weak, needs more energy.",
    });
    expect(result.success).toBe(true);
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
