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
