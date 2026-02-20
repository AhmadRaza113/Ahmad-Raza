const { app } = require("@azure/functions");
const { HUB_NAME, signalROutput } = require("../signalrBindings");
const { releaseAllForUser } = require("../lock");

function pickUserId(req, context) {
  // Different runtime versions shape this differently; be flexible.
  return (
    req?.userId ||
    req?.UserId ||
    req?.connectionContext?.userId ||
    req?.connectionContext?.UserId ||
    req?.connectionContext?.user_id ||
    context?.bindingData?.userId ||
    context?.bindingData?.UserId ||
    null
  );
}

/**
 * SignalR disconnect cleanup:
 * When a user disconnects unexpectedly, release all locks owned by that user
 * and broadcast "gridLockChanged" (locked:false) for each lock so everyone updates.
 *
 * Also broadcasts a "gridTyping" ended:true for each released lock so any remote-typing
 * highlights/badges clear even when beforeunload beacon did not fire.
 */
app.generic("signalr_disconnected", {
  trigger: {
    type: "signalRTrigger",
    name: "signalRRequest",
    hubName: HUB_NAME,
    category: "connections",
    event: "disconnected",
    connectionStringSetting: "AzureSignalRConnectionString"
  },
  extraOutputs: [signalROutput],
  handler: async (signalRRequest, context) => {
    const userId = pickUserId(signalRRequest, context);
    if (!userId) {
      context.log("signalr_disconnected: missing userId in payload");
      return;
    }

    let released = [];
    try {
      released = await releaseAllForUser(String(userId));
    } catch (e) {
      context.log("signalr_disconnected: failed to release locks:", e);
      return;
    }

    if (!released.length) return;

    const atUtc = new Date().toISOString();
    const messages = [];
    for (const l of released) {
      // lock release
      messages.push({
        target: "gridLockChanged",
        arguments: [{
          clientId: l.clientId,
          rowId: l.rowId,
          colId: l.colId,
          locked: false,
          userId: String(userId),
          atUtc
        }],
        groupName: `client:${l.clientId}`
      });

      // typing end (best effort)
      messages.push({
        target: "gridTyping",
        arguments: [{
          clientId: l.clientId,
          rowId: l.rowId,
          colId: l.colId,
          userId: String(userId),
          value: null,
          ended: true,
          atUtc
        }],
        groupName: `client:${l.clientId}`
      });
    }

    context.extraOutputs.set(signalROutput, messages);
  }
});
