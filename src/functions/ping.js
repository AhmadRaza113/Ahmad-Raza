const { app } = require("@azure/functions");
const { ok } = require("../http");

app.http("ping", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ping",
  handler: async () => ok({ serverUtc: new Date().toISOString() })
});
