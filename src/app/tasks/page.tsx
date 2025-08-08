"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getBrowserTimezone, getNextOccurrence, isoDate } from "@/lib/recurrence";
import { computeReward } from "@/lib/rewards";
import { awardXp } from "@/lib/xp";
import Link from "next/link";

type Recurrence = {
  rrule: string;
  timezone: string;
  anchor?: string;
};

type CommonTask = {
  id: string;
  name: string;
  description?: string;
  difficulty: number;
  initial_reward: number;
  bonus_amount: number;
  final_reward: number;
  bonus_multiplier: number;
  frequency: Recurrence;
  dates_completed: Timestamp[];
  streak: number;
  nextDueAt: Timestamp;
  end_date?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export default function TasksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<CommonTask[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<number>(10);
  const [rrule, setRrule] = useState<string>("FREQ=DAILY");
  const [bonus, setBonus] = useState<boolean>(false);
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const col = collection(db, "users", user.uid, "commonTasks");
    const q = query(col, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows: CommonTask[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setTasks(rows);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const tz = useMemo(() => getBrowserTimezone(), []);

  const handleAdd = async () => {
    if (!user) return;
    if (!name.trim()) return;

    const now = new Date();
    const next = getNextOccurrence(rrule, now, now.toISOString()) || now;

    const { initial_reward, bonus_amount, final_reward, bonus_multiplier } =
      computeReward("task", Math.min(Math.max(difficulty, 1), 100), bonus);

    const colRef = collection(db, "users", user.uid, "commonTasks");
    await addDoc(colRef, {
      name: name.trim(),
      description: description.trim() || null,
      difficulty: Math.min(Math.max(Number(difficulty) || 1, 1), 100),
      initial_reward,
      bonus_amount,
      final_reward,
      bonus_multiplier,
      frequency: { rrule, timezone: tz, anchor: now.toISOString() },
      dates_completed: [],
      streak: 0,
      nextDueAt: Timestamp.fromDate(next),
      end_date: endDate ? Timestamp.fromDate(new Date(endDate)) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setName("");
    setDescription("");
    setBonus(false);
    setEndDate("");
  };

  const markTodayComplete = async (t: CommonTask) => {
    if (!user) return;
    const todayIso = isoDate(new Date());
    const alreadyDoneToday = t.dates_completed.some((ts) => isoDate(ts.toDate()) === todayIso);
    if (alreadyDoneToday) return;

    const after = t.nextDueAt?.toDate() ?? new Date();
    const next =
      getNextOccurrence(t.frequency.rrule, new Date(after.getTime() + 60_000), t.frequency.anchor) ||
      new Date(after);
    const dueIso = isoDate(after);
    const increment = todayIso === dueIso;
    const newStreak = increment ? (t.streak || 0) + 1 : 1;

    const ref = doc(db, "users", user.uid, "commonTasks", t.id);
    await updateDoc(ref, {
      dates_completed: [...t.dates_completed, Timestamp.now()],
      nextDueAt: Timestamp.fromDate(next),
      streak: newStreak,
      updatedAt: serverTimestamp(),
    });

    // Award XP for this completion
    await awardXp(user.uid, t.final_reward);
  };

  const removeTask = async (t: CommonTask) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "commonTasks", t.id));
  };

  if (!user) {
    return (
      <main className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="mt-4 text-sm">You need to sign in to manage tasks.</p>
        <Link href="/signin" className="mt-4 inline-block underline">
          Go to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Common Tasks</h1>

      <section className="border p-4 rounded-xl">
        <h2 className="font-semibold mb-3">Add a task</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            Name *
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

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

          <label className="text-sm md:col-span-2">
            Description (optional)
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="text-sm">
            Frequency
            <select
              className="mt-1 border rounded px-3 py-2 w-full"
              value={rrule}
              onChange={(e) => setRrule(e.target.value)}
            >
              <option value="FREQ=DAILY">Every day</option>
              <option value="FREQ=WEEKLY;BYDAY=MO,WE,FR">Mon/Wed/Fri</option>
              <option value="FREQ=WEEKLY;BYDAY=SA,SU">Weekends</option>
              <option value="FREQ=WEEKLY">Once a week</option>
              <option value="FREQ=MONTHLY;BYMONTHDAY=1">1st of every month</option>
            </select>
          </label>

          <label className="text-sm">
            End date (optional)
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={bonus} onChange={(e) => setBonus(e.target.checked)} />
            Apply bonus randomness (±25%)
          </label>
        </div>

        <button className="mt-3 border rounded px-4 py-2 hover:bg-gray-50" onClick={handleAdd}>
          Add task
        </button>
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="text-sm opacity-70">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="text-sm opacity-70">No tasks yet.</div>
        ) : (
          tasks.map((t) => {
            const next = t.nextDueAt?.toDate();
            const nextStr = next ? `${next.toLocaleString()}` : "—";
            const completedToday = t.dates_completed.some((ts) => isoDate(ts.toDate()) === isoDate());
            const bonusLabel =
              t.bonus_amount === 0
                ? ""
                : t.bonus_amount > 0
                ? ` +${t.bonus_amount}xp bonus`
                : ` ${t.bonus_amount}xp bonus`;

            return (
              <div key={t.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{t.name}</div>
                  {t.description ? <div className="text-sm opacity-80">{t.description}</div> : null}
                  <div className="mt-1 text-xs opacity-70">
                    Difficulty: {t.difficulty} | Reward: {t.final_reward}xp
                    <span className="opacity-70">{bonusLabel}</span> | Next due: {nextStr} | Streak: {t.streak ?? 0}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="border rounded px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
                    disabled={completedToday}
                    onClick={() => markTodayComplete(t)}
                  >
                    {completedToday ? "Completed today" : "Mark complete"}
                  </button>
                  <button className="border rounded px-3 py-2 hover:bg-gray-50" onClick={() => removeTask(t)}>
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
