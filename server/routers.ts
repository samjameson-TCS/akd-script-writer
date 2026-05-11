import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { saveGeneratedScripts, getScriptHistory, getScriptById, saveFeedback, getFeedbackForScript, saveKbDocument, getKbDocuments } from "./db";
import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";

// ─── KB helpers ──────────────────────────────────────────────────────────────

const KB_PATH = path.join(process.cwd(), "server", "knowledge_base.md");

function readKB(): string {
  try {
    return fs.readFileSync(KB_PATH, "utf-8");
  } catch {
    return "Knowledge base not found.";
  }
}

function appendToKB(content: string): void {
  const timestamp = new Date().toISOString().split("T")[0];
  const separator = `\n\n---\n\n## APPENDED DOCUMENT — ${timestamp}\n\n`;
  fs.appendFileSync(KB_PATH, separator + content);
}

function appendFeedbackToKB(scriptName: string, feedback: string): void {
  const timestamp = new Date().toISOString();
  const entry = `\n- [${timestamp}] **${scriptName}**: ${feedback}`;
  // Find or append to feedback log section
  let kb = readKB();
  if (kb.includes("## FEEDBACK LOG")) {
    kb = kb + entry;
    fs.writeFileSync(KB_PATH, kb);
  } else {
    fs.appendFileSync(KB_PATH, `\n\n---\n\n## FEEDBACK LOG\n${entry}`);
  }
}

// ─── Script naming ────────────────────────────────────────────────────────────

const LAWSUIT_CODES: Record<string, string> = {
  "Hernia Mesh": "HM",
  "Dupixent": "DUP",
  "Snapchat Abuse": "SAB",
  "Camp Lejeune": "CAW",
  "Roundup": "RUP",
  "Social Media": "SMA",
  "AFFF": "AFFF",
  "NEC Baby Formula": "NEC",
  "Ozempic": "OZE",
  "Paraquat": "PAR",
  "Talcum Powder": "TAL",
  "Zantac": "ZAN",
  "Hair Relaxer": "HR",
  "LDS": "LDS",
  "Depo Provera": "DEPO",
  "Other": "OTH",
};

function getLawsuitCode(lawsuit: string): string {
  return LAWSUIT_CODES[lawsuit] ?? lawsuit.substring(0, 3).toUpperCase();
}

function buildScriptName(lawsuit: string, hookCategory: string | undefined, hookAngle: string | undefined, scriptNumber: number, aggressiveScale: number): string {
  const code = getLawsuitCode(lawsuit);
  const catPart = hookCategory ? ` (${hookCategory})` : "";
  const anglePart = hookAngle ? ` (${hookAngle})` : "";
  return `${code} ${scriptNumber}${catPart}${anglePart} (Mo) (${aggressiveScale}-5)`;
}

// ─── Lawsuits & options ───────────────────────────────────────────────────────

const LAWSUITS = Object.keys(LAWSUIT_CODES);
const HOOK_CATEGORIES = ["Symptom", "Compensation", "Educational", "Story", "Curiosity", "Pattern", "Social Proof", "Authority", "Urgency", "Emotional"];
const AVATARS = ["Parents (30-55)", "Young Adults (18-30)", "Patients", "Veterans", "General Public"];

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Meta ────────────────────────────────────────────────────────────────
  meta: publicProcedure.query(() => ({
    lawsuits: LAWSUITS,
    hookCategories: HOOK_CATEGORIES,
    avatars: AVATARS,
  })),

  // ─── Script Generation ────────────────────────────────────────────────────
  scripts: router({
    generate: protectedProcedure
      .input(z.object({
        lawsuit: z.string(),
        hookCategory: z.string().optional(),
        hookAngle: z.string().optional(),
        aggressiveScale: z.number().min(1).max(5),
        avatar: z.string(),
        platform: z.enum(["Meta", "TikTok", "YouTube", "Other"]).default("Other"),
        referenceScript: z.string().optional(),
        extraInstructions: z.string().optional(),
        scriptNumberStart: z.number().default(1),
      }))
      .mutation(async ({ input }) => {
        const kb = readKB();

        const wordCountRule = input.platform === "Meta"
          ? "Scripts for Meta MUST be 75–100 words maximum. Be ruthless — cut every unnecessary word."
          : input.platform === "TikTok" || input.platform === "YouTube"
          ? "Keep scripts 100–150 words."
          : "Keep scripts 100–150 words.";

        const systemPrompt = `You are the AKD Media AI Script Writer. You have been trained on the following knowledge base. Read it completely before writing any script.

${kb}

CRITICAL RULES:
- Always follow the 3-step structure: HOOK A + HOOK B → BODY → CTA
- Never use banned words from the compliance section
- Match the aggressive scale exactly as requested
- Write for the specified avatar
- ${wordCountRule}
- Sound conversational and human — never robotic or formal
- ABSOLUTE BAN: Never begin Hook A, Hook B, or any part of the script with the word "Imagine". This is non-negotiable. Find a different opening.
- Return EXACTLY 3 scripts as a JSON array`;

        const userPrompt = `Generate 3 unique script iterations for the following parameters:

Lawsuit: ${input.lawsuit}
Platform: ${input.platform}
Hook Category: ${input.hookCategory ?? "(AI decides)"}
Hook Angle: ${input.hookAngle ?? "(AI decides)"}
Aggressive Scale: ${input.aggressiveScale}/5
Target Avatar: ${input.avatar}
${input.referenceScript ? `Reference Script (iterate from this):\n${input.referenceScript}` : ""}
${input.extraInstructions ? `Extra Instructions: ${input.extraInstructions}` : ""}

Return a JSON array of exactly 3 objects, each with:
- "hookAngle": the specific hook angle used (short, 2-3 words)
- "hookA": first hook line
- "hookB": second hook line  
- "body": the body paragraph
- "cta": the call to action

Example format:
[
  {
    "hookAngle": "Can't Believe",
    "hookA": "...",
    "hookB": "...",
    "body": "...",
    "cta": "..."
  }
]`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "scripts_output",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  scripts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        hookAngle: { type: "string" },
                        hookA: { type: "string" },
                        hookB: { type: "string" },
                        body: { type: "string" },
                        cta: { type: "string" },
                      },
                      required: ["hookAngle", "hookA", "hookB", "body", "cta"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["scripts"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : "{}";
        const parsed = JSON.parse(content) as { scripts: Array<{ hookAngle: string; hookA: string; hookB: string; body: string; cta: string }> };

        // Build named scripts
        const namedScripts = parsed.scripts.map((s, i) => ({
          name: buildScriptName(input.lawsuit, input.hookCategory, s.hookAngle, input.scriptNumberStart + i, input.aggressiveScale),
          hookA: s.hookA,
          hookB: s.hookB,
          body: s.body,
          cta: s.cta,
        }));

        // Save to DB — capture insertId to return as sessionId
        const sessionId = await saveGeneratedScripts({
          lawsuit: input.lawsuit,
          hookCategory: input.hookCategory ?? null,
          aggressiveScale: input.aggressiveScale,
          avatar: input.avatar,
          referenceScript: input.referenceScript ?? null,
          extraInstructions: input.extraInstructions ?? null,
          scripts: namedScripts,
        });

        return { scripts: namedScripts, sessionId };
      }),

    history: protectedProcedure
      .input(z.object({
        lawsuit: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getScriptHistory(input ?? {});
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const script = await getScriptById(input.id);
        if (!script) throw new TRPCError({ code: "NOT_FOUND" });
        return script;
      }),
  }),

  // ─── Feedback ─────────────────────────────────────────────────────────────
  feedback: router({
    save: protectedProcedure
      .input(z.object({
        scriptId: z.number(),
        scriptName: z.string(),
        feedbackText: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        await saveFeedback({
          scriptId: input.scriptId,
          scriptName: input.scriptName,
          feedbackText: input.feedbackText,
        });
        // Append to KB
        appendFeedbackToKB(input.scriptName, input.feedbackText);
        return { success: true };
      }),

    getForScript: protectedProcedure
      .input(z.object({ scriptId: z.number() }))
      .query(async ({ input }) => {
        return getFeedbackForScript(input.scriptId);
      }),
  }),

  // ─── Knowledge Base ───────────────────────────────────────────────────────
  kb: router({
    getContent: protectedProcedure.query(() => {
      return { content: readKB() };
    }),

    uploadDocument: protectedProcedure
      .input(z.object({
        filename: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        await saveKbDocument({ filename: input.filename, content: input.content });
        appendToKB(`### ${input.filename}\n\n${input.content}`);
        return { success: true };
      }),

    getDocuments: protectedProcedure.query(async () => {
      return getKbDocuments();
    }),
  }),

  // ─── Notion Push ─────────────────────────────────────────────────────────
  notion: router({
    push: protectedProcedure
      .input(z.object({
        scriptName: z.string(),
        hookA: z.string(),
        hookB: z.string(),
        body: z.string(),
        cta: z.string(),
        pageId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const notionToken = process.env.NOTION_TOKEN;
        if (!notionToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Notion token not configured" });

        const targetPageId = input.pageId ?? process.env.NOTION_DEFAULT_PAGE_ID;
        if (!targetPageId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Notion page ID provided" });

        const scriptBody = `HOOK A\n${input.hookA}\n\nHOOK B\n${input.hookB}\n\nBODY\n${input.body}\n\nCTA\n${input.cta}`;

        const response = await fetch(`https://api.notion.com/v1/blocks/${targetPageId}/children`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${notionToken}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify({
            children: [
              {
                type: "toggle",
                toggle: {
                  rich_text: [{ type: "text", text: { content: input.scriptName } }],
                  color: "default",
                  children: [
                    {
                      type: "callout",
                      callout: {
                        rich_text: [{ type: "text", text: { content: scriptBody } }],
                        icon: { type: "emoji", emoji: "📝" },
                        color: "gray_background",
                      },
                    },
                  ],
                },
              },
            ],
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Notion API error: ${err}` });
        }

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
