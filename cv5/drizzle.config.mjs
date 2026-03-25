export default {
  schema: "./db/schema.mjs",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:local.db",
  },
};
