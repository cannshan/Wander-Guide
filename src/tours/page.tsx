"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Tour = {
  id: string;
  title: string;
  city: string | null;
  is_published?: boolean;
};

export default function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("tours")
      .select("id,title,city,is_published,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setTours([]);
    } else {
      setTours(data ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-2xl font-bold">Tours</h1>

        <div className="flex gap-2">
          <button
            onClick={load}
            className="border px-4 py-2 rounded-lg"
            type="button"
          >
            Refresh
          </button>

          {/* ✅ NEW: Categories link */}
          <Link
            href="/categories"
            className="border px-4 py-2 rounded-lg"
          >
            Categories
          </Link>

          <Link
            href="/tours/new"
            className="bg-black text-white px-4 py-2 rounded-lg"
          >
            + New Tour
          </Link>

          <button
            onClick={signOut}
            className="border px-4 py-2 rounded-lg"
            type="button"
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="border rounded-xl p-3 mb-4 text-red-600">{error}</div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : tours.length === 0 ? (
        <p>No tours yet.</p>
      ) : (
        <ul className="space-y-2">
          {tours.map((t) => (
            <li key={t.id} className="border rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Link href={`/tours/${t.id}`} className="font-semibold">
                    {t.title}
                  </Link>
                  {t.city ? <div className="text-sm">{t.city}</div> : null}
                </div>

                <span className="text-xs px-2 py-1 border rounded-full">
                  {t.is_published ? "Published" : "Draft"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ✅ Important note for your repo */}
      <div className="mt-6 text-xs text-gray-500">
        If /categories still 404s, make sure the file is at{" "}
        <span className="font-mono">src/app/categories/page.tsx</span> (not{" "}
        <span className="font-mono">src/app/app/categories/page.tsx</span>).
      </div>
    </div>
  );
}
