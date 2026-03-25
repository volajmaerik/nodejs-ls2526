import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";

export const todos = sqliteTable("todos", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});
