export default function Home() {
  return (
    <main className="p-8 max-w-3xl mx-auto">
      {/* Intentionally minimal for Step 1. 
         Step 2 will add the username prompt + welcome + level/xp. */}
      <h1 className="text-2xl font-bold">Home</h1>
      <p className="mt-2 text-sm opacity-70">
        Welcome! Use the nav to explore. We’ll personalize this page next.
      </p>
    </main>
  );
}
