import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";

export const todos = sqliteTable("todos", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  priority: text("priority", { enum: ["normal", "low", "high"] }).notNull().default("normal"),
  tags: text("tags").notNull().default(""),
  dueAt: integer("due_at", { mode: "number" }),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: integer("updated_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
});
