// src/lib/attributes.ts
import { db } from "@/lib/firebase";
import { doc, updateDoc, increment, serverTimestamp, getDoc } from "firebase/firestore";
import { applyLevelUps, xpRequiredForLevel } from "./progression";

export type AttributeGoal = { goal_name: string; is_complete: boolean };
export type AttributeDoc = {
  name: string;
  level: number;
  xp: number;
  // goals for NEXT level; user manages these
  nextLevel: {
    goals: AttributeGoal[];
  };
  createdAt?: any;
  updatedAt?: any;
};

export function requiredXpForAttributeLevel(level: number) {
  return xpRequiredForLevel(level); // same curve as users
}

/** Add XP to multiple attributes atomically (one write per attribute). */
export async function awardAttributeXp(uid: string, attributeIds: string[], amount: number) {
  if (!uid || !Number.isFinite(amount) || amount === 0) return;
  if (!attributeIds?.length) return;

  await Promise.all(
    attributeIds.map(async (attrId) => {
      const ref = doc(db, "users", uid, "attributes", attrId);
      await updateDoc(ref, {
        xp: increment(Math.round(amount)),
        updatedAt: serverTimestamp(),
      });

      // read + auto-level
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as AttributeDoc;

      const { level: newLevel, xp: newXp, leveledBy } = applyLevelUps(data.level ?? 1, data.xp ?? 0);

      if (leveledBy > 0) {
        await updateDoc(ref, {
          level: newLevel,
          xp: newXp,
          // clear goals for the *next* level; user can define new ones
          nextLevel: { goals: [] },
          updatedAt: serverTimestamp(),
        });
      }
    })
  );
}

/** Check if attribute can level up (goals AND xp gate). */
export function canLevelUp(attr: AttributeDoc): boolean {
  const req = requiredXpForAttributeLevel(attr.level ?? 1);
  const goalsMet = (attr.nextLevel?.goals || []).every((g) => g.is_complete);
  return goalsMet && (attr.xp || 0) >= req;
}

/** Manual level-up: require goals + enough XP per curve; then consume XP and advance. */
export async function levelUpAttribute(uid: string, attrId: string) {
  const ref = doc(db, "users", uid, "attributes", attrId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;

  const data = snap.data() as AttributeDoc;
  if (!canLevelUp(data)) return false;

  const required = requiredXpForAttributeLevel(data.level ?? 1);
  const newXp = Math.max(0, (data.xp || 0) - required);

  await updateDoc(ref, {
    level: (data.level || 1) + 1,
    xp: newXp,
    nextLevel: { goals: [] }, // user defines new goals later
    updatedAt: serverTimestamp(),
  });

  return true;
}
