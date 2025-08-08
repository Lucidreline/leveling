"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

type UserDoc = {
  username: string | null;
  level: number;
  xp: number;
  createdAt?: any;
  updatedAt?: any;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // username modal state
  const [usernameInput, setUsernameInput] = useState("");
  const needsUsername = user && userDoc && (userDoc.username === null || userDoc.username === "");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      const ref = doc(db, "users", u.uid);

      // Ensure a user doc exists (level=1, xp=0, username=null if missing)
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(
          ref,
          {
            username: null,
            level: 1,
            xp: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // Live subscribe to user doc
      const unsubUser = onSnapshot(ref, (s) => {
        const data = s.data() as UserDoc | undefined;
        if (data) {
          setUserDoc({
            username: data.username ?? null,
            level: typeof data.level === "number" ? data.level : 1,
            xp: typeof data.xp === "number" ? data.xp : 0,
          });
        } else {
          setUserDoc({ username: null, level: 1, xp: 0 });
        }
        setLoading(false);
      });

      return () => unsubUser();
    });

    return () => unsubAuth();
  }, []);

  const saveUsername = async () => {
    if (!user) return;
    const name = usernameInput.trim();
    if (name.length < 3 || name.length > 30) {
      alert("Username must be 3–30 characters.");
      return;
    }
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, {
      username: name,
      updatedAt: serverTimestamp(),
    });
    setUsernameInput("");
  };

  return (
    <main className="p-8 max-w-3xl mx-auto">
      {loading ? (
        <div className="opacity-70 text-sm">Loading…</div>
      ) : !user ? (
        <div>
          <h1 className="text-2xl font-bold">Home</h1>
          <p className="mt-2 text-sm opacity-70">
            You’re signed out. Click <span className="font-medium">Sign in</span> in the top right to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Welcome card */}
          <section className="border rounded-2xl p-6">
            <h1 className="text-2xl font-bold">
              {userDoc?.username ? (
                <>Welcome <span className="font-extrabold">{userDoc.username}</span>.</>
              ) : (
                <>Welcome.</>
              )}
            </h1>
            <div className="mt-2 text-sm">
              <div>Level: <span className="font-semibold">{userDoc?.level ?? 1}</span></div>
              <div>XP: <span className="font-semibold">{userDoc?.xp ?? 0}</span></div>
            </div>
          </section>

          {/* Username modal (shown if missing) */}
          {needsUsername && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                <h2 className="text-lg font-semibold">Choose a username</h2>
                <p className="text-sm opacity-70 mt-1">
                  This doesn’t have to be unique. You can change it later.
                </p>
                <input
                  className="mt-4 border rounded px-3 py-2 w-full"
                  placeholder="Enter a username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveUsername();
                  }}
                />
                <div className="mt-4 flex items-center gap-2">
                  <button
                    className="border rounded px-4 py-2 hover:bg-gray-50"
                    onClick={saveUsername}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
