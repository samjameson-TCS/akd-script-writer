import { desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, generatedScripts, feedbackEntries, kbDocuments, InsertGeneratedScript, InsertFeedbackEntry, InsertKbDocument } from "../drizzle/schema";
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
  // drizzle-orm/mysql2 returns [ResultSetHeader, FieldPacket[]] for insert
  const result = await db.insert(generatedScripts).values(data);
  const header = result as unknown as { insertId?: number };
  return header.insertId ?? 0;
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
