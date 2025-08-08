"use client";

import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useEffect, useState } from "react";

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  return (
    <nav className="bg-black text-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-semibold hover:underline">
          Home
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
      </div>
      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm">{user.email}</span>
          <button
            onClick={() => signOut(auth)}
            className="border border-white/40 rounded px-3 py-1 text-sm hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      ) : (
        <span className="text-sm text-white/70">Not signed in</span>
      )}
    </nav>
  );
}
