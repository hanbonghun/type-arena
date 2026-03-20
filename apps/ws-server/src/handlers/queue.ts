// apps/ws-server/src/handlers/queue.ts
// placeholder — will be filled in Task 7
import { Connection } from "../types";
import { z } from "zod";
import { QueueJoinEvent, QueueLeaveEvent } from "@type-arena/shared";

export async function handleQueueJoin(
  conn: Connection,
  _event: z.infer<typeof QueueJoinEvent>
): Promise<void> {
  void conn;
}

export function handleQueueLeave(
  conn: Connection,
  _event: z.infer<typeof QueueLeaveEvent>
): void {
  void conn;
}
