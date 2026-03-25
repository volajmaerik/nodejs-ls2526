import { serve } from "@hono/node-server";
import { Hono } from "hono";
import ejs from "ejs";
import { db } from "./db/index.mjs";
import { todos } from "./db/schema.mjs";
import { eq } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  const allTodos = await db.select().from(todos).orderBy(todos.completed);
  const html = await ejs.renderFile("views/index.html", { todos: allTodos });
  return c.html(html);
});

app.use("/api", async (c, next) => {
  console.log("API middleware");
  return next();
});

app.get("/api/data/:name", async (c) => {
  const { name } = c.req.param();
  return c.json({ message: `This is some data for ${name} from the API` });
});

app.get("/todo/:id", async (c) => {
  const id = c.req.param("id");
  const [todo] = await db.select().from(todos).where(eq(todos.id, id));
  if (!todo) {
    const html = await ejs.renderFile("views/404.html");
    return c.html(html, 404);
  }
  const html = await ejs.renderFile("views/todo.html", { todo });
  return c.html(html);
});

app.get("/toggle-todo/:id", async (c) => {
  const id = c.req.param("id");
  const [todo] = await db.select().from(todos).where(eq(todos.id, id));
  if (todo) {
    await db.update(todos).set({ completed: !todo.completed }).where(eq(todos.id, id));
  }
  const from = c.req.query("from");
  return c.redirect(from === "list" ? "/" : `/todo/${id}`);
});

app.post("/edit-todo/:id", async (c) => {
  const id = c.req.param("id");
  const { title } = await c.req.parseBody();
  if (title) {
    await db.update(todos).set({ title }).where(eq(todos.id, id));
  }
  return c.redirect(`/todo/${id}`);
});

app.get("/delete-todo/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(todos).where(eq(todos.id, id));
  return c.redirect("/");
});

app.post("/add-todo", async (c) => {
  const { title } = await c.req.parseBody();
  if (title) {
    await db.insert(todos).values({ title });
  }
  return c.redirect("/");
});

app.notFound(async (c) => {
  const html = await ejs.renderFile("views/404.html");
  return c.html(html, 404);
});

serve({
  fetch: app.fetch,
  port: 4333,
});
