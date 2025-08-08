"use client";

import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setUsername(null);
      return;
    }
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any | undefined;
      setUsername(data?.username ?? null);
    });
    return () => unsub();
  }, [user]);

  return (
    <nav className="bg-black text-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-semibold hover:underline">
          {username || "Home"}
        </Link>
        <Link href="/tasks" className="hover:underline">
          Tasks
        </Link>
        <Link href="/quests" className="hover:underline">
          Quests
        </Link>
        <Link href="/sidequests" className="hover:underline">
          Side Quests
        </Link>
        <Link href="/attributes" className="hover:underline">
          Attributes
        </Link>
      </div>

      {user ? (
        <button
          onClick={() => signOut(auth)}
          className="border border-white/40 rounded px-3 py-1 text-sm hover:bg-white/10"
        >
          Sign out
        </button>
      ) : (
        <Link
          href="/signin"
          className="text-sm underline decoration-white/60 underline-offset-4 hover:decoration-white"
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}
