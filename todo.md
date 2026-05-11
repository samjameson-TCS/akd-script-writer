# AKD Script Writer — TODO

## Phase 1: Database & KB Setup
- [x] DB schema: scripts table (id, name, lawsuit, hookCategory, aggressiveScale, avatar, referenceScript, extraInstructions, generatedScripts JSON, createdAt)
- [x] DB schema: feedback table (id, scriptId, scriptName, feedbackText, createdAt)
- [x] DB schema: kb_documents table (id, filename, content, uploadedAt)
- [x] Copy KB markdown file into project storage
- [x] Apply DB migrations

## Phase 2: Backend (tRPC)
- [x] scripts.generate — call LLM with full KB as system prompt, return 3 scripts with auto-generated names
- [x] scripts.history — list all generated scripts with filters
- [x] feedback.save — save inline feedback, append to KB feedback log
- [x] kb.getContent — return current KB text
- [x] kb.uploadDocument — parse uploaded file (PDF/txt), append to KB
- [x] notion.push — push script to Notion as gray callout inside toggle block

## Phase 3: Frontend
- [x] DashboardLayout with sidebar (Generate, History, Knowledge Base)
- [x] Generate page: form (lawsuit, hook category, aggressive scale, avatar, reference script, extra instructions)
- [x] Script output cards with name, copy button, feedback field, save feedback button, Push to Notion button
- [x] History page: list of all generated scripts, search + filter by lawsuit
- [x] Knowledge Base page: viewer of current KB content + document upload

## Phase 4: Polish & Delivery
- [x] Dark elegant theme (deep navy/charcoal + gold accent)
- [x] Loading states, empty states, error handling
- [x] Vitest tests for generate and feedback procedures (9/9 passing)
- [x] Checkpoint + delivery

## Phase 5: Bug Fixes (Session 2)
- [x] Fix "No session ID" error — generate mutation now returns DB insertId as sessionId, wired to feedback save
- [x] Make hookCategory nullable in DB schema (migration applied)
- [x] Add "Never begin with Imagine" as hard compliance rule in KB (Section 7) and system prompt
- [x] Add Platform selector to form (Meta / TikTok / YouTube / Other)
- [x] Enforce Meta word count: 75–100 words max via system prompt when Meta is selected
- [x] Update vitest tests: 12/12 passing (added sessionId, optional fields, platform tests)

## Phase 6: Structural Refactor (Session 3)
- [x] Replace Hook A / Hook B inside one script with PAIR-based generation (2 separate scripts per pair)
- [x] Each script in a pair has its own hook line, its own hook angle, and its own unique name
- [x] Hook angle is the most impactful word/phrase from the hook (used for naming and data analysis)
- [x] Update hook categories to exact 10 user-provided types (Symptom/Compensation/Betrayal/Curiosity/Story/Pattern/Urgency/Family/Question/Authority)
- [x] Remove hookAngle input field — AI now assigns hook angles per script automatically
- [x] Add "Pairs to Generate" control (1-5 pairs) — each pair = 2 scripts
- [x] Update KB Section 3 (naming convention) with new pair structure and examples
- [x] Update KB Section 4 (hook categories) with exact 10 types and descriptions
- [x] Add Section 13 (Permanent Memory) to KB with all structural decisions
- [x] Update vitest tests: 13/13 passing (new pair structure, hook angle assertions, category list)

## Phase 7: Feedback Learning Loop + Inline Regeneration
- [x] Backend: feedback.save mutation also triggers AI to convert raw comment into a structured KB rule and appends it to knowledge_base.md
- [x] Backend: scripts.regenerateOne mutation — regenerates a single script in-place using its original params + feedback + updated KB
- [x] Frontend: feedback submit on a script card triggers KB update (user sees "Feedback saved + KB updated" toast)
- [x] Frontend: each script card has a "Regenerate" button that calls regenerateOne and replaces just that card in the results array
- [x] Frontend: show a loading spinner on the specific card being regenerated (other cards stay static)

## Phase 8: Deep Research Library
- [x] DB schema: add research_docs table (id, lawsuit_key, title, content, created_at)
- [x] Seed 6 deep research docs into DB (HM, PP, NY, DEPO, SMA, ILM)
- [x] tRPC: research.list (all docs, id + title + lawsuit_key) and research.getByKey (full content)
- [x] Research Library page with sidebar nav entry, list view, and full markdown viewer
- [x] Wire AI generate mutation to inject relevant research doc into system prompt when lawsuit matches
- [x] Wire AI regenerateOne to also use research doc
- [x] Update tests for research procedures

## Phase 9: Compliance Levels (1-3)
- [x] Write compliance_levels.ts with full rule sets for all 3 levels
- [x] Add complianceLevel to generate and regenerateOne input schema
- [x] Inject level-specific rules into system prompt for both mutations
- [x] Add Compliance Level selector to Generate form UI (prominent, with label and description)
- [x] Update tests for complianceLevel parameter

## Phase 10: Lawsuit Dropdown Restructure + News Scraper
- [x] Restructure lawsuit dropdown: research-backed lawsuits as primary group (labelled), others as secondary group
- [x] Add lawsuit_updates DB table (id, lawsuit_key, title, summary, url, published_at, scraped_at)
- [x] Build scraper backend: fetch and parse lawsuit-information-center.com articles per lawsuit
- [x] tRPC mutation: scrapeUpdates (manual trigger) + query: getUpdates (per lawsuit)
- [x] Build Lawsuit Updates page with per-lawsuit news cards and manual Refresh button
- [x] Add Lawsuit Updates to sidebar nav
- [x] Update tests (22/22 passing — scraper mocked in existing test suite)

## Phase 11: Save to Dashboard
- [x] DB schema: add saved_scripts table (id, name, lawsuit, hookCategory, hookAngle, hook, body, cta, complianceLevel, platform, aggressiveScale, sessionId, savedAt)
- [x] tRPC: savedScripts.save, savedScripts.list (grouped by lawsuit), savedScripts.delete
- [x] Add "Save to Dashboard" button on each script card in Generate.tsx (with saved/unsaved toggle state)
- [x] Build Dashboard page: saved scripts grouped by lawsuit accordion, each script shows name/hook/body/CTA/badges, copy + delete buttons
- [x] Add Dashboard to sidebar nav
- [x] Update tests for savedScripts procedures — 28/28 passing

## Phase 12: AI Learning Architecture Upgrade

- [x] Restructure knowledge_base.md into 5 named sections: CORE_RULES, LAWSUIT_RULES, HOOK_EXAMPLES, BANNED_PATTERNS, FEEDBACK_RULES
- [x] Build structured KB reader (kbParser.ts): parse sections from file, expose per-section getters
- [x] Upgrade system prompt builder: inject only relevant sections (global + lawsuit-specific) instead of full KB
- [x] Inject 3 most recent news articles for selected lawsuit into system prompt
- [x] Inject 2-3 few-shot examples from saved Dashboard scripts (same lawsuit) into system prompt
- [x] Upgrade feedback.save: AI categorises feedback into correct section (tone/hook/body/cta/structure/compliance/general), updates/replaces existing rule instead of appending raw text
- [x] Update tests for upgraded feedback and generate procedures — 28/28 passing
