"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { computeReward } from "@/lib/rewards";

type SideQuest = {
  id: string;
  name: string;
  description?: string;
  difficulty: number;

  initial_reward: number;
  bonus_amount: number;
  final_reward: number;
  bonus_multiplier: number;

  etc?: Timestamp | null;
  is_complete: boolean;
  openedAt: Timestamp;
  closedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export default function SideQuestsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SideQuest[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<number>(15);
  const [etc, setEtc] = useState<string>("");
  const [bonus, setBonus] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    const col = collection(db, "users", user.uid, "sideQuests");
    const q = query(col, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data: SideQuest[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setRows(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const addSideQuest = async () => {
    if (!user) return;
    if (!name.trim()) return;

    const diff = Math.min(Math.max(Number(difficulty) || 1, 1), 100);
    const { initial_reward, bonus_amount, final_reward, bonus_multiplier } =
      computeReward("sidequest", diff, bonus);

    const colRef = collection(db, "users", user.uid, "sideQuests");
    await addDoc(colRef, {
      name: name.trim(),
      description: description.trim() || null,
      difficulty: diff,

      initial_reward,
      bonus_amount,
      final_reward,
      bonus_multiplier,

      etc: etc ? Timestamp.fromDate(new Date(etc)) : null,
      is_complete: false,
      openedAt: serverTimestamp(),
      closedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setName("");
    setDescription("");
    setEtc("");
    setBonus(false);
  };

  const toggleComplete = async (sq: SideQuest) => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "sideQuests", sq.id);
    const now = serverTimestamp();
    await updateDoc(ref, {
      is_complete: !sq.is_complete,
      closedAt: sq.is_complete ? null : now,
      updatedAt: now,
    });
  };

  const remove = async (sq: SideQuest) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "sideQuests", sq.id));
  };

  if (!user) {
    return (
     // same file as you have now, except change the unauthenticated JSX:
      <main className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Side Quests</h1>
        <p className="mt-4 text-sm">You need to sign in to manage side quests.</p>
        <a href="/signin" className="mt-4 inline-block underline">Go to sign in</a>
      </main>

    );
  }

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Side Quests</h1>

      {/* Add side quest */}
      <section className="border p-4 rounded-xl space-y-3">
        <h2 className="font-semibold">Add a side quest</h2>

        <label className="text-sm block">
          Name *
          <input
            className="mt-1 border rounded px-3 py-2 w-full"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            Difficulty (1–100)
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              type="number"
              min={1}
              max={100}
              value={difficulty}
              onChange={(e) => setDifficulty(parseInt(e.target.value || "1"))}
            />
          </label>

          <label className="text-sm">
            ETC (date/time)
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              type="datetime-local"
              value={etc}
              onChange={(e) => setEtc(e.target.value)}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bonus} onChange={(e) => setBonus(e.target.checked)} />
          Apply bonus randomness (±25%)
        </label>

        <button className="border rounded px-4 py-2 hover:bg-gray-50" onClick={addSideQuest}>
          Add side quest
        </button>
      </section>

      {/* List */}
      <section className="space-y-3">
        {loading ? (
          <div className="text-sm opacity-70">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm opacity-70">No side quests yet.</div>
        ) : (
          rows.map((sq) => {
            const etcStr = sq.etc ? sq.etc.toDate().toLocaleString() : "—";
            const bonusLabel =
              sq.bonus_amount === 0
                ? ""
                : sq.bonus_amount > 0
                ? ` +${sq.bonus_amount}xp bonus`
                : ` ${sq.bonus_amount}xp bonus`;
            return (
              <div key={sq.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{sq.name}</div>
                  {sq.description ? <div className="text-sm opacity-80">{sq.description}</div> : null}
                  <div className="text-xs opacity-70 mt-1">
                    Difficulty: {sq.difficulty} | Reward: {sq.final_reward}xp
                    <span className="opacity-70">{bonusLabel}</span> | ETC: {etcStr}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="border rounded px-3 py-2 hover:bg-gray-50" onClick={() => toggleComplete(sq)}>
                    {sq.is_complete ? "Mark incomplete" : "Mark complete"}
                  </button>
                  <button className="border rounded px-3 py-2 hover:bg-gray-50" onClick={() => remove(sq)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
