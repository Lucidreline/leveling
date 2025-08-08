import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { getNextOccurrence } from "./rruleUtil";

admin.initializeApp();
const db = admin.firestore();

/** format yyyy-mm-dd in a specific IANA timezone (e.g., "America/New_York") */
function isoDateInTz(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}
function sameDayInTz(a: Date, b: Date, tz: string): boolean {
  return isoDateInTz(a, tz) === isoDateInTz(b, tz);
}

/**
 * Runs every 10 minutes (UTC). For each user, advances overdue commonTasks
 * to their next occurrence and resets streak if the due day passed without
 * a completion in the task's timezone.
 */
export const checkDailyCommonTasks = onSchedule(
  { schedule: "every 10 minutes", timeZone: "UTC", region: "us-central1" },
  async () => {
    const now = new Date();
    logger.info("[checkDailyCommonTasks] tick", { now: now.toISOString() });

    const usersSnap = await db.collection("users").select().get();
    logger.info("Scanning users", { count: usersSnap.size });

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const tasksCol = db.collection("users").doc(uid).collection("commonTasks");

      // Tasks whose nextDueAt is in the past/now (candidate overdue)
      const dueSnap = await tasksCol
        .where("nextDueAt", "<=", Timestamp.fromDate(now))
        .get();

      logger.info("User due tasks", { uid, dueCount: dueSnap.size });

      for (const tDoc of dueSnap.docs) {
        const t = tDoc.data() as any;

        // 1) Respect end_date
        if (t.end_date?.toDate && t.end_date.toDate() < now) {
          logger.info("Skipping ended task", { uid, taskId: tDoc.id });
          continue;
        }

        const tz: string = t.frequency?.timezone || "UTC";
        const rrule: string = t.frequency?.rrule || "FREQ=DAILY";
        const anchor: string | undefined = t.frequency?.anchor;

        const nextDueAt: Date = t.nextDueAt?.toDate?.() ?? now;

        // 2) Was it completed on that local due day?
        const completedArray: Date[] = (t.dates_completed || [])
          .map((ts: any) => (ts?.toDate ? ts.toDate() : null))
          .filter(Boolean);

        const completedOnDueDay = completedArray.some((d) =>
          sameDayInTz(d as Date, nextDueAt, tz)
        );

        if (completedOnDueDay) {
          logger.info("Already completed on due day; skipping", {
            uid,
            taskId: tDoc.id,
            dueDay: isoDateInTz(nextDueAt, tz),
          });
          continue;
        }

        // 3) Past due and not completed → advance and reset streak
        if (now.getTime() >= nextDueAt.getTime()) {
          const next =
            getNextOccurrence(
              rrule,
              new Date(nextDueAt.getTime() + 60_000), // nudge forward to get the NEXT after due
              anchor
            ) || nextDueAt;

          await tDoc.ref.update({
            streak: 0,
            nextDueAt: Timestamp.fromDate(next),
            lastMissedAt: Timestamp.fromDate(now),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          logger.info("Advanced overdue task", {
            uid,
            taskId: tDoc.id,
            prevNextDueAt: nextDueAt.toISOString(),
            newNextDueAt: next.toISOString(),
          });
        }
      }
    }

    logger.info("[checkDailyCommonTasks] done");
  }
);
