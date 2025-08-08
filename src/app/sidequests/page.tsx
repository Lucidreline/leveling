"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { User, onAuthStateChanged } from "firebase/auth";
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
import { awardXp } from "@/lib/xp";
import { awardAttributeXp } from "@/lib/attributes";
import Link from "next/link";

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
  attributeIds?: string[];
  openedAt: Timestamp;
  closedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type AttrOption = { id: string; name: string };

export default function SideQuestsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SideQuest[]>([]);
  const [attrs, setAttrs] = useState<AttrOption[]>([]);
  const [selectedAttrIds, setSelectedAttrIds] = useState<string[]>([]);

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

  // attributes
  useEffect(() => {
    if (!user) {
      setAttrs([]);
      return;
    }
    const col = collection(db, "users", user.uid, "attributes");
    const unsub = onSnapshot(col, (snap) => {
      setAttrs(snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name })));
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
      attributeIds: selectedAttrIds,
      openedAt: serverTimestamp(),
      closedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setName("");
    setDescription("");
    setEtc("");
    setBonus(false);
    setSelectedAttrIds([]);
  };

  const toggleComplete = async (sq: SideQuest) => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "sideQuests", sq.id);
    const now = serverTimestamp();
    const toComplete = !sq.is_complete;

    await updateDoc(ref, {
      is_complete: toComplete,
      closedAt: toComplete ? now : null,
      updatedAt: now,
    });

    const delta = toComplete ? sq.final_reward : -sq.final_reward;
    await awardXp(user.uid, delta);
    if (sq.attributeIds?.length) {
      await awardAttributeXp(user.uid, sq.attributeIds, delta);
    }
  };

  const remove = async (sq: SideQuest) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "sideQuests", sq.id));
  };

  const toggleSelectAttr = (id: string) => {
    setSelectedAttrIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (!user) {
    return (
      <main className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Side Quests</h1>
        <p className="mt-4 text-sm">You need to sign in to manage side quests.</p>
        <Link href="/signin" className="mt-4 inline-block underline">Go to sign in</Link>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Side Quests</h1>

      <section className="border p-4 rounded-xl space-y-3">
        <h2 className="font-semibold">Add a side quest</h2>

        <label className="text-sm block">
          Name *
          <input className="mt-1 border rounded px-3 py-2 w-full" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            Difficulty (1–100)
            <input className="mt-1 border rounded px-3 py-2 w-full" type="number" min={1} max={100} value={difficulty} onChange={(e) => setDifficulty(parseInt(e.target.value || "1"))} />
          </label>

          <label className="text-sm">
            ETC (date/time)
            <input className="mt-1 border rounded px-3 py-2 w-full" type="datetime-local" value={etc} onChange={(e) => setEtc(e.target.value)} />
          </label>
        </div>

        <fieldset className="text-sm">
          <legend className="mb-1">Attach attributes (optional)</legend>
          {attrs.length === 0 ? (
            <div className="text-xs opacity-70">No attributes yet. Create some on the Attributes page.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {attrs.map((a) => (
                <label key={a.id} className="flex items-center gap-2 border rounded px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedAttrIds.includes(a.id)}
                    onChange={() => toggleSelectAttr(a.id)}
                  />
                  {a.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bonus} onChange={(e) => setBonus(e.target.checked)} />
          Apply bonus randomness (±25%)
        </label>

        <button className="border rounded px-4 py-2 hover:bg-gray-50 hover:text-black" onClick={addSideQuest}>
          Add side quest
        </button>
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="text-sm opacity-70">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm opacity-70">No side quests yet.</div>
        ) : (
          rows.map((sq) => {
            const etcStr = sq.etc ? sq.etc.toDate().toLocaleString() : "—";
            const bonusLabel =
              sq.bonus_amount === 0 ? "" : sq.bonus_amount > 0 ? ` +${sq.bonus_amount}xp bonus` : ` ${sq.bonus_amount}xp bonus`;
            return (
              <div key={sq.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{sq.name}</div>
                  {sq.description ? <div className="text-sm opacity-80">{sq.description}</div> : null}
                  <div className="text-xs opacity-70 mt-1">
                    Difficulty: {sq.difficulty} | Reward: {sq.final_reward}xp
                    <span className="opacity-70">{bonusLabel}</span> | ETC: {etcStr}
                    {sq.attributeIds?.length ? <span> | Attributes: {sq.attributeIds.length}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="border rounded px-3 py-2 hover:bg-gray-50 hover:text-black" onClick={() => toggleComplete(sq)}>
                    {sq.is_complete ? "Mark incomplete" : "Mark complete"}
                  </button>
                  <button className="border rounded px-3 py-2 hover:bg-gray-50 hover:text-black" onClick={() => remove(sq)}>
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
