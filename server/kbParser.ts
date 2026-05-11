/**
 * kbParser.ts
 * Structured Knowledge Base reader.
 *
 * The KB file is divided into named sections. This module parses those sections
 * and exposes targeted getters so the prompt builder can inject only what is
 * relevant for a given generation request — keeping prompts lean and focused.
 *
 * Section markers in the KB file use the format:
 *   ## SECTION N — SECTION_NAME
 *
 * Additionally, the KB now supports a structured FEEDBACK_RULES block
 * (appended by the feedback learning loop) in the format:
 *   <!-- FEEDBACK_RULES_START -->
 *   ...rules...
 *   <!-- FEEDBACK_RULES_END -->
 */

import fs from "fs";
import path from "path";

const KB_PATH = path.join(process.cwd(), "server", "knowledge_base.md");

export type KBSections = {
  coreRules: string;          // Script structure, naming, hook categories, aggressive scale
  complianceRules: string;    // Section 7 — compliance non-negotiables + banned words
  winningPatterns: string;    // Section 8 — winning script patterns (general)
  iterationFramework: string; // Section 9 — iteration types
  lawsuitFacts: string;       // Section 11 — all lawsuit-specific facts
  feedbackRules: string;      // Structured feedback-derived rules (most recent, highest priority)
  bannedPatterns: string;     // Extracted banned words and phrases from Section 7 + feedback
  fullText: string;           // Full KB text (fallback)
};

function readKB(): string {
  try {
    return fs.readFileSync(KB_PATH, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Extract a specific section from the KB by section header keyword.
 * Returns the content between the matched header and the next ## header.
 */
function extractSection(text: string, sectionKeyword: string): string {
  const lines = text.split("\n");
  let inSection = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ") && line.toUpperCase().includes(sectionKeyword.toUpperCase())) {
      inSection = true;
      result.push(line);
      continue;
    }
    if (inSection && line.startsWith("## ")) {
      break; // next section started
    }
    if (inSection) {
      result.push(line);
    }
  }
  return result.join("\n").trim();
}

/**
 * Extract lawsuit-specific facts for a single lawsuit from Section 11.
 * Returns only the subsection for the given lawsuit key.
 */
function extractLawsuitFacts(text: string, lawsuitKey: string): string {
  const section11 = extractSection(text, "LAWSUIT-SPECIFIC FACTS");
  if (!section11) return "";

  // Map lawsuit keys to their section headers in the KB
  const keyMap: Record<string, string[]> = {
    "Hernia Mesh": ["HM", "Hernia Mesh"],
    "PowerPort": ["PP", "PowerPort"],
    "Depo-Provera": ["DEPO", "Depo-Provera", "Depo Provera"],
    "Social Media Addiction": ["SMA", "Social Media"],
    "NY Juvenile Detention": ["NY", "New York", "Juvenile"],
    "Illinois Juvenile Detention": ["ILM", "Illinois", "Juvenile"],
    "Roundup": ["RUP", "Roundup"],
    "Snapchat": ["SAB", "SNAP", "Snapchat"],
    "Dupixent": ["DUP", "Dupixent"],
    "California Women's Prisons": ["CAW", "California Women"],
  };

  const aliases = keyMap[lawsuitKey] ?? [lawsuitKey];
  const lines = section11.split("\n");
  let inSubsection = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith("### ")) {
      const headerUpper = line.toUpperCase();
      const matches = aliases.some(a => headerUpper.includes(a.toUpperCase()));
      if (matches) {
        inSubsection = true;
        result.push(line);
        continue;
      } else if (inSubsection) {
        break; // moved to a different lawsuit subsection
      }
    }
    if (inSubsection) {
      result.push(line);
    }
  }
  return result.join("\n").trim();
}

/**
 * Extract winning script examples for a specific lawsuit from Section 8 and
 * the WINNING SCRIPTS LIBRARY section.
 */
function extractWinningExamples(text: string, lawsuitKey: string): string {
  // Map lawsuit keys to their code abbreviations used in script names
  const codeMap: Record<string, string[]> = {
    "Hernia Mesh": ["HM"],
    "PowerPort": ["PP"],
    "Depo-Provera": ["DEPO", "DP"],
    "Social Media Addiction": ["SMA"],
    "NY Juvenile Detention": ["NY"],
    "Illinois Juvenile Detention": ["ILM"],
    "Roundup": ["RUP"],
    "Snapchat": ["SAB", "SNAP"],
    "Dupixent": ["DUP"],
    "California Women's Prisons": ["CAW"],
    "Rideshare": ["RS"],
    "San Bernardino": ["SB"],
  };

  const codes = codeMap[lawsuitKey] ?? [];
  if (codes.length === 0) return "";

  // Search in the WINNING SCRIPTS LIBRARY section
  const librarySection = extractSection(text, "WINNING SCRIPTS LIBRARY");
  const section8 = extractSection(text, "WINNING SCRIPT PATTERNS");

  const combined = [librarySection, section8].join("\n\n");
  const lines = combined.split("\n");
  let inSubsection = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith("### ")) {
      const headerUpper = line.toUpperCase();
      const matches = codes.some(c => headerUpper.includes(c.toUpperCase()));
      if (matches) {
        inSubsection = true;
        result.push(line);
        continue;
      } else if (inSubsection) {
        break;
      }
    }
    if (inSubsection) {
      result.push(line);
    }
  }
  return result.join("\n").trim();
}

/**
 * Extract structured feedback rules block.
 * These are the AI-converted rules from user feedback — highest priority.
 */
function extractFeedbackRules(text: string): string {
  // Try the structured block first
  const startMarker = "<!-- FEEDBACK_RULES_START -->";
  const endMarker = "<!-- FEEDBACK_RULES_END -->";
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start !== -1 && end !== -1) {
    return text.slice(start + startMarker.length, end).trim();
  }

  // Fallback: return the FEEDBACK LOG section
  const feedbackLog = extractSection(text, "FEEDBACK LOG");
  return feedbackLog;
}

/**
 * Parse the full KB into structured sections.
 */
export function parseKB(): KBSections {
  const text = readKB();
  return {
    coreRules: [
      extractSection(text, "SCRIPT STRUCTURE"),
      extractSection(text, "NAMING CONVENTION"),
      extractSection(text, "HOOK CATEGORIES"),
      extractSection(text, "AGGRESSIVE SCALE"),
    ].filter(Boolean).join("\n\n---\n\n"),
    complianceRules: extractSection(text, "COMPLIANCE RULES"),
    winningPatterns: extractSection(text, "WINNING SCRIPT PATTERNS"),
    iterationFramework: extractSection(text, "ITERATION FRAMEWORK"),
    lawsuitFacts: extractSection(text, "LAWSUIT-SPECIFIC FACTS"),
    feedbackRules: extractFeedbackRules(text),
    bannedPatterns: extractSection(text, "BANNED"),
    fullText: text,
  };
}

/**
 * Build a targeted system prompt context block for a specific generation request.
 * Only injects what is relevant — keeps the prompt lean and focused.
 */
export function buildKBContext(opts: {
  lawsuitKey: string;
  hookCategory?: string;
  forIteration?: boolean;
}): string {
  const text = readKB();
  const sections: string[] = [];

  // 1. Core rules (always included — compact)
  sections.push("## CORE WRITING RULES\n" + [
    extractSection(text, "SCRIPT STRUCTURE"),
    extractSection(text, "NAMING CONVENTION"),
    extractSection(text, "HOOK CATEGORIES"),
  ].filter(Boolean).join("\n\n"));

  // 2. Aggressive scale (always included)
  const aggressiveScale = extractSection(text, "AGGRESSIVE SCALE");
  if (aggressiveScale) sections.push("## AGGRESSIVE SCALE\n" + aggressiveScale);

  // 3. Compliance rules (always included — non-negotiable)
  const compliance = extractSection(text, "COMPLIANCE RULES");
  if (compliance) sections.push("## COMPLIANCE RULES (NON-NEGOTIABLE)\n" + compliance);

  // 4. Structural decisions (always included)
  const structural = extractSection(text, "STRUCTURAL DECISIONS");
  if (structural) sections.push("## STRUCTURAL DECISIONS\n" + structural);

  // 5. Lawsuit-specific facts (only for the selected lawsuit)
  const lawsuitFacts = extractLawsuitFacts(text, opts.lawsuitKey);
  if (lawsuitFacts) {
    sections.push(`## LAWSUIT-SPECIFIC FACTS — ${opts.lawsuitKey.toUpperCase()}\n` + lawsuitFacts);
  }

  // 6. Winning examples for this lawsuit (few-shot anchors from KB)
  const kbExamples = extractWinningExamples(text, opts.lawsuitKey);
  if (kbExamples) {
    sections.push(`## WINNING SCRIPT EXAMPLES — ${opts.lawsuitKey.toUpperCase()}\nStudy these before writing. Match their voice, energy, and structure.\n\n` + kbExamples);
  }

  // 7. Iteration framework (only when generating iterations)
  if (opts.forIteration) {
    const iterFramework = extractSection(text, "ITERATION FRAMEWORK");
    if (iterFramework) sections.push("## ITERATION FRAMEWORK\n" + iterFramework);
  }

  // 8. Feedback rules (highest priority — always last so they override)
  const feedbackRules = extractFeedbackRules(text);
  if (feedbackRules) {
    sections.push("## FEEDBACK-DERIVED RULES (HIGHEST PRIORITY — APPLY THESE FIRST)\nThese rules were learned from real feedback on past scripts. They override general guidelines.\n\n" + feedbackRules);
  }

  return sections.join("\n\n===\n\n");
}

/**
 * Append a structured feedback rule to the KB's FEEDBACK_RULES block.
 * If the block doesn't exist yet, creates it.
 * If a similar rule already exists, replaces it instead of duplicating.
 */
export function appendStructuredFeedbackRule(rule: {
  category: "tone" | "structure" | "compliance" | "cta" | "hook" | "body" | "general";
  lawsuitKey?: string;
  hookCategory?: string;
  rule: string;
  replaces?: string; // if set, replace this existing rule text
}): void {
  let text = readKB();
  const startMarker = "<!-- FEEDBACK_RULES_START -->";
  const endMarker = "<!-- FEEDBACK_RULES_END -->";

  const ruleEntry = `- [${rule.category.toUpperCase()}${rule.lawsuitKey ? ` | ${rule.lawsuitKey}` : ""}${rule.hookCategory ? ` | ${rule.hookCategory}` : ""}] ${rule.rule}`;

  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);

  if (start !== -1 && end !== -1) {
    let block = text.slice(start + startMarker.length, end);

    // If a replacement target is specified, try to replace it
    if (rule.replaces) {
      const replaceTarget = rule.replaces.trim();
      if (block.includes(replaceTarget)) {
        block = block.replace(replaceTarget, ruleEntry);
        text = text.slice(0, start + startMarker.length) + block + text.slice(end);
        fs.writeFileSync(KB_PATH, text, "utf-8");
        return;
      }
    }

    // Check for near-duplicate (same category + lawsuit + first 40 chars of rule)
    const rulePrefix = ruleEntry.slice(0, 60);
    if (block.includes(rulePrefix)) {
      return; // already exists, skip
    }

    // Append to block
    block = block.trimEnd() + "\n" + ruleEntry + "\n";
    text = text.slice(0, start + startMarker.length) + block + text.slice(end);
  } else {
    // Create the block at the end of the file
    text = text.trimEnd() + "\n\n" + startMarker + "\n" + ruleEntry + "\n" + endMarker + "\n";
  }

  fs.writeFileSync(KB_PATH, text, "utf-8");
}

/**
 * Get the current feedback rules as a list of structured entries.
 */
export function getFeedbackRulesList(): Array<{ category: string; lawsuitKey?: string; hookCategory?: string; rule: string }> {
  const text = readKB();
  const block = extractFeedbackRules(text);
  if (!block) return [];

  const results: Array<{ category: string; lawsuitKey?: string; hookCategory?: string; rule: string }> = [];
  for (const line of block.split("\n")) {
    const match = line.match(/^- \[([^\]]+)\] (.+)$/);
    if (!match) continue;
    const tagParts = match[1].split("|").map(s => s.trim());
    const category = tagParts[0]?.toLowerCase() ?? "general";
    const lawsuitKey = tagParts[1];
    const hookCategory = tagParts[2];
    results.push({ category, lawsuitKey, hookCategory, rule: match[2] });
  }
  return results;
}
