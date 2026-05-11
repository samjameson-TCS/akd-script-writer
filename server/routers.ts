import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { saveGeneratedScripts, getScriptHistory, getScriptById, saveFeedback, getFeedbackForScript, saveKbDocument, getKbDocuments, listResearchDocs, getResearchDocByKey, getResearchDocById, saveLawsuitUpdates, getLawsuitUpdates, getLastScrapeTime, saveScriptToDashboard, listSavedScripts, deleteSavedScript, addScriptComment, getScriptCommentsByName, promoteScriptComment, getUnpromotedComments } from "./db";
import { scrapeAllLawsuits, scrapeUpdatesForLawsuit } from "./lawsuitScraper";
import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import { getComplianceRules, COMPLIANCE_LEVEL_LABELS, COMPLIANCE_LEVEL_DESCRIPTIONS, type ComplianceLevel } from "./compliance_levels";
import { buildKBContext, appendStructuredFeedbackRule, getFeedbackRulesList } from "./kbParser";

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

/**
 * Upgraded feedback converter — uses structured JSON output to categorise
 * the feedback and determine whether it replaces an existing rule.
 */
async function convertFeedbackToStructuredRule(opts: {
  scriptName: string;
  feedback: string;
  scriptContent?: { hook: string; body: string; cta: string };
  existingRules: string;
}): Promise<{
  category: "tone" | "structure" | "compliance" | "cta" | "hook" | "body" | "general";
  lawsuitKey?: string;
  hookCategory?: string;
  rule: string;
  replaces?: string;
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert at converting raw script feedback into structured, actionable writing rules for a legal advertising AI script writer.

Your job:
1. Analyse the feedback and the script it refers to.
2. Determine the CATEGORY: tone | structure | compliance | cta | hook | body | general
3. If lawsuit-specific, extract lawsuitKey (e.g. "Hernia Mesh", "Depo-Provera").
4. If hook-category-specific, extract hookCategory (e.g. "Curiosity", "Betrayal").
5. Write a clear universal rule starting with a verb ("Always", "Never", "Avoid", "Ensure", "Use").
6. If a very similar rule already exists below, set replaces to its EXACT text so it gets replaced instead of duplicated.

Existing rules:
${opts.existingRules || "(none yet)"}`,
      },
      {
        role: "user",
        content: `Script name: ${opts.scriptName}\nFeedback: ${opts.feedback}${opts.scriptContent ? `\nHook: ${opts.scriptContent.hook}\nBody: ${opts.scriptContent.body}\nCTA: ${opts.scriptContent.cta}` : ""}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "feedback_rule",
        strict: true,
        schema: {
          type: "object",
          properties: {
            category: { type: "string", enum: ["tone", "structure", "compliance", "cta", "hook", "body", "general"] },
            lawsuitKey: { type: "string" },
            hookCategory: { type: "string" },
            rule: { type: "string" },
            replaces: { type: "string" },
          },
          required: ["category", "rule"],
          additionalProperties: false,
        },
      },
    },
  });
  const raw = response.choices[0]?.message?.content;
  const parsed = JSON.parse(typeof raw === "string" ? raw : "{}") as {
    category: "tone" | "structure" | "compliance" | "cta" | "hook" | "body" | "general";
    lawsuitKey?: string;
    hookCategory?: string;
    rule: string;
    replaces?: string;
  };
  return parsed;
}

/** Legacy single-rule converter kept for backward compat */
async function convertFeedbackToKBRule(scriptName: string, feedback: string): Promise<string> {
  const result = await convertFeedbackToStructuredRule({ scriptName, feedback, existingRules: "" });
  return result.rule;
}
function appendFeedbackToKB(scriptName: string, feedback: string, kbRule: string): void {
  const timestamp = new Date().toISOString().split("T")[0];
  const entry = `\n- [${timestamp}] **${scriptName}** — Raw: "${feedback}" → Rule: ${kbRule}`;
  const kb = readKB();
  if (kb.includes("## FEEDBACK LOG")) {
    fs.writeFileSync(KB_PATH, kb + entry);
  } else {
    fs.appendFileSync(KB_PATH, `\n\n---\n\n## FEEDBACK LOG\n${entry}`);
  }
}

// ─── Script naming ────────────────────────────────────────────────────────────

const LAWSUIT_CODES: Record<string, string> = {
  "Hernia Mesh": "HM",
  "PowerPort": "PP",
  "Depo-Provera": "DEPO",
  "Social Media Addiction": "SMA",
  "NY Juvenile Detention": "NYJ",
  "Illinois Juvenile Detention": "ILJ",
  "Dupixent": "DUP",
  "Snapchat Abuse": "SAB",
  "Camp Lejeune": "CAW",
  "Roundup": "RUP",
  "AFFF": "AFFF",
  "NEC Baby Formula": "NEC",
  "Ozempic": "OZE",
  "Paraquat": "PAR",
  "Talcum Powder": "TAL",
  "Zantac": "ZAN",
  "Hair Relaxer": "HR",
  "LDS": "LDS",
  "Other": "OTH",
};

// Maps lawsuit selector values to research_docs.lawsuitKey (exact DB values)
// Only entries that have a research doc need to be listed here.
const RESEARCH_KEY_MAP: Record<string, string> = {
  "Hernia Mesh": "Hernia Mesh",
  "PowerPort": "PowerPort",
  "Depo-Provera": "Depo-Provera",
  "Social Media Addiction": "Social Media Addiction",
  "NY Juvenile Detention": "NY Juvenile Detention",
  "Illinois Juvenile Detention": "Illinois Juvenile Detention",
};

function getResearchKey(lawsuit: string): string | null {
  return RESEARCH_KEY_MAP[lawsuit] ?? null;
}

function getLawsuitCode(lawsuit: string): string {
  return LAWSUIT_CODES[lawsuit] ?? lawsuit.substring(0, 3).toUpperCase();
}

function buildScriptName(
  lawsuit: string,
  hookCategory: string | undefined,
  hookAngle: string,
  scriptNumber: number,
  aggressiveScale: number
): string {
  const code = getLawsuitCode(lawsuit);
  const catPart = hookCategory ? ` (${hookCategory})` : "";
  // hookAngle is always present per-script (AI assigns it)
  return `${code} ${scriptNumber}${catPart} (${hookAngle}) (Mo) (${aggressiveScale}-5)`;
}

// ─── Lawsuits & options ───────────────────────────────────────────────────────

const RESEARCH_BACKED_LAWSUITS = [
  "Hernia Mesh",
  "PowerPort",
  "Depo-Provera",
  "Social Media Addiction",
  "NY Juvenile Detention",
  "Illinois Juvenile Detention",
];

const LAWSUITS = Object.keys(LAWSUIT_CODES);
const HOOK_CATEGORIES = [
  "Symptom",       // 🚨 Symptom/Diagnosis First — lead with the medical condition
  "Compensation",  // 💰 Compensation/Payout — lead with money/settlements
  "Betrayal",      // 😤 Betrayal/They Never Warned You — anger, manufacturer hid the truth
  "Curiosity",     // 🤔 Curiosity/Big News — intrigue, something happened you need to know
  "Story",         // 👤 Personal Story/Testimonial — first person, emotional journey
  "Pattern",       // 😂 Pattern Interrupt/Skeptic — starts with doubt, humour, or slang to disarm
  "Urgency",       // ⏰ Urgency/Direct CTA — time is running out, do this now
  "Family",        // 🧒 Third Party/Family Angle — about a child, parent, or friend
  "Question",      // ❓ Question Hook — opens with a direct question to the viewer
  "Authority",     // 🔍 Research/Authority — leads with science, data, or official findings
];
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
    researchBackedLawsuits: RESEARCH_BACKED_LAWSUITS,
    otherLawsuits: LAWSUITS.filter(l => !RESEARCH_BACKED_LAWSUITS.includes(l)),
    hookCategories: HOOK_CATEGORIES,
    avatars: AVATARS,
  })),

  // ─── Script Generation ────────────────────────────────────────────────────
  scripts: router({
    generate: protectedProcedure
      .input(z.object({
        lawsuit: z.string(),
        hookCategory: z.string().optional(),
        aggressiveScale: z.number().min(1).max(5),
        avatar: z.string(),
        platform: z.enum(["Meta", "TikTok", "YouTube", "Other"]).default("Other"),
        complianceLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
        referenceScript: z.string().optional(),
        extraInstructions: z.string().optional(),
        scriptNumberStart: z.number().default(1),
        pairsCount: z.number().min(1).max(5).default(3),
      }))
      .mutation(async ({ input }) => {
        // ─── Build targeted KB context (structured, relevant sections only) ──────
        const kbContext = buildKBContext({
          lawsuitKey: input.lawsuit,
          hookCategory: input.hookCategory,
          forIteration: false,
        });

        // ─── Deep research doc for this lawsuit ───────────────────────────────────
        const researchKey = getResearchKey(input.lawsuit);
        const researchDoc = researchKey ? await getResearchDocByKey(researchKey).catch(() => null) : null;
        const researchSection = researchDoc
          ? `\n\n===\n\n## DEEP RESEARCH BRIEF — ${researchDoc.lawsuitKey.toUpperCase()}\nStudy these facts. Use them to ground hooks and body copy in real case details.\n\n${researchDoc.content}`
          : "";

        // ─── 3 most recent news articles for this lawsuit ────────────────────────
        const recentUpdates = await getLawsuitUpdates(researchKey ?? input.lawsuit).catch(() => []);
        const top3Updates = recentUpdates.slice(0, 3);
        const newsSection = top3Updates.length > 0
          ? `\n\n===\n\n## LATEST NEWS — ${input.lawsuit.toUpperCase()} (use these for Authority/Curiosity hooks)\n` +
            top3Updates.map((u, i) => `${i + 1}. **${u.title}** (${u.publishedAt ? new Date(u.publishedAt).toLocaleDateString() : "recent"})\n   ${u.summary}\n   Source: ${u.url}`).join("\n\n")
          : "";

        // ─── Few-shot examples from saved Dashboard scripts ───────────────────────
        const allSaved = await listSavedScripts().catch(() => []);
        const lawsuitSaved = allSaved
          .filter(s => s.lawsuit === input.lawsuit)
          .slice(0, 3); // max 3 examples
        const fewShotSection = lawsuitSaved.length > 0
          ? `\n\n===\n\n## FEW-SHOT EXAMPLES — YOUR BEST SAVED SCRIPTS FOR ${input.lawsuit.toUpperCase()}\nThese are scripts that were reviewed and saved as high quality. Match their voice, energy, and structure.\n\n` +
            lawsuitSaved.map(s =>
              `### ${s.name}\n**Hook:** ${s.hook}\n**Body:** ${s.body}\n**CTA:** ${s.cta}`
            ).join("\n\n")
          : "";

        // ─── Compliance + word count rules ────────────────────────────────────────
        const complianceRules = getComplianceRules(input.complianceLevel as ComplianceLevel);
        const wordCountRule = input.platform === "Meta"
          ? "Scripts for Meta MUST be 75\u2013100 words maximum. Be ruthless \u2014 cut every unnecessary word."
          : "Keep scripts 100\u2013150 words.";

        const systemPrompt = `You are the AKD Media AI Script Writer for AKD Media — a legal advertising company. You have been trained on the following structured knowledge base.

${kbContext}${researchSection}${newsSection}${fewShotSection}

${complianceRules}

CRITICAL RULES:
- Each generation produces PAIRS of scripts. Each pair shares the same body and CTA, but has TWO different hook lines with different hook angles.
- The hook angle is the single most impactful word or short phrase from the hook \u2014 used for naming and data analysis.
- Match the aggressive scale exactly as requested (unless compliance level caps it)
- Write for the specified avatar
- ${wordCountRule}
- Sound conversational and human \u2014 never robotic or formal. Write as a real person speaks.
- ABSOLUTE BAN: Never begin any hook with the word "Imagine". This is non-negotiable.
- If few-shot examples were provided above, study them carefully and match their quality level.
- Return EXACTLY ${input.pairsCount} pairs as a JSON array`;

        const userPrompt = `Generate ${input.pairsCount} script pairs for the following parameters:

Lawsuit: ${input.lawsuit}
Platform: ${input.platform}
Hook Category: ${input.hookCategory ?? "(AI decides — must be one of the 10 valid categories from Section 4)"}
Aggressive Scale: ${input.aggressiveScale}/5
Target Avatar: ${input.avatar}
${input.referenceScript ? `Reference Script (iterate from this):\n${input.referenceScript}` : ""}
${input.extraInstructions ? `Extra Instructions: ${input.extraInstructions}` : ""}

Each pair has:
- Two hook variants (hookLine1 and hookLine2) — same emotional territory, different wording and angle
- hookAngle1: the most impactful word/phrase from hookLine1 (1-3 words, lowercase)
- hookAngle2: the most impactful word/phrase from hookLine2 (1-3 words, lowercase)
- hookCategory: which of the 10 valid categories this pair belongs to (Symptom/Compensation/Betrayal/Curiosity/Story/Pattern/Urgency/Family/Question/Authority)
- body: the shared body paragraph (same for both scripts in the pair)
- cta: the shared call to action (same for both scripts in the pair)

Return a JSON array of exactly ${input.pairsCount} pair objects.`;

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
                        hookCategory: { type: "string" },
                        hookAngle1: { type: "string" },
                        hookLine1: { type: "string" },
                        hookAngle2: { type: "string" },
                        hookLine2: { type: "string" },
                        body: { type: "string" },
                        cta: { type: "string" },
                      },
                      required: ["hookCategory", "hookAngle1", "hookLine1", "hookAngle2", "hookLine2", "body", "cta"],
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
        const parsed = JSON.parse(content) as {
          scripts: Array<{
            hookCategory: string;
            hookAngle1: string;
            hookLine1: string;
            hookAngle2: string;
            hookLine2: string;
            body: string;
            cta: string;
          }>
        };

        // Build flat list of named scripts — each pair becomes 2 scripts
        const namedScripts: Array<{
          name: string;
          hook: string;
          hookAngle: string;
          body: string;
          cta: string;
          pairIndex: number;
          variantIndex: number;
        }> = [];

        parsed.scripts.forEach((pair, pairIdx) => {
          const scriptNum = input.scriptNumberStart + pairIdx;
          const effectiveCategory = input.hookCategory ?? pair.hookCategory;

          namedScripts.push({
            name: buildScriptName(input.lawsuit, effectiveCategory, pair.hookAngle1, scriptNum, input.aggressiveScale),
            hook: pair.hookLine1,
            hookAngle: pair.hookAngle1,
            body: pair.body,
            cta: pair.cta,
            pairIndex: pairIdx,
            variantIndex: 0,
          });

          namedScripts.push({
            name: buildScriptName(input.lawsuit, effectiveCategory, pair.hookAngle2, scriptNum, input.aggressiveScale),
            hook: pair.hookLine2,
            hookAngle: pair.hookAngle2,
            body: pair.body,
            cta: pair.cta,
            pairIndex: pairIdx,
            variantIndex: 1,
          });
        });

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

    regenerateOne: protectedProcedure
      .input(z.object({
        // Original generation params
        lawsuit: z.string(),
        hookCategory: z.string().optional(),
        aggressiveScale: z.number().min(1).max(5),
        avatar: z.string(),
        platform: z.enum(["Meta", "TikTok", "YouTube", "Other"]).default("Other"),
        complianceLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
        scriptNumber: z.number(),
        // The existing script being replaced
        existingScript: z.object({
          name: z.string(),
          hook: z.string(),
          hookAngle: z.string(),
          body: z.string(),
          cta: z.string(),
          pairIndex: z.number(),
          variantIndex: z.number(),
        }),
        // Feedback that triggered the regeneration
        feedbackText: z.string().optional(),
        // Session ID to load the full comment thread
        sessionId: z.number().optional(),
        // Pre-loaded comment thread (passed from frontend)
        _commentThread: z.array(z.string()).optional(),
        // Original generation context (for prompt fidelity)
        referenceScript: z.string().optional(),
        extraInstructions: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // ─── Build targeted KB context for iteration ──────────────────────────────
        const kbContext = buildKBContext({
          lawsuitKey: input.lawsuit,
          hookCategory: input.hookCategory,
          forIteration: true,
        });

        // ─── Deep research doc ────────────────────────────────────────────────────
        const researchKey = getResearchKey(input.lawsuit);
        const researchDoc = researchKey ? await getResearchDocByKey(researchKey).catch(() => null) : null;
        const researchSection = researchDoc
          ? `\n\n===\n\n## DEEP RESEARCH BRIEF — ${researchDoc.lawsuitKey.toUpperCase()}\n\n${researchDoc.content}`
          : "";

        // ─── 3 most recent news articles ─────────────────────────────────────────
        const recentUpdates = await getLawsuitUpdates(researchKey ?? input.lawsuit).catch(() => []);
        const top3Updates = recentUpdates.slice(0, 3);
        const newsSection = top3Updates.length > 0
          ? `\n\n===\n\n## LATEST NEWS — ${input.lawsuit.toUpperCase()}\n` +
            top3Updates.map((u, i) => `${i + 1}. **${u.title}**\n   ${u.summary}`).join("\n\n")
          : "";

        // ─── Few-shot examples from saved Dashboard scripts ───────────────────────
        const allSaved = await listSavedScripts().catch(() => []);
        const lawsuitSaved = allSaved
          .filter(s => s.lawsuit === input.lawsuit)
          .slice(0, 2);
        const fewShotSection = lawsuitSaved.length > 0
          ? `\n\n===\n\n## YOUR BEST SAVED SCRIPTS — USE AS QUALITY BENCHMARK\n\n` +
            lawsuitSaved.map(s => `### ${s.name}\n**Hook:** ${s.hook}\n**Body:** ${s.body}\n**CTA:** ${s.cta}`).join("\n\n")
          : "";

        // ─── Compliance + word count rules ────────────────────────────────────────
        const complianceRules = getComplianceRules(input.complianceLevel as ComplianceLevel);
        const wordCountRule = input.platform === "Meta"
          ? "Scripts for Meta MUST be 75\u2013100 words maximum. Be ruthless \u2014 cut every unnecessary word."
          : "Keep scripts 100\u2013150 words.";

        const systemPrompt = `You are the AKD Media AI Script Writer for AKD Media. You have been trained on the following structured knowledge base.

${kbContext}${researchSection}${newsSection}${fewShotSection}

${complianceRules}

CRITICAL RULES:
- Sound conversational and human \u2014 never robotic or formal. Write as a real person speaks.
- ${wordCountRule}
- ABSOLUTE BAN: Never begin any hook with the word "Imagine". This is non-negotiable.
- Address the feedback provided — this is the most important instruction.
- Return a single script JSON object`;

        const userPrompt = `Regenerate ONE script with the following parameters:

Lawsuit: ${input.lawsuit}
Platform: ${input.platform}
Hook Category: ${input.hookCategory ?? "(AI decides — must be one of the 10 valid categories)"}
Aggressive Scale: ${input.aggressiveScale}/5
Target Avatar: ${input.avatar}

The script being replaced:
Name: ${input.existingScript.name}
Hook: ${input.existingScript.hook}
Body: ${input.existingScript.body}
CTA: ${input.existingScript.cta}

${input.referenceScript ? `Original reference script:\n${input.referenceScript}\n` : ""}
${input.extraInstructions ? `Extra instructions: ${input.extraInstructions}\n` : ""}
${(() => {
  // Build the full comment thread for this script
  return input._commentThread && input._commentThread.length > 0
    ? `ITERATION NOTES (ALL COMMENTS ON THIS SCRIPT — APPLY ALL OF THEM):\n${input._commentThread.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}\n\nAddress ALL of the above notes. They accumulate — do not ignore earlier ones.`
    : input.feedbackText
    ? `Feedback to address: ${input.feedbackText}\n\nAddress this feedback specifically while keeping the same hook category and overall structure.`
    : "Improve this script while keeping the same hook category and overall structure.";
})()}

Return a single script object with: hookCategory, hookAngle (most impactful word/phrase, 1-3 words lowercase), hookLine, body, cta.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "single_script_output",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  hookCategory: { type: "string" },
                  hookAngle: { type: "string" },
                  hookLine: { type: "string" },
                  body: { type: "string" },
                  cta: { type: "string" },
                },
                required: ["hookCategory", "hookAngle", "hookLine", "body", "cta"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : "{}";
        const parsed = JSON.parse(content) as {
          hookCategory: string;
          hookAngle: string;
          hookLine: string;
          body: string;
          cta: string;
        };

        const effectiveCategory = input.hookCategory ?? parsed.hookCategory;
        const newScript = {
          name: buildScriptName(input.lawsuit, effectiveCategory, parsed.hookAngle, input.scriptNumber, input.aggressiveScale),
          hook: parsed.hookLine,
          hookAngle: parsed.hookAngle,
          body: parsed.body,
          cta: parsed.cta,
          pairIndex: input.existingScript.pairIndex,
          variantIndex: input.existingScript.variantIndex,
        };

        return { script: newScript };
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
        scriptContent: z.object({
          hook: z.string(),
          body: z.string(),
          cta: z.string(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        // 1. Save raw feedback to DB
        await saveFeedback({
          scriptId: input.scriptId,
          scriptName: input.scriptName,
          feedbackText: input.feedbackText,
        });
        // 2. Get existing rules so AI can detect near-duplicates and replace instead of append
        const existingRules = getFeedbackRulesList()
          .map(r => `[${r.category.toUpperCase()}${r.lawsuitKey ? ` | ${r.lawsuitKey}` : ""}] ${r.rule}`)
          .join("\n");
        // 3. AI converts feedback into a structured, categorised KB rule
        const structured = await convertFeedbackToStructuredRule({
          scriptName: input.scriptName,
          feedback: input.feedbackText,
          existingRules,
          scriptContent: input.scriptContent,
        });
        // 4. Append/replace the rule in the structured FEEDBACK_RULES block
        appendStructuredFeedbackRule(structured);
        return { success: true, kbRule: structured.rule, category: structured.category };
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
  // ─── Research Docs ────────────────────────────────────────────────────────────
  research: router({
    list: protectedProcedure
      .query(async () => {
        return listResearchDocs();
      }),

    getByKey: protectedProcedure
      .input(z.object({ lawsuitKey: z.string() }))
      .query(async ({ input }) => {
        const doc = await getResearchDocByKey(input.lawsuitKey);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: `No research doc found for lawsuit: ${input.lawsuitKey}` });
        return doc;
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const doc = await getResearchDocById(input.id);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
        return doc;
      }),
  }),

  // ─── Lawsuit Updates (Scraper) ──────────────────────────────────────────────────────────────────────────────
  updates: router({
    // Manual trigger: scrape all 6 research-backed lawsuits
    scrapeAll: protectedProcedure.mutation(async () => {
      const allArticles = await scrapeAllLawsuits();
      const RESEARCH_BACKED = ["Hernia Mesh", "PowerPort", "Depo-Provera", "Social Media Addiction", "NY Juvenile Detention", "Illinois Juvenile Detention"];
      let totalSaved = 0;

      for (const lawsuitKey of RESEARCH_BACKED) {
        const articles = allArticles[lawsuitKey] ?? [];
        // Use AI to generate a concise summary for each article
        const articlesWithSummary = await Promise.all(
          articles.map(async (article) => {
            let summary = article.excerpt;
            if (article.excerpt) {
              try {
                const resp = await invokeLLM({
                  messages: [
                    { role: "system", content: "Summarize the following legal news excerpt in 2-3 sentences. Be factual and concise. Focus on what's new or changed." },
                    { role: "user", content: `Title: ${article.title}\n\n${article.excerpt}` },
                  ],
                });
                const content = resp.choices[0]?.message?.content;
                if (typeof content === "string") summary = content.trim();
              } catch { /* keep raw excerpt */ }
            }
            return { ...article, summary };
          })
        );
        await saveLawsuitUpdates(lawsuitKey, articlesWithSummary);
        totalSaved += articlesWithSummary.length;
      }

      const lastScrape = await getLastScrapeTime();
      return { success: true, totalSaved, lastScrape };
    }),

    // Scrape a single lawsuit
    scrapeOne: protectedProcedure
      .input(z.object({ lawsuitKey: z.string() }))
      .mutation(async ({ input }) => {
        const articles = await scrapeUpdatesForLawsuit(input.lawsuitKey);
        const articlesWithSummary = await Promise.all(
          articles.map(async (article) => {
            let summary = article.excerpt;
            if (article.excerpt) {
              try {
                const resp = await invokeLLM({
                  messages: [
                    { role: "system", content: "Summarize the following legal news excerpt in 2-3 sentences. Be factual and concise. Focus on what's new or changed." },
                    { role: "user", content: `Title: ${article.title}\n\n${article.excerpt}` },
                  ],
                });
                const content = resp.choices[0]?.message?.content;
                if (typeof content === "string") summary = content.trim();
              } catch { /* keep raw excerpt */ }
            }
            return { ...article, summary };
          })
        );
        await saveLawsuitUpdates(input.lawsuitKey, articlesWithSummary);
        return { success: true, count: articlesWithSummary.length };
      }),

    // Get stored updates (optionally filtered by lawsuit)
    getAll: protectedProcedure
      .input(z.object({ lawsuitKey: z.string().optional() }))
      .query(async ({ input }) => {
        const updates = await getLawsuitUpdates(input.lawsuitKey);
        const lastScrape = await getLastScrapeTime();
        return { updates, lastScrape };
      }),
  }),

  savedScripts: router({
    save: protectedProcedure
      .input(z.object({
        name: z.string(),
        lawsuit: z.string(),
        hookCategory: z.string().optional(),
        hookAngle: z.string().optional(),
        hook: z.string(),
        body: z.string(),
        cta: z.string(),
        complianceLevel: z.number().optional(),
        platform: z.string().optional(),
        aggressiveScale: z.number().optional(),
        sessionId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await saveScriptToDashboard(input);
        return { id };
      }),

    list: protectedProcedure
      .query(async () => {
        const scripts = await listSavedScripts();
        // Group by lawsuit
        const grouped: Record<string, typeof scripts> = {};
        for (const s of scripts) {
          if (!grouped[s.lawsuit]) grouped[s.lawsuit] = [];
          grouped[s.lawsuit].push(s);
        }
        return { scripts, grouped };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSavedScript(input.id);
        return { success: true };
      }),
  }),

  // ─── Script Comment Thread ─────────────────────────────────────────────────
  scriptComments: router({
    // Add a comment to a script's thread (always saved immediately, never lost)
    add: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        scriptName: z.string(),
        comment: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const id = await addScriptComment({
          sessionId: input.sessionId,
          scriptName: input.scriptName,
          comment: input.comment,
        });
        return { id, success: true };
      }),

    // Get all comments for a specific script in a session
    list: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        scriptName: z.string(),
      }))
      .query(async ({ input }) => {
        const comments = await getScriptCommentsByName(input.sessionId, input.scriptName);
        return { comments };
      }),

    // Promote a session comment to a global KB rule
    promote: protectedProcedure
      .input(z.object({
        commentId: z.number(),
        comment: z.string(),
        scriptName: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Use AI to convert the raw comment into a structured KB rule
        const structured = await convertFeedbackToStructuredRule({
          scriptName: input.scriptName,
          feedback: input.comment,
          existingRules: getFeedbackRulesList().map(r => r.rule).join("\n"),
        });
        // Append to KB
        appendStructuredFeedbackRule(structured);
        // Mark as promoted in DB
        await promoteScriptComment(input.commentId, structured.rule);
        return { success: true, kbRule: structured.rule };
      }),

    // Get all unpromoted comments for a script (for the promote-to-global dialog)
    unpromoted: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        scriptName: z.string(),
      }))
      .query(async ({ input }) => {
        const comments = await getUnpromotedComments(input.sessionId, input.scriptName);
        return { comments };
      }),
  }),

  notion: router({
    push: protectedProcedure
      .input(z.object({
        scriptName: z.string(),
        hook: z.string(),
        body: z.string(),
        cta: z.string(),
        pageId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const notionToken = process.env.NOTION_TOKEN;
        if (!notionToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Notion token not configured" });

        const targetPageId = input.pageId ?? process.env.NOTION_DEFAULT_PAGE_ID;
        if (!targetPageId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Notion page ID provided" });

        const scriptBody = `HOOK\n${input.hook}\n\nBODY\n${input.body}\n\nCTA\n${input.cta}`;

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
