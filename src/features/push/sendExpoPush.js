const { formatPushBody } = require("./formatPushBody");
const {
  listPushTokens,
  removePushTokenByValue,
} = require("./pushTokenService");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function buildPushData({ type, actorId, actorDisplayName, payload, notificationId }) {
  return {
    type: String(type),
    actorId: String(actorId ?? ""),
    actorDisplayName: String(actorDisplayName ?? ""),
    payload: JSON.stringify(payload ?? {}),
    notificationId: notificationId ? String(notificationId) : "",
  };
}

async function sendExpoPushBatch(messages) {
  if (!messages.length) {
    return { ok: true, sent: 0 };
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const rawText = await response.text();
  let result = { data: [] };
  try {
    result = rawText ? JSON.parse(rawText) : result;
  } catch {
    console.error("[sendExpoPush] Invalid JSON response", rawText.slice(0, 200));
    return { ok: false, sent: 0 };
  }

  if (!response.ok) {
    console.error("[sendExpoPush] HTTP error", response.status, result);
    return { ok: false, sent: 0 };
  }

  return { ok: true, sent: messages.length, tickets: result.data ?? [] };
}

async function sendPushForNotification({
  recipientId,
  notificationId,
  type,
  actorId,
  actorDisplayName,
  payload = {},
}) {
  if (!recipientId) {
    return null;
  }

  const tokens = await listPushTokens(recipientId);
  if (!tokens.length) {
    return null;
  }

  const body = formatPushBody({ type, actorDisplayName, payload });
  const data = buildPushData({
    type,
    actorId,
    actorDisplayName,
    payload,
    notificationId,
  });

  const messages = tokens.map((token) => ({
    to: token,
    title: "MyRank",
    body,
    sound: "default",
    channelId: "default",
    data,
  }));

  try {
    const result = await sendExpoPushBatch(messages);
    const tickets = result.tickets ?? [];

    for (let i = 0; i < tickets.length; i += 1) {
      const ticket = tickets[i];
      if (ticket?.status === "error") {
        const detail = ticket.details?.error;
        if (detail === "DeviceNotRegistered") {
          void removePushTokenByValue(recipientId, tokens[i]);
        } else {
          console.error("[sendExpoPush] ticket error", detail, ticket.message);
        }
      }
    }

    return result;
  } catch (error) {
    console.error("[sendExpoPush]", error?.message ?? error);
    return null;
  }
}

module.exports = {
  sendPushForNotification,
  buildPushData,
  formatPushBody,
};
