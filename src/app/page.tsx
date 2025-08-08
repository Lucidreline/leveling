"use client";

import { useEffect, useState } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [testDoc, setTestDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const doTestWriteRead = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ref = doc(db, "users", user.uid, "meta", "smoke-test");
      await setDoc(ref, { ok: true, at: serverTimestamp(), uid: user.uid }, { merge: true });
      const snap = await getDoc(ref);
      setTestDoc(snap.exists() ? snap.data() : { missing: true });
    } catch (e) {
      setTestDoc({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">Next.js + Firebase starter</h1>

      {!user ? (
        <div className="mt-6">
          <button
            onClick={signIn}
            className="border rounded-lg px-4 py-2 hover:bg-gray-50"
          >
            Sign in with Google
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              Signed in as <span className="font-medium">{user.email}</span>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="border rounded-lg px-3 py-1 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>

          <button
            onClick={doTestWriteRead}
            disabled={loading}
            className="border rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Testing..." : "Write & read Firestore test doc"}
          </button>

          <pre className="p-3 bg-gray-100 rounded text-xs overflow-x-auto">
            {JSON.stringify(testDoc, null, 2) || "No test run yet."}
          </pre>
        </div>
      )}
    </main>
  );
}
