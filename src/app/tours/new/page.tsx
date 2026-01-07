"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function NewTourPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTour = async () => {
    setError(null);

    const cleanTitle = title.trim();
    const cleanCity = city.trim();

    if (!cleanTitle) {
      setError("Title is required.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("tours")
      .insert({
        title: cleanTitle,
        city: cleanCity ? cleanCity : null,
        is_published: isPublished,
      })
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push(`/tours/${data.id}`);
  };

  return (
    <div className="p-6 max-w-md mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">New Tour</h1>
        <button
          type="button"
          className="border px-3 py-1 rounded-lg"
          onClick={() => router.push("/tours")}
        >
          Back
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <input
          className="border rounded-lg p-2 w-full"
          placeholder="Lobster Tour"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">City</label>
        <input
          className="border rounded-lg p-2 w-full"
          placeholder="Portland"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        Published
      </label>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="button"
        onClick={createTour}
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded-lg w-full disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create Tour"}
      </button>
    </div>
  );
}
