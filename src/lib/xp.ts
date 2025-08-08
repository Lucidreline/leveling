// src/lib/xp.ts
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, updateDoc, increment } from "firebase/firestore";
import { applyLevelUps } from "./progression";

/** Add XP to the user and auto-handle level ups. Returns the final {level, xp, delta, leveledBy}. */
export async function awardXp(uid: string, delta: number) {
  if (!uid || !Number.isFinite(delta) || delta === 0) return { level: 1, xp: 0, delta: 0, leveledBy: 0 };

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  const cur = (snap.data() as any) || {};
  const currentLevel = Math.max(1, Number(cur.level ?? 1));
  const currentXp = Math.max(0, Number(cur.xp ?? 0));

  // first, optimistically bump XP in Firestore so we don't lose writes in races
  await updateDoc(ref, { xp: increment(Math.round(delta)), updatedAt: serverTimestamp() });

  // re-read to be safe (optional, but helps keep consistency if other writes are racing)
  const fresh = await getDoc(ref);
  const data = (fresh.data() as any) || {};
  const afterXp = Math.max(0, Number(data.xp ?? 0));
  const afterLevel = Math.max(1, Number(data.level ?? 1));

  const { level: finalLevel, xp: finalXp, leveledBy } = applyLevelUps(afterLevel, afterXp);

  if (finalLevel !== afterLevel || finalXp !== afterXp) {
    await updateDoc(ref, {
      level: finalLevel,
      xp: finalXp,
      updatedAt: serverTimestamp(),
    });
  }

  return { level: finalLevel, xp: finalXp, delta, leveledBy };
}
