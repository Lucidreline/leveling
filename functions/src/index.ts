import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
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
  async (event) => {
    const now = new Date();

    const usersSnap = await db.collection("users").select().get();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const tasksCol = db.collection("users").doc(uid).collection("commonTasks");

      const dueSnap = await tasksCol
        .where("nextDueAt", "<=", Timestamp.fromDate(now))
        .get();

      for (const tDoc of dueSnap.docs) {
        const t = tDoc.data() as any;

        // Skip ended tasks
        if (t.end_date?.toDate && t.end_date.toDate() < now) continue;

        const freq = t.frequency || {};
        const tz: string = freq.timezone || "UTC";
        const rrule: string = freq.rrule || "FREQ=DAILY";
        const anchor: string | undefined = freq.anchor;

        const nextDueAt: Date = t.nextDueAt?.toDate?.() ?? now;

        // Did they complete on that local due day?
        const completedArray: Date[] = (t.dates_completed || [])
          .map((ts: any) => (ts?.toDate ? ts.toDate() : null))
          .filter(Boolean);

        const completedOnDueDay = completedArray.some((d) =>
          sameDayInTz(d as Date, nextDueAt, tz)
        );

        if (completedOnDueDay) {
          // Client already advanced it; skip.
          continue;
        }

        // Past due? Advance and reset streak.
        if (now.getTime() >= nextDueAt.getTime()) {
          const next =
            getNextOccurrence(
              rrule,
              new Date(nextDueAt.getTime() + 60_000),
              anchor
            ) || nextDueAt;

          await tDoc.ref.update({
            streak: 0,
            nextDueAt: Timestamp.fromDate(next),
            lastMissedAt: Timestamp.fromDate(now),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }
    // no return (void)
  }
);
