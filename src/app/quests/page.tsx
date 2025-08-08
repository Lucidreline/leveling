"use client";

import { useEffect, useMemo, useState } from "react";
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

type Quest = {
  id: string;
  description: string;
  difficulty?: number;
  reward?: number;
  etc?: Timestamp | null;     // Estimated Time of Completion (date/time)
  is_complete: boolean;
  milestones?: { milestone_name: string; reward_percentage: number; is_complete: boolean }[];
  openedAt: Timestamp;
  closedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export default function QuestsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Quest[]>([]);

  // form state
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<number>(1);
  const [reward, setReward] = useState<number>(50);
  const [etc, setEtc] = useState<string>(""); // ISO from <input type="datetime-local">

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
    const col = collection(db, "users", user.uid, "assignments", "quests");
    const q = query(col, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data: Quest[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setRows(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const suggestEtc = () => {
    // naive heuristic: difficulty (1–5+) → add N days
    const days = Math.max(1, Math.min(14, Number(difficulty) || 1));
    const d = new Date();
    d.setDate(d.getDate() + days);
    // format to yyyy-MM-ddTHH:mm (local)
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
    setEtc(local);
  };

  const addQuest = async () => {
    if (!user) return;
    if (!description.trim()) return;
    const colRef = collection(db, "users", user.uid, "assignments", "quests");
    await addDoc(colRef, {
      description: description.trim(),
      difficulty: Number(difficulty) || 1,
      reward: Number(reward) || 0,
      etc: etc ? Timestamp.fromDate(new Date(etc)) : null,
      is_complete: false,
      milestones: [],
      openedAt: serverTimestamp(),
      closedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setDescription("");
    setEtc("");
  };

  const toggleComplete = async (qst: Quest) => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "assignments", "quests", qst.id);
    const now = serverTimestamp();
    await updateDoc(ref, {
      is_complete: !qst.is_complete,
      closedAt: qst.is_complete ? null : now,
      updatedAt: now,
    });
  };

  const remove = async (qst: Quest) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "assignments", "quests", qst.id));
  };

  if (!user) {
    return (
      <main className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Quests</h1>
        <p className="mt-4 text-sm">You need to sign in to manage quests.</p>
        <button
          className="mt-4 border rounded-lg px-4 py-2 hover:bg-gray-50"
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
        >
          Sign in with Google
        </button>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Quests</h1>

      {/* Add quest */}
      <section className="border p-4 rounded-xl">
        <h2 className="font-semibold mb-3">Add a quest</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="border rounded px-3 py-2 md:col-span-2"
            placeholder="Description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            type="number"
            min={1}
            placeholder="Difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(parseInt(e.target.value || "1"))}
          />
          <input
            className="border rounded px-3 py-2"
            type="number"
            min={0}
            placeholder="Reward"
            value={reward}
            onChange={(e) => setReward(parseInt(e.target.value || "0"))}
          />
          <div className="flex gap-2 items-center md:col-span-2">
            <input
              className="border rounded px-3 py-2 w-full"
              type="datetime-local"
              value={etc}
              onChange={(e) => setEtc(e.target.value)}
            />
            <button className="border rounded px-3 py-2 hover:bg-gray-50" onClick={suggestEtc}>
              Suggest ETC
            </button>
          </div>
        </div>
        <button className="mt-3 border rounded px-4 py-2 hover:bg-gray-50" onClick={addQuest}>
          Add quest
        </button>
      </section>

      {/* List */}
      <section className="space-y-3">
        {loading ? (
          <div className="text-sm opacity-70">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm opacity-70">No quests yet.</div>
        ) : (
          rows.map((q) => {
            const etcStr = q.etc ? q.etc.toDate().toLocaleString() : "—";
            return (
              <div key={q.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{q.description}</div>
                  <div className="text-xs opacity-70 mt-1">
                    Difficulty: {q.difficulty ?? "-"} | Reward: {q.reward ?? 0} | ETC: {etcStr}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="border rounded px-3 py-2 hover:bg-gray-50"
                    onClick={() => toggleComplete(q)}
                  >
                    {q.is_complete ? "Mark incomplete" : "Mark complete"}
                  </button>
                  <button className="border rounded px-3 py-2 hover:bg-gray-50" onClick={() => remove(q)}>
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
