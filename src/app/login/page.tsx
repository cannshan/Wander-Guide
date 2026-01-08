"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(), // ✅ trim to avoid invisible whitespace issues
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // ✅ If /tours doesn't exist yet, don't 404 after login
    router.push("/categories");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 border rounded-xl p-6">
        <h1 className="text-xl font-bold">Admin Login</h1>

        <input
          className="border rounded-lg p-2 w-full"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          className="border rounded-lg p-2 w-full"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={signIn}
          disabled={loading}
          className="bg-black text-white rounded-lg px-4 py-2 w-full disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-xs text-gray-500">
          Create your admin user in Supabase → Authentication → Users.
        </p>

        <p className="text-xs text-gray-500">
          Note: this file must be located at{" "}
          <span className="font-mono">src/app/login/page.tsx</span> for the{" "}
          <span className="font-mono">/login</span> route to work.
        </p>
      </div>
    </div>
  );
}
