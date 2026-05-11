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
