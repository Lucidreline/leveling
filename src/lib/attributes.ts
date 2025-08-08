// src/lib/attributes.ts
import { db } from "@/lib/firebase";
import {
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";

export type AttributeGoal = { goal_name: string; is_complete: boolean };
export type AttributeDoc = {
  name: string;
  level: number;
  xp: number;
  nextLevel: {
    xp_required: number;
    goals: AttributeGoal[];
  };
  createdAt?: any;
  updatedAt?: any;
};

/** Add XP to multiple attributes atomically (one write per attribute). */
export async function awardAttributeXp(uid: string, attributeIds: string[], amount: number) {
  if (!uid || !Number.isFinite(amount) || amount === 0) return;
  if (!attributeIds || attributeIds.length === 0) return;

  await Promise.all(
    attributeIds.map(async (attrId) => {
      const ref = doc(db, "users", uid, "attributes", attrId);
      await updateDoc(ref, {
        xp: increment(Math.round(amount)),
        updatedAt: serverTimestamp(),
      });
    })
  );
}

/** Check if the attribute can level up based on nextLevel gate. */
export function canLevelUp(attr: AttributeDoc): boolean {
  if (!attr?.nextLevel) return false;
  const req = attr.nextLevel;
  const goalsMet = (req.goals || []).every((g) => g.is_complete);
  return goalsMet && (attr.xp || 0) >= (req.xp_required || 0);
}

/** Perform the level up: level++, xp -= required, and clear goals for next cycle. */
export async function levelUpAttribute(uid: string, attrId: string) {
  const ref = doc(db, "users", uid, "attributes", attrId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;

  const data = snap.data() as AttributeDoc;
  if (!canLevelUp(data)) return false;

  const required = Math.max(0, data.nextLevel?.xp_required || 0);
  const newXp = Math.max(0, (data.xp || 0) - required);

  await updateDoc(ref, {
    level: (data.level || 1) + 1,
    xp: newXp,
    nextLevel: {
      xp_required: 100, // default for the *next* level; user can edit later
      goals: [],        // user defines new goals later
    },
    updatedAt: serverTimestamp(),
  });

  return true;
}
