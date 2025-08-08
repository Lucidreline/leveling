// src/lib/xp.ts
import { db } from "@/lib/firebase";
import { doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";

/** Atomically add XP to the signed-in user's doc */
export async function awardXp(uid: string, amount: number) {
  if (!uid || !Number.isFinite(amount) || amount === 0) return;
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    xp: increment(Math.round(amount)),
    updatedAt: serverTimestamp(),
  });
}
