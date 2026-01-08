"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Category = {
  id: string;
  name: string;
  created_at: string;
};

export default function CategoriesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...categories].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [categories]);

  async function load() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("categories")
      .select("id,name,created_at")
      .order("name", { ascending: true });

    if (error) setError(error.message);
    setCategories(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createCategory() {
    const name = newName.trim();
    if (!name) return;

    setSaving(true);
    setError(null);

    const { error } = await supabase.from("categories").insert({ name });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNewName("");
    await load();
  }

  async function deleteCategory(id: string) {
    setDeletingId(id);
    setError(null);

    // Friendly pre-check: how many tours use this category?
    const { count, error: countErr } = await supabase
      .from("tours")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if (countErr) {
      setError(countErr.message);
      setDeletingId(null);
      return;
    }

    if ((count ?? 0) > 0) {
      setError(
        `This category has ${count} tour(s). Move those tours to another category before deleting.`
      );
      setDeletingId(null);
      return;
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);

    setDeletingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    await load();
  }

  // ✅ Safer "Back to Tours" to avoid getting stuck on a 404
  async function goBackToTours() {
    try {
      // If /tours exists in the deployed build, this will be 200/307/etc.
      const res = await fetch("/tours", { method: "GET" });
      if (res.ok || res.status === 307 || res.status === 308) {
        router.push("/tours");
        return;
      }
    } catch {
      // ignore
    }
    // fallback: go home (your / probably redirects to login or dashboard)
    router.push("/");
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Categories</h1>
          <div className="text-sm text-gray-600">
            Categories are the top-level grouping users browse before tours.
          </div>
        </div>

        {/* ✅ Use a button so we can failover if /tours isn't present */}
        <button
          type="button"
          onClick={goBackToTours}
          className="border px-4 py-2 rounded-lg hover:bg-gray-50"
        >
          ← Back to Tours
        </button>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      ) : null}

      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-medium">Create a category</div>
        <div className="flex gap-2">
          <input
            className="border rounded-lg p-2 w-full"
            placeholder="e.g., Maine, Boston, Food Tours"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createCategory();
            }}
          />
          <button
            onClick={createCategory}
            disabled={saving || !newName.trim()}
            className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create"}
          </button>
        </div>
      </div>

      <div className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Existing categories</div>
          <button
            onClick={load}
            className="border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50"
            type="button"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-gray-600">No categories yet.</div>
        ) : (
          <ul className="divide-y">
            {sorted.map((c) => (
              <li key={c.id} className="py-3 flex items-center justify-between">
                <div className="font-medium">{c.name}</div>
                <button
                  onClick={() => deleteCategory(c.id)}
                  disabled={deletingId === c.id}
                  className="border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                  type="button"
                >
                  {deletingId === c.id ? "Deleting..." : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

     
      
    </div>
  );
}
