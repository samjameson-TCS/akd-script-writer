/**
 * Compliance Levels for AKD Script Writer
 *
 * Level 1 — Broughton Partners (Very Strict)
 * Level 2 — Pulaski / Aggregators with Disclaimer (Moderate)
 * Level 3 — LCA / Aggregators (More Freedom)
 *
 * Each level returns a string that is injected directly into the AI system prompt.
 */

export type ComplianceLevel = 1 | 2 | 3;

export const COMPLIANCE_LEVEL_LABELS: Record<ComplianceLevel, string> = {
  1: "Level 1 — Broughton Partners (Very Strict)",
  2: "Level 2 — Pulaski / Aggregators + Disclaimer (Moderate)",
  3: "Level 3 — LCA / Aggregators (More Freedom)",
};

export const COMPLIANCE_LEVEL_DESCRIPTIONS: Record<ComplianceLevel, string> = {
  1: "Most restrictive. No guarantees, no financial amounts, no accusatory language, no banned words. Strict Broughton Partners non-negotiables.",
  2: "Moderate. No direct promises or settlement quotes. No POV talking. No direct solicitation of inmates. No pressure/urgency language. Any stats need cited news sources only.",
  3: "Most freedom. Can be more aggressive. Standard compliance rules still apply but fewer restrictions on tone and language.",
};

// ─── Level 1: Broughton Partners ─────────────────────────────────────────────

const LEVEL_1_RULES = `
## COMPLIANCE LEVEL: 1 — BROUGHTON PARTNERS (VERY STRICT)

You MUST follow ALL of these rules without exception. Any violation is unacceptable.

### BANNED WORDS (never use these in any context):
- recall, payout, owed, significant (for compensation), serious (for compensation), cash (for compensation), check (for compensation), reward, jackpot

### ABSOLUTE PROHIBITIONS:
1. No guarantee of winning or compensation. Never say "you are entitled to compensation", "see if you qualify for compensation", "get what they owe you", or any equivalent.
   - Use instead: "you may have a legal claim", "explore your legal options", "pursue the potential compensation you may be entitled to"

2. No promises of specific financial amounts. Never mention dollar figures, "millions", "6-7 figure range", "significant financial settlements", or "how much you're owed".
   - Use instead: "compensation may be available depending on the details of your case", "you may be eligible to seek compensation for your losses"

3. No misleading claims about outcomes. Never say "we win 100% of cases", "clients always receive compensation", "we'll get you a check in 30 days".
   - Use instead: "each case is unique", "we work to achieve the best possible outcome"

4. No misleading statements about the law firm's role. Never say "we will handle your case directly", "lawyers ready to review your case", "I was sent this video by the law firm".
   - Use instead: "we connect you with experienced attorneys", "our claim specialist will see if you qualify"

5. No unsubstantiated testimonials. Never say "our clients always get what they deserve" or "clients are always satisfied".

6. No misleading assurance of legal representation. Never say "get legal representation now!" or "hire an attorney in seconds".
   - Use instead: "contact us for a free case review", "start your case review now", "take the first step toward seeking legal help"

7. No implying legal action is simple or quick. Never say "file your claim and get paid within weeks" or "it's an easy process".
   - Use instead: "the legal process can take time, but we're here to guide you"

8. No promises of exclusivity. Never say "we are the only law firm that can help you".

9. No use of federal or state agency logos or language implying official government notice. Never use "consumer medical alert", "health alert", "public service health announcement".

10. No use of the word "recall" unless the product has been officially recalled by a government agency.

11. No accusatory language. Never directly accuse companies of misconduct — this can result in defamation countersuits.
    - Cannot say: "[Company] knew that [product] caused [harm]." or "[Company] causes [disease]."
    - Must say: "[Product] may be linked to [harm]." / "Studies suggest a potential link." / "[Company] allegedly knew..." / "Lawsuits claim the manufacturer failed to warn consumers."

12. No profane language.

13. All AI-generated content must be clearly identified: "AI-generated advertisement; not an actual attorney, nor a depiction of real events."

14. No doctors or medical professionals depicted without disclaimer: "Actor portrayal for illustrative purposes only. Not a real doctor."

15. Only cite credible news outlets as sources — never cite law firm websites or competitors.

### TONE:
- Professional, measured, empathetic. No hype, no celebration, no urgency pressure.
- Aggressive scale is capped at 2/5 for this compliance level — even if a higher scale is requested, do not exceed moderate tone.
`;

// ─── Level 2: Pulaski / Aggregators with Disclaimer ──────────────────────────

const LEVEL_2_RULES = `
## COMPLIANCE LEVEL: 2 — PULASKI / AGGREGATORS WITH DISCLAIMER (MODERATE)

You have more freedom than Level 1, but must follow these rules:

1. No direct promises or guarantees of getting paid or instant qualifying.
   - Cannot say: "You will get paid", "You instantly qualify", "Guaranteed compensation"

2. No predictions or quotes on settlement amounts. Do not mention specific dollar figures or ranges.

3. Cannot use statistics or settlement amounts from individual settlements (jury trials) or regional data.
   - Example of what NOT to do: "Los Angeles awarded $4 billion in [lawsuit] cases"

4. Cannot directly solicit inmates or incarcerated people. Use third-party framing.
   - Cannot say: "Were YOU abused in prison?"
   - Must say: "Formerly incarcerated women in CA may have legal options" or "New legal reviews involving CA women's facilities"

5. No pressure language or false sense of urgency and timing.
   - Cannot say: "Act NOW before it's too late", "Deadline is this Friday"

6. Any use of direct quotes, settlement amounts, or real data must be supported with citations and links to credible news articles only — NOT law firm websites.

7. Maintain an appropriate tone. No overly aggressive, hyped, celebratory, or exaggerated content. No dancing, excited reactions, or viral-style presentation.

8. No first-person POV talking as if you are the victim. Write in third-person or general terms.
   - Cannot say: "I was hurt by this drug and I got justice"
   - Must say: "People who used this drug may have legal options"

9. Overall: if it can be viewed as distasteful by an attorney, it is not permitted.

10. All advertisements must be submitted for review and receive written approval before going live. No ad or variation (new hook, visual, script, AI content, royalty free music, edit, or angle) may launch without prior approval. Reflect this in the tone — write for review, not for immediate launch.

11. Aggressive scale for this level: maximum 2/5. Do not exceed moderate tone even if higher is requested.

### TONE:
- Informative, empathetic, third-person. Moderate energy. No hype or pressure.
`;

// ─── Level 3: LCA / Aggregators ──────────────────────────────────────────────

const LEVEL_3_RULES = `
## COMPLIANCE LEVEL: 3 — LCA / AGGREGATORS (MORE FREEDOM)

You have the most freedom of the three levels. Standard legal advertising ethics still apply, but you can:
- Use more aggressive, direct, emotionally charged language
- Use first-person POV (as if the avatar is speaking)
- Reference urgency and timing more directly
- Use stronger emotional hooks (anger, betrayal, shock)
- Go up to the full requested aggressive scale (up to 5/5)

### Still prohibited at all levels:
- Profane language
- Guaranteeing specific financial outcomes ("you will receive $X")
- Impersonating government agencies or using "recall" for non-recalled products
- Directly fabricating quotes from real people or real settlements

### TONE:
- Can be bold, direct, emotionally charged. Match the requested aggressive scale fully.
- First-person storytelling and strong emotional hooks are permitted and encouraged.
`;

// ─── Exported getter ──────────────────────────────────────────────────────────

export function getComplianceRules(level: ComplianceLevel): string {
  switch (level) {
    case 1: return LEVEL_1_RULES;
    case 2: return LEVEL_2_RULES;
    case 3: return LEVEL_3_RULES;
  }
}
