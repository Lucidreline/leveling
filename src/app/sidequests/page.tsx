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

type SideQuest = {
  id: string;
  name: string;
  description?: string;
  difficulty?: number;
  reward?: number;
  etc?: Timestamp | null; // same ETC field as Quests
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
  const [difficulty, setDifficulty] = useState<number>(1);
  const [reward, setReward] = useState<number>(15);
  const [etc, setEtc] = useState<string>("");

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
    const col = collection(db, "users", user.uid, "assignments", "sideQuests");
    const q = query(col, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data: SideQuest[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setRows(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const suggestEtc = () => {
    // basic: difficulty days out
    const days = Math.max(1, Math.min(7, Number(difficulty) || 1));
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
    setEtc(local);
  };

  const addSideQuest = async () => {
    if (!user) return;
    if (!name.trim()) return;
    const colRef = collection(db, "users", user.uid, "assignments", "sideQuests");
    await addDoc(colRef, {
      name: name.trim(),
      description: description.trim() || null,
      difficulty: Number(difficulty) || 1,
      reward: Number(reward) || 0,
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
  };

  const toggleComplete = async (sq: SideQuest) => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "assignments", "sideQuests", sq.id);
    const now = serverTimestamp();
    await updateDoc(ref, {
      is_complete: !sq.is_complete,
      closedAt: sq.is_complete ? null : now,
      updatedAt: now,
    });
  };

  const remove = async (sq: SideQuest) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "assignments", "sideQuests", sq.id));
  };

  if (!user) {
    return (
      <main className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Side Quests</h1>
        <p className="mt-4 text-sm">You need to sign in to manage side quests.</p>
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
      <h1 className="text-2xl font-bold">Side Quests</h1>

      {/* Add side quest */}
      <section className="border p-4 rounded-xl">
        <h2 className="font-semibold mb-3">Add a side quest</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
          <input
            className="border rounded px-3 py-2 md:col-span-2"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
        <button className="mt-3 border rounded px-4 py-2 hover:bg-gray-50" onClick={addSideQuest}>
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
            return (
              <div key={sq.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{sq.name}</div>
                  {sq.description ? <div className="text-sm opacity-80">{sq.description}</div> : null}
                  <div className="text-xs opacity-70 mt-1">
                    Difficulty: {sq.difficulty ?? "-"} | Reward: {sq.reward ?? 0} | ETC: {etcStr}
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
