"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  arrayUnion,
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
import Link from "next/link";
import {
  Milestone,
  payoutForMilestone,
  payoutForQuestCompletion,
  validateMilestones,
} from "@/lib/milestones";

type Quest = {
  id: string;
  description: string;
  difficulty: number;

  initial_reward: number;
  bonus_amount: number;
  final_reward: number;
  bonus_multiplier: number;

  etc?: Timestamp | null;
  is_complete: boolean;
  milestones: Milestone[];
  openedAt: Timestamp;
  closedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export default function QuestsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Quest[]>([]);

  // creation form
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<number>(20);
  const [etc, setEtc] = useState<string>("");
  const [bonus, setBonus] = useState<boolean>(false);

  // milestone mini-form (for creation only)
  const [msName, setMsName] = useState("");
  const [msPct, setMsPct] = useState<number>(25);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

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
    const col = collection(db, "users", user.uid, "quests");
    const q = query(col, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data: Quest[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setRows(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const addMilestone = () => {
    if (!msName.trim()) return;
    const pct = Math.max(0, Math.min(100, Number(msPct) || 0));
    const next = [...milestones, { milestone_name: msName.trim(), reward_percentage: pct, is_complete: false }];
    const val = validateMilestones(next);
    if (!val.ok) {
      alert(val.error);
      return;
    }
    setMilestones(next);
    setMsName("");
    setMsPct(25);
  };

  const removeMilestone = (idx: number) => {
    const next = milestones.filter((_, i) => i !== idx);
    const val = validateMilestones(next);
    if (!val.ok) {
      alert(val.error);
      return;
    }
    setMilestones(next);
  };

  const addQuest = async () => {
    if (!user) return;
    if (!description.trim()) return;

    const diff = Math.min(Math.max(Number(difficulty) || 1, 1), 100);

    // Validate milestones <= 100%
    const val = validateMilestones(milestones);
    if (!val.ok) {
      alert(val.error);
      return;
    }

    const { initial_reward, bonus_amount, final_reward, bonus_multiplier } = computeReward("quest", diff, bonus);

    const colRef = collection(db, "users", user.uid, "quests");
    await addDoc(colRef, {
      description: description.trim(),
      difficulty: diff,

      initial_reward,
      bonus_amount,
      final_reward,
      bonus_multiplier,

      etc: etc ? Timestamp.fromDate(new Date(etc)) : null,
      is_complete: false,
      milestones,
      openedAt: serverTimestamp(),
      closedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setDescription("");
    setEtc("");
    setBonus(false);
    setMilestones([]);
  };

  // Mark a single milestone complete (one way action)
  const completeMilestone = async (q: Quest, index: number) => {
    if (!user) return;
    const m = q.milestones[index];
    if (!m || m.is_complete) return;

    // Award milestone payout
    const amt = payoutForMilestone(q.final_reward, m.reward_percentage);
    await awardXp(user.uid, amt);

    // Update milestone state
    const updated = q.milestones.map((mi, i) =>
      i === index ? { ...mi, is_complete: true, completedAt: Timestamp.now() } : mi
    );

    const ref = doc(db, "users", user.uid, "quests", q.id);
    await updateDoc(ref, {
      milestones: updated,
      updatedAt: serverTimestamp(),
    });
  };

  // Toggle quest complete; awarding remainder if any.
  const toggleComplete = async (qst: Quest) => {
    if (!user) return;
    const toComplete = !qst.is_complete;

    const totalPct = qst.milestones.reduce((s, m) => s + (m.reward_percentage || 0), 0);
    const completionAward = payoutForQuestCompletion(qst.final_reward, totalPct);

    const ref = doc(db, "users", user.uid, "quests", qst.id);
    const now = serverTimestamp();

    await updateDoc(ref, {
      is_complete: toComplete,
      closedAt: toComplete ? now : null,
      updatedAt: now,
    });

    // If marking complete, award remainder; if reopening, remove remainder.
    if (completionAward !== 0) {
      await awardXp(user.uid, toComplete ? completionAward : -completionAward);
    }
  };

  const remove = async (qst: Quest) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "quests", qst.id));
  };

  if (!user) {
    return (
      <main className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Quests</h1>
        <p className="mt-4 text-sm">You need to sign in to manage quests.</p>
        <Link href="/signin" className="mt-4 inline-block underline">Go to sign in</Link>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Quests</h1>

      {/* Add quest */}
      <section className="border p-4 rounded-xl space-y-3">
        <h2 className="font-semibold">Add a quest</h2>

        <label className="text-sm block">
          Description *
          <input
            className="mt-1 border rounded px-3 py-2 w-full"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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

        {/* Milestones */}
        <div className="border rounded-lg p-3 space-y-2">
          <div className="font-medium text-sm">Milestones (total ≤ 100%)</div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              className="border rounded px-3 py-2 flex-1"
              placeholder="Milestone name"
              value={msName}
              onChange={(e) => setMsName(e.target.value)}
            />
            <input
              className="border rounded px-3 py-2 w-40"
              type="number"
              min={0}
              max={100}
              value={msPct}
              onChange={(e) => setMsPct(parseInt(e.target.value || "0"))}
              placeholder="% of reward"
            />
            <button className="border rounded px-3 py-2 hover:bg-gray-50" onClick={addMilestone}>
              Add milestone
            </button>
          </div>

          {milestones.length > 0 && (
            <ul className="text-sm list-disc pl-5">
              {milestones.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span>
                    {m.milestone_name} — {m.reward_percentage}%
                  </span>
                  <button className="text-xs underline" onClick={() => removeMilestone(i)}>
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button className="border rounded px-4 py-2 hover:bg-gray-50" onClick={addQuest}>
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
            const bonusLabel =
              q.bonus_amount === 0
                ? ""
                : q.bonus_amount > 0
                ? ` +${q.bonus_amount}xp bonus`
                : ` ${q.bonus_amount}xp bonus`;

            const totalPct = q.milestones.reduce((s, m) => s + (m.reward_percentage || 0), 0);

            return (
              <div key={q.id} className="border rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{q.description}</div>
                    <div className="text-xs opacity-70 mt-1">
                      Difficulty: {q.difficulty} | Reward: {q.final_reward}xp
                      <span className="opacity-70">{bonusLabel}</span> | ETC: {etcStr}
                    </div>
                    <div className="text-[11px] opacity-60 mt-1">
                      Milestone total: {totalPct}% | Completion pays:{" "}
                      {payoutForQuestCompletion(q.final_reward, totalPct)} xp
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="border rounded px-3 py-2 hover:bg-gray-50" onClick={() => toggleComplete(q)}>
                      {q.is_complete ? "Mark incomplete" : "Mark complete"}
                    </button>
                    <button className="border rounded px-3 py-2 hover:bg-gray-50" onClick={() => remove(q)}>
                      Delete
                    </button>
                  </div>
                </div>

                {q.milestones?.length ? (
                  <ul className="text-sm mt-1 divide-y">
                    {q.milestones.map((m, i) => {
                      const payout = payoutForMilestone(q.final_reward, m.reward_percentage);
                      return (
                        <li key={i} className="py-2 flex items-center justify-between">
                          <div>
                            <div className="font-medium">{m.milestone_name}</div>
                            <div className="text-xs opacity-70">
                              {m.reward_percentage}% → {payout} xp
                              {m.is_complete && m.completedAt ? ` — completed` : ""}
                            </div>
                          </div>
                          <div>
                            {m.is_complete ? (
                              <span className="text-xs px-2 py-1 border rounded">Completed</span>
                            ) : (
                              <button
                                className="text-xs border rounded px-3 py-1 hover:bg-gray-50"
                                onClick={() => completeMilestone(q, i)}
                              >
                                Complete milestone
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
