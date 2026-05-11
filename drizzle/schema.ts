import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const generatedScripts = mysqlTable("generated_scripts", {
  id: int("id").autoincrement().primaryKey(),
  lawsuit: varchar("lawsuit", { length: 64 }).notNull(),
  hookCategory: varchar("hookCategory", { length: 64 }),
  aggressiveScale: int("aggressiveScale").notNull(),
  avatar: varchar("avatar", { length: 64 }).notNull(),
  referenceScript: text("referenceScript"),
  extraInstructions: text("extraInstructions"),
  scripts: json("scripts").notNull(), // Array of { name, body }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedScript = typeof generatedScripts.$inferSelect;
export type InsertGeneratedScript = typeof generatedScripts.$inferInsert;

export const feedbackEntries = mysqlTable("feedback_entries", {
  id: int("id").autoincrement().primaryKey(),
  scriptId: int("scriptId").notNull(),
  scriptName: varchar("scriptName", { length: 128 }).notNull(),
  feedbackText: text("feedbackText").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FeedbackEntry = typeof feedbackEntries.$inferSelect;
export type InsertFeedbackEntry = typeof feedbackEntries.$inferInsert;

export const kbDocuments = mysqlTable("kb_documents", {
  id: int("id").autoincrement().primaryKey(),
  filename: varchar("filename", { length: 256 }).notNull(),
  content: text("content").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type KbDocument = typeof kbDocuments.$inferSelect;
export type InsertKbDocument = typeof kbDocuments.$inferInsert;

export const researchDocs = mysqlTable("research_docs", {
  id: int("id").autoincrement().primaryKey(),
  lawsuitKey: varchar("lawsuitKey", { length: 64 }).notNull().unique(), // e.g. "Hernia Mesh"
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(), // Full markdown content
  summary: text("summary"), // Short summary for AI context injection
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ResearchDoc = typeof researchDocs.$inferSelect;
export type InsertResearchDoc = typeof researchDocs.$inferInsert;

export const lawsuitUpdates = mysqlTable("lawsuit_updates", {
  id: int("id").autoincrement().primaryKey(),
  lawsuitKey: varchar("lawsuitKey", { length: 64 }).notNull(), // e.g. "Hernia Mesh"
  title: varchar("title", { length: 512 }).notNull(),
  summary: text("summary").notNull(), // AI-generated 2-3 sentence summary
  url: varchar("url", { length: 1024 }).notNull(),
  publishedAt: varchar("publishedAt", { length: 64 }), // date string from site
  scrapedAt: timestamp("scrapedAt").defaultNow().notNull(),
});

export type LawsuitUpdate = typeof lawsuitUpdates.$inferSelect;
export type InsertLawsuitUpdate = typeof lawsuitUpdates.$inferInsert;

export const savedScripts = mysqlTable("saved_scripts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),          // e.g. "HM 2 (Curiosity) (hid) (Mo) (2-5)"
  lawsuit: varchar("lawsuit", { length: 64 }).notNull(),
  hookCategory: varchar("hookCategory", { length: 64 }),
  hookAngle: varchar("hookAngle", { length: 128 }),
  hook: text("hook").notNull(),
  body: text("body").notNull(),
  cta: text("cta").notNull(),
  complianceLevel: int("complianceLevel"),                    // 1, 2, or 3
  platform: varchar("platform", { length: 64 }),
  aggressiveScale: int("aggressiveScale"),
  sessionId: int("sessionId"),                               // FK to generated_scripts.id
  savedAt: timestamp("savedAt").defaultNow().notNull(),
});

export type SavedScript = typeof savedScripts.$inferSelect;
export type InsertSavedScript = typeof savedScripts.$inferInsert;
