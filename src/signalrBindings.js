const { input, output } = require("@azure/functions");

const HUB_NAME = process.env.SIGNALR_HUB || "auditorGrid";

const signalRConnectionInfo = input.generic({
  type: "signalRConnectionInfo",
  name: "connectionInfo",
  hubName: HUB_NAME,
  connectionStringSetting: "AzureSignalRConnectionString",
  // For a quick POC, let caller provide userId.
  // In production, bind userId from authentication claims instead.
  userId: "{query.userId}"
});

const signalROutput = output.generic({
  type: "signalR",
  name: "signalROutput",
  hubName: HUB_NAME,
  connectionStringSetting: "AzureSignalRConnectionString"
});

module.exports = { HUB_NAME, signalRConnectionInfo, signalROutput };
