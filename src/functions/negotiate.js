const { app } = require("@azure/functions");
const { corsHeaders, noContent } = require("../http");
const { signalRConnectionInfo, signalROutput } = require("../signalrBindings");

app.http("negotiate", {
  methods: ["POST", "GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "negotiate",
  extraInputs: [signalRConnectionInfo],
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || "anonymous";
    const clientId = url.searchParams.get("clientId");

    // Put this user into the per-client group (client:123) so we can broadcast only to that tenant/client.
    // Group actions are supported by the SignalR output binding. See docs.
    if (clientId) {
      context.extraOutputs.set(signalROutput, {
        action: "add",
        groupName: `client:${clientId}`,
        userId
      });
    }

    const info = context.extraInputs.get(signalRConnectionInfo);
    return {
      status: 200,
      headers: corsHeaders(),
      body: JSON.stringify(info)
    };
  }
});
