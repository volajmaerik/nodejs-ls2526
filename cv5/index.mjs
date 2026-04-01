import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import ejs from "ejs";
import { db } from "./db/index.mjs";
import { todos } from "./db/schema.mjs";
import { eq } from "drizzle-orm";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
const connectedClients = new Set();

app.use("/assets/*", serveStatic({ root: "./public" }));

const TODO_PRIORITIES = ["normal", "low", "high"];
const TODO_VIEWS = ["active", "archived", "all"];
const TODO_STATES = ["all", "open", "done"];
const TODO_SORTS = ["updated", "priority", "due", "title", "created"];

const nowInSeconds = () => Math.floor(Date.now() / 1000);

const isValidTodoPriority = (value) => TODO_PRIORITIES.includes(value);

const safeRedirectPath = (value, fallback = "/") => {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.startsWith("/") ? value : fallback;
};

const parseDueDateInput = (value) => {
  if (typeof value !== "string") {
    return { value: undefined };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { error: "Invalid due date format" };
  }

  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);

  if (Number.isNaN(date.getTime())) {
    return { error: "Invalid due date value" };
  }

  return { value: Math.floor(date.getTime() / 1000) };
};

const formatDateForInput = (unixSeconds) => {
  if (!unixSeconds) {
    return "";
  }

  const date = new Date(unixSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeTagsArray = (value) => {
  if (typeof value !== "string") {
    return [];
  }

  const cleaned = value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  return [...new Set(cleaned)];
};

const normalizeTagsString = (value) => normalizeTagsArray(value).join(", ");

const normalizeListFilters = (c) => {
  const q = (c.req.query("q") || "").trim();

  const viewCandidate = c.req.query("view") || "active";
  const view = TODO_VIEWS.includes(viewCandidate) ? viewCandidate : "active";

  const stateCandidate = c.req.query("state") || "all";
  const state = TODO_STATES.includes(stateCandidate) ? stateCandidate : "all";

  const priorityCandidate = c.req.query("priority") || "all";
  const priority = priorityCandidate === "all" || isValidTodoPriority(priorityCandidate) ? priorityCandidate : "all";

  const sortCandidate = c.req.query("sort") || "updated";
  const sort = TODO_SORTS.includes(sortCandidate) ? sortCandidate : "updated";

  return { q, view, state, priority, sort };
};

const buildListPath = (filters) => {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.view !== "active") {
    params.set("view", filters.view);
  }

  if (filters.state !== "all") {
    params.set("state", filters.state);
  }

  if (filters.priority !== "all") {
    params.set("priority", filters.priority);
  }

  if (filters.sort !== "updated") {
    params.set("sort", filters.sort);
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
};

const enrichTodoForView = (todo) => {
  const now = nowInSeconds();
  const tagsArray = normalizeTagsArray(todo.tags);
  const isOverdue = Boolean(todo.dueAt && !todo.completed && todo.dueAt < now);

  return {
    ...todo,
    tagsArray,
    dueDateInput: formatDateForInput(todo.dueAt),
    isOverdue,
  };
};

const sortTodos = (list, sortMode) => {
  const priorityWeight = {
    high: 3,
    normal: 2,
    low: 1,
  };

  return [...list].sort((a, b) => {
    if (sortMode === "priority") {
      return (
        (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0) ||
        b.updatedAt - a.updatedAt
      );
    }

    if (sortMode === "due") {
      const aDue = a.dueAt || Number.POSITIVE_INFINITY;
      const bDue = b.dueAt || Number.POSITIVE_INFINITY;
      return aDue - bDue || b.updatedAt - a.updatedAt;
    }

    if (sortMode === "title") {
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    }

    if (sortMode === "created") {
      return b.createdAt - a.createdAt;
    }

    return b.updatedAt - a.updatedAt;
  });
};

const broadcastTodosChanged = () => {
  const message = JSON.stringify({ type: "todos:changed", timestamp: Date.now() });

  for (const ws of connectedClients) {
    try {
      ws.send(message);
    } catch {
      connectedClients.delete(ws);
    }
  }
};

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen: (_event, ws) => {
      connectedClients.add(ws);
    },
    onClose: (_event, ws) => {
      connectedClients.delete(ws);
    },
    onError: (_event, ws) => {
      connectedClients.delete(ws);
    },
  }))
);

app.get("/", async (c) => {
  const filters = normalizeListFilters(c);
  const allTodos = await db.select().from(todos);
  const now = nowInSeconds();

  const stats = {
    active: allTodos.filter((todo) => !todo.archived).length,
    open: allTodos.filter((todo) => !todo.archived && !todo.completed).length,
    done: allTodos.filter((todo) => !todo.archived && todo.completed).length,
    archived: allTodos.filter((todo) => todo.archived).length,
    overdue: allTodos.filter((todo) => !todo.archived && !todo.completed && todo.dueAt && todo.dueAt < now).length,
  };

  const filtered = allTodos.filter((todo) => {
    if (filters.view === "active" && todo.archived) {
      return false;
    }

    if (filters.view === "archived" && !todo.archived) {
      return false;
    }

    if (filters.state === "open" && todo.completed) {
      return false;
    }

    if (filters.state === "done" && !todo.completed) {
      return false;
    }

    if (filters.priority !== "all" && todo.priority !== filters.priority) {
      return false;
    }

    if (filters.q) {
      const needle = filters.q.toLowerCase();
      const haystack = `${todo.title} ${todo.description} ${todo.tags}`.toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }

    return true;
  });

  const sortedTodos = sortTodos(filtered, filters.sort).map(enrichTodoForView);

  const html = await ejs.renderFile("views/index.html", {
    todos: sortedTodos,
    filters,
    stats,
    listPath: buildListPath(filters),
  });

  return c.html(html);
});

app.use("/api", async (_c, next) => next());

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

  const html = await ejs.renderFile("views/todo.html", {
    todo: enrichTodoForView(todo),
  });

  return c.html(html);
});

app.get("/toggle-todo/:id", async (c) => {
  const id = c.req.param("id");
  const [todo] = await db.select().from(todos).where(eq(todos.id, id));

  if (todo) {
    await db
      .update(todos)
      .set({
        completed: !todo.completed,
        updatedAt: nowInSeconds(),
      })
      .where(eq(todos.id, id));

    broadcastTodosChanged();
  }

  const from = safeRedirectPath(c.req.query("from"), "/");
  return c.redirect(from);
});

app.get("/archive-todo/:id", async (c) => {
  const id = c.req.param("id");
  const archive = c.req.query("archive") !== "0";

  await db
    .update(todos)
    .set({
      archived: archive,
      updatedAt: nowInSeconds(),
    })
    .where(eq(todos.id, id));

  broadcastTodosChanged();

  const returnTo = safeRedirectPath(c.req.query("returnTo"), "/");
  return c.redirect(returnTo);
});

app.post("/edit-todo/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.parseBody();
  const wantsJson = c.req.header("x-requested-with") === "fetch";
  const dataToUpdate = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();

    if (!title) {
      if (wantsJson) {
        return c.json({ ok: false, error: "Title is required" }, 400);
      }
      return c.redirect(`/todo/${id}`);
    }

    dataToUpdate.title = title;
  }

  if (typeof body.description === "string") {
    dataToUpdate.description = body.description.trim();
  }

  if (typeof body.priority === "string") {
    if (!isValidTodoPriority(body.priority)) {
      if (wantsJson) {
        return c.json({ ok: false, error: "Invalid priority" }, 400);
      }
    } else {
      dataToUpdate.priority = body.priority;
    }
  }

  if (typeof body.tags === "string") {
    dataToUpdate.tags = normalizeTagsString(body.tags);
  }

  if (typeof body.dueDate === "string") {
    const dueDateResult = parseDueDateInput(body.dueDate);

    if (dueDateResult.error) {
      if (wantsJson) {
        return c.json({ ok: false, error: dueDateResult.error }, 400);
      }
    } else {
      dataToUpdate.dueAt = dueDateResult.value;
    }
  }

  if (typeof body.archived === "string") {
    dataToUpdate.archived = body.archived === "1" || body.archived === "true";
  }

  if (Object.keys(dataToUpdate).length > 0) {
    dataToUpdate.updatedAt = nowInSeconds();
    await db.update(todos).set(dataToUpdate).where(eq(todos.id, id));
    broadcastTodosChanged();
  }

  if (wantsJson) {
    const [todo] = await db.select().from(todos).where(eq(todos.id, id));

    if (!todo) {
      return c.json({ ok: false, error: "Todo not found" }, 404);
    }

    return c.json({ ok: true, todo: enrichTodoForView(todo) });
  }

  return c.redirect(`/todo/${id}`);
});

app.get("/delete-todo/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(todos).where(eq(todos.id, id));
  broadcastTodosChanged();

  const returnTo = safeRedirectPath(c.req.query("returnTo"), "/");
  return c.redirect(returnTo);
});

app.post("/add-todo", async (c) => {
  const body = await c.req.parseBody();
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!title) {
    return c.redirect("/");
  }

  const priorityRaw = typeof body.priority === "string" ? body.priority : "normal";
  const priority = isValidTodoPriority(priorityRaw) ? priorityRaw : "normal";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const tags = typeof body.tags === "string" ? normalizeTagsString(body.tags) : "";
  const dueDateRaw = typeof body.dueDate === "string" ? body.dueDate : "";
  const dueDateResult = parseDueDateInput(dueDateRaw);

  const now = nowInSeconds();

  await db.insert(todos).values({
    title,
    description,
    priority,
    tags,
    dueAt: dueDateResult.error ? null : dueDateResult.value,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });

  broadcastTodosChanged();
  return c.redirect("/");
});

app.notFound(async (c) => {
  const html = await ejs.renderFile("views/404.html");
  return c.html(html, 404);
});

const server = serve({
  fetch: app.fetch,
  port: 4333,
});

injectWebSocket(server);
