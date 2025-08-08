"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getBrowserTimezone, getNextOccurrence, isoDate } from "@/lib/recurrence";
import { GoogleAuthProvider as GAP } from "firebase/auth";

type Recurrence = {
  rrule: string;           // e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR"
  timezone: string;        // e.g. "America/Los_Angeles"
  anchor?: string;         // ISO datetime to seed the series (optional)
};

type CommonTask = {
  id: string;
  name: string;
  description?: string;
  difficulty?: number;
  reward?: number;
  frequency: Recurrence;
  dates_completed: Timestamp[];
  streak: number;
  nextDueAt: Timestamp;
  end_date?: Timestamp | null;
  templateRef?: any; // reserved if you later add templates
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export default function TasksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<CommonTask[]>([]);

  // new task form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<number>(1);
  const [reward, setReward] = useState<number>(10);
  const [rrule, setRrule] = useState<string>("FREQ=DAILY");

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
    const colRef = collection(db, "users", user.uid, "commonTasks");
    await addDoc(colRef, {
      name: name.trim(),
      description: description.trim() || null,
      difficulty: Number(difficulty) || 1,
      reward: Number(reward) || 0,
      frequency: { rrule, timezone: tz, anchor: now.toISOString() },
      dates_completed: [],
      streak: 0,
      nextDueAt: Timestamp.fromDate(next),
      end_date: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setName("");
    setDescription("");
  };

  const markTodayComplete = async (t: CommonTask) => {
    if (!user) return;
    const todayIso = isoDate(new Date());
    const alreadyDoneToday = t.dates_completed.some((ts) => isoDate(ts.toDate()) === todayIso);
    if (alreadyDoneToday) return;

    const after = t.nextDueAt?.toDate() ?? new Date();
    const next = getNextOccurrence(t.frequency.rrule, new Date(after.getTime() + 60_000), t.frequency.anchor) || new Date(after);
    // simple streak logic: if we completed on/after expected due date day, increment; else reset
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
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Common Tasks</h1>
        <div className="text-xs opacity-75">Timezone: {tz}</div>
      </header>

      {/* Add task */}
      <section className="border p-4 rounded-xl">
        <h2 className="font-semibold mb-3">Add a task</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2"
            value={rrule}
            onChange={(e) => setRrule(e.target.value)}
          >
            <option value="FREQ=DAILY">Every day</option>
            <option value="FREQ=WEEKLY;BYDAY=MO,WE,FR">Mon/Wed/Fri</option>
            <option value="FREQ=WEEKLY;BYDAY=SA,SU">Weekends</option>
            <option value="FREQ=WEEKLY">Once a week</option>
            <option value="FREQ=MONTHLY;BYMONTHDAY=1">1st of every month</option>
          </select>
          <input
            className="border rounded px-3 py-2 md:col-span-2"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            type="number"
            min={1}
            placeholder="Difficulty (1+)"
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
        </div>
        <button className="mt-3 border rounded px-4 py-2 hover:bg-gray-50" onClick={handleAdd}>
          Add task
        </button>
      </section>

      {/* List */}
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
            return (
              <div key={t.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{t.name}</div>
                  {t.description ? <div className="text-sm opacity-80">{t.description}</div> : null}
                  <div className="mt-1 text-xs opacity-70">
                    RRULE: {t.frequency?.rrule} &nbsp;|&nbsp; Next due: {nextStr} &nbsp;|&nbsp; Streak: {t.streak ?? 0}
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
                  <button
                    className="border rounded px-3 py-2 hover:bg-gray-50"
                    onClick={() => removeTask(t)}
                    title="Delete task"
                  >
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
