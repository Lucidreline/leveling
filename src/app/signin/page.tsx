"use client";

import { auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async () => {
    try {
      setLoading(true);
      const cred = await signInWithPopup(auth, googleProvider);

      // (Optional) ensure a user doc exists; we'll fill username in Step 2.
      const user = cred.user;
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(
          userRef,
          {
            // username will be collected later
            username: null,
            level: 1,
            xp: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      router.push("/");
    } catch (e) {
      console.error(e);
      alert("Sign in failed. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="border rounded-2xl p-6 max-w-sm w-full">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full border rounded-lg px-4 py-2 hover:bg-gray-50 hover:text-black disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}
