import { desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, generatedScripts, feedbackEntries, kbDocuments, researchDocs, lawsuitUpdates, savedScripts, scriptComments, buyerSpecs, InsertGeneratedScript, InsertFeedbackEntry, InsertKbDocument, InsertSavedScript, InsertScriptComment, InsertBuyerSpec } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Scripts ─────────────────────────────────────────────────────────────────

export async function saveGeneratedScripts(data: InsertGeneratedScript): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // drizzle-orm/mysql2's query builder returns the ResultSetHeader directly (not in an array),
  // but db.execute() always returns [ResultSetHeader, FieldPacket[]] where result[0].insertId
  // is reliable. We use sql template tag for safe parameterized execution.
  const { sql: sqlCore } = await import("drizzle-orm");
  const scriptsJson = JSON.stringify(data.scripts);
  const result = await db.execute(
    sqlCore`INSERT INTO generated_scripts (lawsuit, hookCategory, aggressiveScale, avatar, referenceScript, extraInstructions, scripts, createdAt)
     VALUES (${data.lawsuit}, ${data.hookCategory ?? null}, ${data.aggressiveScale}, ${data.avatar}, ${data.referenceScript ?? null}, ${data.extraInstructions ?? null}, ${scriptsJson}, NOW())`
  ) as unknown as [{ insertId: number }, unknown];
  return result[0]?.insertId ?? 0;
}

export async function getScriptHistory(filters?: { lawsuit?: string; search?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let query = db.select().from(generatedScripts).orderBy(desc(generatedScripts.createdAt)).$dynamic();
  if (filters?.lawsuit) {
    query = query.where(eq(generatedScripts.lawsuit, filters.lawsuit));
  }
  return query.limit(100);
}

export async function getScriptById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(generatedScripts).where(eq(generatedScripts.id, id)).limit(1);
  return result[0] ?? null;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export async function saveFeedback(data: InsertFeedbackEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(feedbackEntries).values(data);
}

export async function getFeedbackForScript(scriptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(feedbackEntries).where(eq(feedbackEntries.scriptId, scriptId)).orderBy(desc(feedbackEntries.createdAt));
}

// ─── KB Documents ─────────────────────────────────────────────────────────────

export async function saveKbDocument(data: InsertKbDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(kbDocuments).values(data);
}

export async function getKbDocuments() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(kbDocuments).orderBy(desc(kbDocuments.uploadedAt));
}

// ─── Research Docs ────────────────────────────────────────────────────────────

export async function listResearchDocs() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    id: researchDocs.id,
    lawsuitKey: researchDocs.lawsuitKey,
    title: researchDocs.title,
    summary: researchDocs.summary,
    updatedAt: researchDocs.updatedAt,
  }).from(researchDocs).orderBy(researchDocs.lawsuitKey);
}

export async function getResearchDocByKey(lawsuitKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(researchDocs).where(eq(researchDocs.lawsuitKey, lawsuitKey)).limit(1);
  return result[0] ?? null;
}

export async function getResearchDocById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(researchDocs).where(eq(researchDocs.id, id)).limit(1);
  return result[0] ?? null;
}

// ─── Lawsuit Updates (Scraper) ──────────────────────────────────────────────────────────────────────────────

export async function saveLawsuitUpdates(lawsuitKey: string, articles: { title: string; url: string; summary: string; publishedAt: string | null }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete existing updates for this lawsuit key before inserting fresh ones
  const { sql: sqlCore } = await import("drizzle-orm");
  await db.execute(sqlCore`DELETE FROM lawsuit_updates WHERE lawsuitKey = ${lawsuitKey}`);
  if (articles.length === 0) return;
  for (const article of articles) {
    await db.insert(lawsuitUpdates).values({
      lawsuitKey,
      title: article.title,
      summary: article.summary,
      url: article.url,
      publishedAt: article.publishedAt ?? undefined,
    });
  }
}

export async function getLawsuitUpdates(lawsuitKey?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let query = db.select().from(lawsuitUpdates).orderBy(desc(lawsuitUpdates.scrapedAt)).$dynamic();
  if (lawsuitKey) {
    query = query.where(eq(lawsuitUpdates.lawsuitKey, lawsuitKey));
  }
  return query.limit(50);
}

export async function getLastScrapeTime(): Promise<Date | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ scrapedAt: lawsuitUpdates.scrapedAt })
    .from(lawsuitUpdates)
    .orderBy(desc(lawsuitUpdates.scrapedAt))
    .limit(1);
  return result[0]?.scrapedAt ?? null;
}

// ─── Saved Scripts (Dashboard) ────────────────────────────────────────────────

export async function saveScriptToDashboard(data: InsertSavedScript): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { sql: sqlCore } = await import("drizzle-orm");
  const result = await db.execute(
    sqlCore`INSERT INTO saved_scripts (name, lawsuit, hookCategory, hookAngle, hook, body, cta, complianceLevel, platform, aggressiveScale, sessionId, savedAt)
     VALUES (${data.name}, ${data.lawsuit}, ${data.hookCategory ?? null}, ${data.hookAngle ?? null}, ${data.hook}, ${data.body}, ${data.cta}, ${data.complianceLevel ?? null}, ${data.platform ?? null}, ${data.aggressiveScale ?? null}, ${data.sessionId ?? null}, NOW())`
  ) as unknown as [{ insertId: number }, unknown];
  return result[0]?.insertId ?? 0;
}

export async function listSavedScripts() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(savedScripts).orderBy(savedScripts.lawsuit, desc(savedScripts.savedAt));
}

export async function deleteSavedScript(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(savedScripts).where(eq(savedScripts.id, id));
}

export async function isSavedScript(sessionId: number, scriptName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: savedScripts.id })
    .from(savedScripts)
    .where(eq(savedScripts.name, scriptName))
    .limit(1);
  return result.length > 0;
}

// ─── Script Comment Thread Helpers ───────────────────────────────────────────

export async function addScriptComment(data: InsertScriptComment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { sql: sqlCore } = await import("drizzle-orm");
  const result = await db.execute(
    sqlCore`INSERT INTO script_comments (sessionId, scriptName, comment) VALUES (${data.sessionId}, ${data.scriptName}, ${data.comment})`
  ) as unknown as [{ insertId: number }, unknown];
  return result[0]?.insertId ?? 0;
}

export async function getScriptComments(sessionId: number, scriptName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(scriptComments)
    .where(eq(scriptComments.sessionId, sessionId))
    .orderBy(scriptComments.createdAt);
}

export async function getScriptCommentsByName(sessionId: number, scriptName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { and } = await import("drizzle-orm");
  return db.select().from(scriptComments)
    .where(and(eq(scriptComments.sessionId, sessionId), eq(scriptComments.scriptName, scriptName)))
    .orderBy(scriptComments.createdAt);
}

export async function promoteScriptComment(commentId: number, kbRule: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(scriptComments)
    .set({ promoted: 1, kbRule })
    .where(eq(scriptComments.id, commentId));
}

export async function getUnpromotedComments(sessionId: number, scriptName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { and } = await import("drizzle-orm");
  return db.select().from(scriptComments)
    .where(and(
      eq(scriptComments.sessionId, sessionId),
      eq(scriptComments.scriptName, scriptName),
      eq(scriptComments.promoted, 0)
    ))
    .orderBy(scriptComments.createdAt);
}

// ─── Buyer Specs ──────────────────────────────────────────────────────────────

export async function listBuyerSpecs() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(buyerSpecs).orderBy(buyerSpecs.buyerName);
}

export async function getBuyerSpecById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(buyerSpecs).where(eq(buyerSpecs.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getBuyerSpecByName(buyerName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(buyerSpecs).where(eq(buyerSpecs.buyerName, buyerName)).limit(1);
  return result[0] ?? null;
}

export async function upsertBuyerSpec(data: InsertBuyerSpec & { id?: number }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { sql: sqlCore, eq } = await import("drizzle-orm");
  // If id is provided, do a direct UPDATE by id
  if (data.id) {
    await db.update(buyerSpecs)
      .set({
        buyerName: data.buyerName,
        buyerCode: data.buyerCode ?? null,
        lawsuitKeys: data.lawsuitKeys ?? null,
        content: data.content,
        notes: data.notes ?? null,
      })
      .where(eq(buyerSpecs.id, data.id));
    return data.id;
  }
  // Otherwise INSERT with ON DUPLICATE KEY UPDATE (matches on buyerName unique constraint)
  const result = await db.execute(
    sqlCore`INSERT INTO buyer_specs (buyerName, buyerCode, lawsuitKeys, content, notes, createdAt, updatedAt)
     VALUES (${data.buyerName}, ${data.buyerCode ?? null}, ${data.lawsuitKeys ?? null}, ${data.content}, ${data.notes ?? null}, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       buyerCode = VALUES(buyerCode),
       lawsuitKeys = VALUES(lawsuitKeys),
       content = VALUES(content),
       notes = VALUES(notes),
       updatedAt = NOW()`
  ) as unknown as [{ insertId: number }, unknown];
  return result[0]?.insertId ?? 0;
}

export async function deleteBuyerSpec(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(buyerSpecs).where(eq(buyerSpecs.id, id));
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
import { hooks, InsertHook } from "../drizzle/schema";

export async function listHooks(opts?: { category?: string; lawsuitKey?: string; isWinning?: boolean; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(hooks).orderBy(hooks.createdAt);
  let result = rows;
  if (opts?.category) result = result.filter(h => h.category === opts.category);
  if (opts?.lawsuitKey) result = result.filter(h => h.lawsuitKey === opts.lawsuitKey || h.lawsuitKey === null);
  if (opts?.isWinning !== undefined) result = result.filter(h => h.isWinning === (opts.isWinning ? 1 : 0));
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    result = result.filter(h => h.hookLine.toLowerCase().includes(q) || (h.source ?? "").toLowerCase().includes(q));
  }
  return result;
}

export async function insertHook(data: Omit<InsertHook, "id" | "createdAt">): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(hooks).values({
    hookLine: data.hookLine,
    category: data.category,
    source: data.source ?? "manual",
    lawsuitKey: data.lawsuitKey ?? null,
    isWinning: data.isWinning ?? 0,
    notes: data.notes ?? null,
  });
  return (result[0] as unknown as { insertId: number }).insertId ?? 0;
}

export async function updateHook(id: number, data: Partial<Omit<InsertHook, "id" | "createdAt">>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(hooks).set(data).where(eq(hooks.id, id));
}

export async function deleteHook(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(hooks).where(eq(hooks.id, id));
}
