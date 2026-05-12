# AKD Script Writer — Project Handover Document

> This document contains everything a new Manus chat needs to take over development of the AKD Script Writer project. Keep it private — it contains project IDs and connection details.

---

## 1. Live App

| Item | Value |
|---|---|
| **Production URL** | https://akdscript-qnfo973a.manus.space |
| **Dev / Sandbox URL** | https://3000-i9b67dupxinpd1go316jm-1995b0b5.sg1.manus.computer |
| **Manus Project ID** | `QnFo973ajezBeVYDwDUoyf` |
| **Latest Checkpoint** | `4f390e63` |
| **GitHub Repository** | https://github.com/samjameson-TCS/akd-script-writer |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, tRPC 11 |
| Database ORM | Drizzle ORM (MySQL/TiDB) |
| AI | `invokeLLM()` from `server/_core/llm.ts` — server-side only |
| Auth | Manus OAuth (`protectedProcedure`, `useAuth()`) |
| Markdown rendering | `Streamdown` (named export from `streamdown`) |
| HTML scraping | `cheerio` |
| Tests | Vitest — 37/37 passing |

---

## 3. Manus Platform Secrets

All secrets are **injected automatically by the Manus platform** — they are never stored in code or `.env` files. A new Manus chat that inherits this project will have them automatically. They can be viewed and managed in **Management UI → Settings → Secrets**.

| Secret Key | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string (Manus-hosted DB) |
| `JWT_SECRET` | Signs session cookies |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL (frontend) |
| `OWNER_OPEN_ID` | Owner's Manus identity ID |
| `OWNER_NAME` | Owner's display name |
| `BUILT_IN_FORGE_API_URL` | Manus built-in AI API URL (server-side) |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in AI bearer token (server-side) |
| `VITE_FRONTEND_FORGE_API_URL` | Manus built-in AI URL (client-side) |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus built-in AI bearer token (client-side) |
| `VITE_APP_TITLE` | App display title: "AKD Script Writer" |
| `VITE_APP_LOGO` | App logo URL |
| `VITE_ANALYTICS_ENDPOINT` | Analytics endpoint |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics site ID |

> **Important:** The database is Manus-hosted (TiDB/MySQL) and persists independently of the code. All data — research docs, saved scripts, feedback rules, KB rules — lives in this DB and is tied to the Manus project `QnFo973ajezBeVYDwDUoyf`. It does **not** export to GitHub.

---

## 4. Database Schema

The database has 8 tables. All schema is defined in `drizzle/schema.ts`. Use `webdev_execute_sql` to run migrations — never run raw SQL manually.

| Table | Purpose |
|---|---|
| `users` | Manus OAuth users (id, openId, name, email, role) |
| `generated_scripts` | Every generation session (sessionId, lawsuit, params, scripts JSON) |
| `feedback_entries` | KB feedback rules (scope: session \| global, category, rule text) |
| `kb_documents` | Knowledge base documents (legacy) |
| `research_docs` | 6 deep research briefs (HM, PP, NY, DEPO, SMA, ILM) |
| `lawsuit_updates` | Scraped news articles from lawsuit-information-center.com |
| `saved_scripts` | User-bookmarked scripts from Dashboard |
| `script_comments` | Per-script comment threads (sessionId + scriptName keyed) |

---

## 5. Key Source Files

### Server

| File | Purpose |
|---|---|
| `server/routers.ts` | All tRPC procedures: `scripts.generate`, `scripts.regenerateOne`, `feedback.save`, `scriptComments.add/list/promote`, `savedScripts.save/list/delete`, `research.list/getById`, `updates.scrapeAll/scrapeOne/getAll`, `meta` |
| `server/db.ts` | All DB query helpers. Uses `db.execute()` with raw SQL for `insertId` reliability |
| `server/knowledge_base.md` | AI knowledge base — structured sections: `CORE_RULES`, `LAWSUIT-SPECIFIC FACTS`, `HOOK CATEGORIES`, `BANNED PATTERNS`, `FEEDBACK_RULES`. Feedback rules are appended here automatically |
| `server/kbParser.ts` | Structured KB reader — parses sections, builds context for AI prompt, `convertFeedbackToStructuredRule`, `appendStructuredFeedbackRule` |
| `server/compliance_levels.ts` | 3 compliance level rule sets as injectable prompt strings |
| `server/lawsuitScraper.ts` | Scraper for lawsuit-information-center.com using cheerio |
| `server/akd.test.ts` | Main test file — 37 tests, all db/LLM/scraper/kbParser mocked |

### Client

| File | Purpose |
|---|---|
| `client/src/pages/Generate.tsx` | Main generation page — form + ScriptCard with comment thread, regenerate, save |
| `client/src/pages/Dashboard.tsx` | Saved scripts grouped by lawsuit |
| `client/src/pages/ResearchLibrary.tsx` | 6 research docs with Streamdown markdown viewer |
| `client/src/pages/LawsuitUpdates.tsx` | Scraped news per lawsuit, Refresh buttons |
| `client/src/pages/KnowledgeBase.tsx` | KB viewer/uploader |
| `client/src/pages/History.tsx` | Generation history |
| `client/src/App.tsx` | Routes — all pages registered |
| `client/src/components/DashboardLayout.tsx` | Sidebar nav — Generate, Script Dashboard, Research Library, Lawsuit Updates, History, Knowledge Base |

### Shared / Config

| File | Purpose |
|---|---|
| `drizzle/schema.ts` | DB schema — all 8 tables |
| `shared/types.ts` | Shared TypeScript types |
| `todo.md` | Feature tracking — all phases 1–13 complete |
| `vite.config.ts` | Vite build config |
| `vitest.config.ts` | Test config |

---

## 6. Business Rules & AI Behaviour

These rules are critical — do not change them without the user's approval.

**Script naming format:** `{CODE} {number} ({HookCategory}) ({hookAngle}) (Mo) ({scale}-5)`
Example: `HM 300 (Curiosity) (hid) (Mo) (2-5)`

**Script number start:** Default is 300. User can override in the form.

**Script structure:** Scripts are generated in **pairs** — two separately named scripts per pair, sharing body/CTA but with different hook angles. Never label them "Hook A / Hook B" in the name.

**Hook categories (exactly 10):** Symptom, Compensation, Betrayal, Curiosity, Story, Pattern, Urgency, Family, Question, Authority.

**Avatars (10 options):** Parents (30–55), Young Adults (18–30), Patients, Survivors, Older Adults (55+), Families, Teens (13–17), Former Detainees, Veterans, General Public.

**Lawsuit codes (research-backed primary group):** HM (Hernia Mesh), PP (PowerPort), DEPO (Depo-Provera), SMA (Social Media Addiction), NY (NY Juvenile Detention), ILM (Illinois Juvenile Detention).

**Compliance levels:**
- Level 1 — Broughton Partners (very strict, 14 rules + banned words list)
- Level 2 — Pulaski / Aggregators (moderate, requires disclaimer)
- Level 3 — LCA / Aggregators (most freedom)

**Hard rules (never break):**
- Never begin a script with "Imagine"
- Meta platform: 75–100 word limit enforced
- Write in simple language a 12-year-old would understand — natural speech, not robotic CTAs
- 90% of scripts should include compensation in the hook or at the beginning of the body

**AI prompt structure (per generation):**
1. `buildKBContext` — relevant KB sections only (not full file)
2. Research doc for the selected lawsuit
3. 3 latest news articles for the lawsuit (from `lawsuit_updates` table)
4. 2–3 few-shot examples from saved Dashboard scripts (same lawsuit)
5. Compliance level rules
6. Full comment thread for the script (on regeneration)

---

## 7. Feedback & Learning Loop

When a user submits feedback on a script:
1. Comment is saved immediately to `script_comments` table (never lost)
2. On regeneration, the full comment thread is passed to the AI
3. "Promote to global KB" button converts a session comment into a permanent KB rule
4. `feedback.save` mutation uses AI to categorise the comment into one of: `tone`, `hook`, `body`, `cta`, `structure`, `compliance`, `general`
5. The categorised rule is appended to `knowledge_base.md` under `FEEDBACK_RULES` section
6. Near-duplicate rules are detected and replaced rather than appended

---

## 8. How to Continue Development in a New Manus Chat

1. Open a new Manus chat
2. Paste this message to start:

```
I want to continue developing the AKD Script Writer project. 
The GitHub repo is: https://github.com/samjameson-TCS/akd-script-writer
The Manus project ID is: QnFo973ajezBeVYDwDUoyf
The live app is at: https://akdscript-qnfo973a.manus.space
Latest checkpoint: 4f390e63

Please read the handover document in the repo root (akd-script-writer-handover.md) 
and the todo.md file, then let me know you're ready.
```

3. The new chat will clone the repo and have access to all code
4. Secrets will be re-injected by the Manus platform automatically
5. The database is shared — it's the same Manus-hosted DB, so all data persists

> **Note:** If the new chat creates a brand-new Manus project instead of inheriting this one, the database will be empty. Make sure the new chat connects to the existing project `QnFo973ajezBeVYDwDUoyf` rather than creating a fresh one.

---

## 9. Suggested Next Features (Open Items)

The following features were discussed but not yet built:

| Feature | Description |
|---|---|
| **Daily news auto-scrape** | Schedule the Lawsuit Updates scraper to run every morning automatically so the AI always has fresh articles |
| **KB Feedback Log viewer** | A tab in the Knowledge Base page showing all feedback-derived rules with category tags, so the user can review, edit, or delete rules |
| **Export Dashboard as PDF/CSV** | Download all saved scripts for a lawsuit as a formatted document for team review or compliance submission |
| **Avatar code in script name** | Decide whether "(Mo)" in the script name should reflect the selected avatar (e.g. "(Pa)" for Patients) — currently hardcoded as "Mo" |

---

## 10. Running the Project Locally

```bash
# Install dependencies
pnpm install

# Run dev server (serves both frontend and backend on port 3000)
pnpm dev

# Run tests
pnpm test

# Generate DB migration after schema changes
pnpm drizzle-kit generate
# Then apply via webdev_execute_sql (never run raw SQL manually)
```

---

*Document prepared: May 2026. Project owner: Morane Dewarrat (morane@tortclaimstrategies.com)*
