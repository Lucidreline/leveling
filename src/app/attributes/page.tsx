"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import Link from "next/link";
import {
  AttributeDoc, AttributeGoal, canLevelUp, levelUpAttribute, requiredXpForAttributeLevel,
} from "@/lib/attributes";

type AttributeRow = AttributeDoc & { id: string };

export default function AttributesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<AttributeRow[]>([]);
  const [loading, setLoading] = useState(true);

  // create form
  const [name, setName] = useState("");

  // edit modal state
  const [editing, setEditing] = useState<AttributeRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editGoals, setEditGoals] = useState<AttributeGoal[]>([]);
  const [newGoal, setNewGoal] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) { setRows([]); setLoading(false); return; }
    const col = collection(db, "users", user.uid, "attributes");
    const q = query(col, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
  }, [user]);

  const atLimit = rows.length >= 5;

  const addAttribute = async () => {
    if (!user || !name.trim() || atLimit) return;
    const colRef = collection(db, "users", user.uid, "attributes");
    await addDoc(colRef, {
      name: name.trim(),
      level: 1,
      xp: 0,
      nextLevel: { goals: [] },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setName("");
  };

  const removeAttribute = async (id: string) => {
    if (!user) return;
    if (!confirm("Delete this attribute?")) return;
    await deleteDoc(doc(db, "users", user.uid, "attributes", id));
  };

  const openEdit = (row: AttributeRow) => {
    setEditing(row);
    setEditName(row.name);
    setEditGoals([...(row.nextLevel?.goals || [])]);
    setNewGoal("");
  };

  const saveEdit = async () => {
    if (!user || !editing) return;
    const ref = doc(db, "users", user.uid, "attributes", editing.id);
    await updateDoc(ref, {
      name: editName.trim() || editing.name,
      nextLevel: { goals: editGoals.map((g) => ({ goal_name: g.goal_name.trim(), is_complete: !!g.is_complete })) },
      updatedAt: serverTimestamp(),
    });
    setEditing(null);
  };

  const toggleGoalComplete = (i: number) =>
    setEditGoals((gs) => gs.map((g, idx) => (idx === i ? { ...g, is_complete: !g.is_complete } : g)));

  const addGoal = () => {
    const g = newGoal.trim();
    if (!g) return;
    setEditGoals((gs) => [...gs, { goal_name: g, is_complete: false }]);
    setNewGoal("");
  };

  const removeGoal = (i: number) => setEditGoals((gs) => gs.filter((_, idx) => idx !== i));

  const doLevelUp = async (row: AttributeRow) => {
    if (!user) return;
    const ok = await levelUpAttribute(user.uid, row.id);
    if (!ok) alert("Requirements not met yet.");
  };

  if (!user) {
    return (
      <main className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">Attributes</h1>
        <p className="mt-2 text-sm">You need to sign in to manage attributes.</p>
        <Link href="/signin" className="mt-2 inline-block underline">Go to sign in</Link>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Attributes</h1>

      {/* Create */}
      <section className="border rounded-2xl p-4">
        <h2 className="font-semibold mb-3">Add attribute (max 5)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm md:col-span-2">
            Name *
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              placeholder="e.g., Strength"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={atLimit}
            />
          </label>
          <div className="flex items-end">
            <button className="border rounded px-4 py-2 hover:bg-gray-50 hover:text-black disabled:opacity-50" onClick={addAttribute} disabled={atLimit}>
              Add
            </button>
          </div>
        </div>
        {atLimit && <div className="text-xs text-red-600 mt-2">You already have 5 attributes.</div>}
      </section>

      {/* List */}
      <section className="space-y-3">
        {loading ? (
          <div className="text-sm opacity-70">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm opacity-70">No attributes yet.</div>
        ) : (
          rows.map((r) => {
            const req = requiredXpForAttributeLevel(r.level ?? 1);
            const eligible = canLevelUp(r as any);

            return (
              <div key={r.id} className="border rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs opacity-70">
                    Level: {r.level ?? 1} | XP: {r.xp ?? 0} | Next level requires: {req} xp
                  </div>
                  {r.nextLevel?.goals?.length ? (
                    <ul className="text-xs mt-1 list-disc pl-5">
                      {r.nextLevel.goals.map((g, i) => (
                        <li key={i} className={g.is_complete ? "line-through" : ""}>
                          {g.goal_name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs opacity-60 mt-1">No goals yet.</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button className="border rounded px-3 py-2 hover:bg-gray-50 hover:text-black" onClick={() => openEdit(r)}>
                    Edit
                  </button>
                  <button
                    className="border rounded px-3 py-2 hover:bg-gray-50 hover:text-black disabled:opacity-50"
                    onClick={() => doLevelUp(r)}
                    disabled={!eligible}
                    title={eligible ? "Level up now" : "Meet goals and XP first"}
                  >
                    Level up
                  </button>
                  <button className="border rounded px-3 py-2 hover:bg-gray-50 hover:text-black" onClick={() => removeAttribute(r.id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white text-gray-900 rounded-2xl p-6 w-full max-w-lg shadow-xl space-y-3">
            <h2 className="text-lg font-semibold">Edit attribute</h2>

            <label className="text-sm block">
              Name
              <input
                className="mt-1 border border-gray-300 rounded px-3 py-2 w-full bg-white text-gray-900 placeholder-gray-500"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>

            <div className="border border-gray-300 rounded p-3">
              <div className="text-sm font-medium mb-2">Goals (for next level)</div>

              <div className="flex gap-2">
                <input
                  className="border border-gray-300 rounded px-3 py-2 flex-1 bg-white text-gray-900 placeholder-gray-500"
                  placeholder="Add a goal (e.g., 10 pull-ups)"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                />
                <button className="border border-gray-300 rounded px-3 py-2 hover:bg-gray-900 hover:text-white" onClick={addGoal}>
                  Add
                </button>
              </div>

              <ul className="mt-2 space-y-2">
                {editGoals.map((g, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={g.is_complete} onChange={() => toggleGoalComplete(i)} />
                      <span className={g.is_complete ? "line-through" : ""}>{g.goal_name}</span>
                    </label>
                    <button className="text-xs underline" onClick={() => removeGoal(i)}>
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  className="border border-gray-300 rounded px-4 py-2 hover:bg-gray-900 hover:text-white"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button
                  className="border border-gray-300 rounded px-4 py-2 hover:bg-gray-900 hover:text-white"
                  onClick={saveEdit}
                >
                  Save
                </button>
              </div>
          </div>
        </div>
      )}
    </main>
  );
}
