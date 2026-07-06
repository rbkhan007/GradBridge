import { db } from "@/lib/db";

export type WebhookEventType =
  | "user.registered"
  | "user.deleted"
  | "conversation.created"
  | "conversation.deleted"
  | "plan.generated"
  | "plan.status_changed"
  | "knowledge.created"
  | "knowledge.updated"
  | "knowledge.deleted"
  | "file.updated"
  | "commit.created"
  | "rag_feedback.created";

export async function dispatchWebhook(
  userId: string,
  event: WebhookEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { userId, enabled: true, events: { contains: event } },
  });
  for (const ep of endpoints) {
    const eventRecord = await db.webhookEvent.create({
      data: { userId, endpointId: ep.id, event, payload: JSON.stringify(payload) },
    });
    fetch(ep.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Event": event, "User-Agent": "GradBridge-Webhook/1.0" },
      body: JSON.stringify({ event, payload, id: eventRecord.id, createdAt: eventRecord.createdAt.toISOString() }),
    })
      .then((res) => {
        db.webhookEvent.update({ where: { id: eventRecord.id }, data: { status: res.ok ? "delivered" : "failed" } }).catch(() => {});
      })
      .catch(() => {
        db.webhookEvent.update({ where: { id: eventRecord.id }, data: { status: "failed" } }).catch(() => {});
      });
  }
}
