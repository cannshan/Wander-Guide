"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { uploadAudio } from "@/lib/uploadAudio";
import { uploadStopImage } from "@/lib/uploadStopImage";
import { deleteStopImage } from "@/lib/deleteStopImage";
import { deleteStopAudio } from "@/lib/deleteStopAudio";

type Tour = {
  id: string;
  title: string;
  city: string | null;
  is_published: boolean;
  intro_audio_url: string | null;
};

type Stop = {
  id: string;
  tour_id: string;
  title: string;
  lat: number;
  lng: number;
  radius_m: number;
  pass_by: boolean; // ✅ NEW
  audio_url: string | null;
  image_url: string | null;
  sort_order: number;
};

const blankStop = {
  title: "",
  lat: "",
  lng: "",
  radius_m: 75,
  pass_by: false, // ✅ NEW
  audio_url: "",
  image_url: "",
};

export default function TourDetailPage() {
  const params = useParams<{ id: string }>();
  const tourId = useMemo(() => params?.id as string, [params]);
  const router = useRouter();

  const [tour, setTour] = useState<Tour | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  // Tour form state
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  // Stop form state
  const [newStop, setNewStop] = useState({ ...blankStop });

  const [error, setError] = useState<string | null>(null);
  const [savingTour, setSavingTour] = useState(false);
  const [savingStop, setSavingStop] = useState(false);

  // Upload state
  const [uploadingIntro, setUploadingIntro] = useState(false);
  const [uploadingStopId, setUploadingStopId] = useState<string | null>(null);
  const [uploadingNewStop, setUploadingNewStop] = useState(false);

  // Image upload state
  const [uploadingStopImageId, setUploadingStopImageId] = useState<string | null>(
    null
  );
  const [uploadingNewStopImage, setUploadingNewStopImage] = useState(false);

  // Delete states
  const [deletingStopImageId, setDeletingStopImageId] = useState<string | null>(
    null
  );
  const [deletingStopAudioId, setDeletingStopAudioId] = useState<string | null>(
    null
  );

  // Hidden file inputs
  const introFileRef = useRef<HTMLInputElement | null>(null);
  const newStopFileRef = useRef<HTMLInputElement | null>(null);
  const stopFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Image file inputs
  const newStopImageRef = useRef<HTMLInputElement | null>(null);
  const stopImageRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: tourData, error: tourErr } = await supabase
      .from("tours")
      .select("id,title,city,is_published,intro_audio_url")
      .eq("id", tourId)
      .single();

    if (tourErr) {
      setError(tourErr.message);
      setLoading(false);
      return;
    }

    setTour(tourData);
    setTitle(tourData.title ?? "");
    setCity(tourData.city ?? "");
    setIsPublished(!!tourData.is_published);

    const { data: stopsData, error: stopsErr } = await supabase
      .from("stops")
      .select(
        "id,tour_id,title,lat,lng,radius_m,pass_by,audio_url,image_url,sort_order"
      ) // ✅ include pass_by
      .eq("tour_id", tourId)
      .order("sort_order", { ascending: true });

    if (stopsErr) {
      setError(stopsErr.message);
      setStops([]);
    } else {
      setStops((stopsData ?? []).map((s: any) => ({ ...s, pass_by: !!s.pass_by })));
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!tourId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId]);

  const saveTour = async () => {
    setSavingTour(true);
    setError(null);

    if (!title.trim()) {
      setError("Tour title is required.");
      setSavingTour(false);
      return;
    }

    const { error } = await supabase
      .from("tours")
      .update({
        title: title.trim(),
        city: city.trim() || null,
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tourId);

    setSavingTour(false);

    if (error) {
      setError(error.message);
      return;
    }

    await load();
  };

  const deleteTour = async () => {
    const ok = confirm(
      "Delete this tour? This will also delete all stops (cascade)."
    );
    if (!ok) return;

    setError(null);
    const { error } = await supabase.from("tours").delete().eq("id", tourId);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/tours");
  };

  const addStop = async () => {
    setSavingStop(true);
    setError(null);

    if (!newStop.title.trim()) {
      setError("Stop title is required.");
      setSavingStop(false);
      return;
    }

    const lat = Number(newStop.lat);
    const lng = Number(newStop.lng);
    const radius = Number(newStop.radius_m);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Lat/Lng must be valid numbers.");
      setSavingStop(false);
      return;
    }

    const nextSort =
      stops.length === 0 ? 0 : Math.max(...stops.map((s) => s.sort_order)) + 1;

    const { error } = await supabase.from("stops").insert({
      tour_id: tourId,
      title: newStop.title.trim(),
      lat,
      lng,
      radius_m: Number.isFinite(radius) ? radius : 75,
      pass_by: !!newStop.pass_by, // ✅ NEW
      audio_url: newStop.audio_url?.trim() || null,
      image_url: newStop.image_url?.trim() || null,
      sort_order: nextSort,
      updated_at: new Date().toISOString(),
    });

    setSavingStop(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNewStop({ ...blankStop });
    await load();
  };

  const updateStopField = async (
    stopId: string,
    patch: Partial<Pick<Stop, "title" | "lat" | "lng" | "radius_m" | "pass_by">>
  ) => {
    setError(null);

    const payload: any = { ...patch, updated_at: new Date().toISOString() };
    if (payload.lat !== undefined) payload.lat = Number(payload.lat);
    if (payload.lng !== undefined) payload.lng = Number(payload.lng);
    if (payload.radius_m !== undefined) payload.radius_m = Number(payload.radius_m);
    if (payload.pass_by !== undefined) payload.pass_by = !!payload.pass_by;

    const { error } = await supabase.from("stops").update(payload).eq("id", stopId);

    if (error) {
      setError(error.message);
      return;
    }

    await load();
  };

  /* ============================
     Audio Upload Handlers
  ============================ */

  const uploadIntro = async (file: File) => {
    if (!tour) return;
    setError(null);
    setUploadingIntro(true);

    try {
      const url = await uploadAudio(
        file,
        `tours/${tour.id}/intro/${crypto.randomUUID()}`
      );

      const { error } = await supabase
        .from("tours")
        .update({ intro_audio_url: url, updated_at: new Date().toISOString() })
        .eq("id", tour.id);

      if (error) throw error;

      setTour((t) => (t ? { ...t, intro_audio_url: url } : t));
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload intro audio.");
    } finally {
      setUploadingIntro(false);
    }
  };

  const uploadStopAudio = async (stopId: string, file: File) => {
    setError(null);
    setUploadingStopId(stopId);

    try {
      const url = await uploadAudio(
        file,
        `stops/${stopId}/audio/${crypto.randomUUID()}`
      );

      const { error } = await supabase
        .from("stops")
        .update({ audio_url: url, updated_at: new Date().toISOString() })
        .eq("id", stopId);

      if (error) throw error;

      setStops((prev) =>
        prev.map((s) => (s.id === stopId ? { ...s, audio_url: url } : s))
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload stop audio.");
    } finally {
      setUploadingStopId(null);
    }
  };

  const uploadNewStopAudio = async (file: File) => {
    setError(null);
    setUploadingNewStop(true);

    try {
      const url = await uploadAudio(
        file,
        `tours/${tourId}/new-stop/audio/${crypto.randomUUID()}`
      );
      setNewStop((s) => ({ ...s, audio_url: url }));
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload new stop audio.");
    } finally {
      setUploadingNewStop(false);
    }
  };

  /* ============================
     ✅ Audio Delete Handler
  ============================ */

  const handleDeleteStopAudio = async (stopId: string, audioUrl: string) => {
    const ok = confirm("Delete this stop audio?");
    if (!ok) return;

    setError(null);
    setDeletingStopAudioId(stopId);

    try {
      await deleteStopAudio(stopId, audioUrl);

      // Clear DB url (important even if storage delete fails)
      const { error: updErr } = await supabase
        .from("stops")
        .update({ audio_url: null, updated_at: new Date().toISOString() })
        .eq("id", stopId);

      if (updErr) throw updErr;

      setStops((prev) =>
        prev.map((s) => (s.id === stopId ? { ...s, audio_url: null } : s))
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete stop audio.");
    } finally {
      setDeletingStopAudioId(null);
    }
  };

  /* ============================
     ✅ Image Upload + Delete
  ============================ */

  const uploadStopImageForExistingStop = async (stopId: string, file: File) => {
    setError(null);
    setUploadingStopImageId(stopId);

    try {
      const imageUrl = await uploadStopImage(file, stopId);

      const { error } = await supabase
        .from("stops")
        .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
        .eq("id", stopId);

      if (error) throw error;

      setStops((prev) =>
        prev.map((s) => (s.id === stopId ? { ...s, image_url: imageUrl } : s))
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload stop image.");
    } finally {
      setUploadingStopImageId(null);
    }
  };

  const uploadNewStopImage = async (file: File) => {
    setError(null);
    setUploadingNewStopImage(true);

    try {
      const tempStopId = `new-stop-${crypto.randomUUID()}`;
      const imageUrl = await uploadStopImage(file, tempStopId);
      setNewStop((s) => ({ ...s, image_url: imageUrl }));
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload new stop image.");
    } finally {
      setUploadingNewStopImage(false);
    }
  };

  const handleDeleteStopImage = async (stopId: string, imageUrl: string) => {
    const ok = confirm("Delete this stop image?");
    if (!ok) return;

    setError(null);
    setDeletingStopImageId(stopId);

    try {
      await deleteStopImage(stopId, imageUrl);

      // Clear DB url (important even if storage delete fails)
      const { error: updErr } = await supabase
        .from("stops")
        .update({ image_url: null, updated_at: new Date().toISOString() })
        .eq("id", stopId);

      if (updErr) throw updErr;

      setStops((prev) =>
        prev.map((s) => (s.id === stopId ? { ...s, image_url: null } : s))
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete stop image.");
    } finally {
      setDeletingStopImageId(null);
    }
  };

  const deleteStop = async (stopId: string) => {
    const ok = confirm("Delete this stop?");
    if (!ok) return;

    setError(null);
    const { error } = await supabase.from("stops").delete().eq("id", stopId);

    if (error) {
      setError(error.message);
      return;
    }

    await load();
  };

  const moveStop = async (stopId: string, direction: "up" | "down") => {
    const idx = stops.findIndex((s) => s.id === stopId);
    if (idx === -1) return;

    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= stops.length) return;

    const a = stops[idx];
    const b = stops[swapWith];

    setError(null);
    const { error: errA } = await supabase
      .from("stops")
      .update({ sort_order: b.sort_order, updated_at: new Date().toISOString() })
      .eq("id", a.id);

    const { error: errB } = await supabase
      .from("stops")
      .update({ sort_order: a.sort_order, updated_at: new Date().toISOString() })
      .eq("id", b.id);

    if (errA || errB) {
      setError((errA || errB)?.message ?? "Failed to reorder stops.");
      return;
    }

    await load();
  };

  if (loading) return <div className="p-6">Loading…</div>;

  if (!tour) {
    return (
      <div className="p-6">
        <p className="text-red-600">Tour not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Edit Tour</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/tours")}
            className="border px-4 py-2 rounded-lg"
          >
            Back
          </button>
          <button
            onClick={deleteTour}
            className="border px-4 py-2 rounded-lg text-red-600"
          >
            Delete Tour
          </button>
        </div>
      </div>

      {error && <div className="border rounded-xl p-3 text-red-600">{error}</div>}

      {/* Tour fields */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              className="border rounded-lg p-2 w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">City</label>
            <input
              className="border rounded-lg p-2 w-full"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          Published (visible to public app)
        </label>

        {/* Intro Audio */}
        <div className="border rounded-lg p-3 space-y-2">
          <div className="text-sm font-medium">Intro Audio</div>

          <input
            ref={introFileRef}
            type="file"
            className="hidden"
            accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadIntro(file);
              e.currentTarget.value = "";
            }}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="border px-4 py-2 rounded-lg"
              disabled={uploadingIntro}
              onClick={() => introFileRef.current?.click()}
            >
              {uploadingIntro ? "Uploading…" : "Upload file"}
            </button>

            {tour.intro_audio_url ? (
              <a
                className="text-sm underline"
                href={tour.intro_audio_url}
                target="_blank"
                rel="noreferrer"
              >
                Preview
              </a>
            ) : (
              <span className="text-sm text-gray-500">No file uploaded</span>
            )}
          </div>
        </div>

        <button
          onClick={saveTour}
          disabled={savingTour}
          className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {savingTour ? "Saving…" : "Save Tour"}
        </button>
      </div>

      {/* Add stop */}
      <div className="border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Add Stop</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500">Stop title</label>
            <input
              className="border rounded-lg p-2 w-full"
              placeholder="e.g., Bar Harbor Lobster Pound"
              value={newStop.title}
              onChange={(e) => setNewStop((s) => ({ ...s, title: e.target.value }))}
            />
          </div>

          {/* ✅ Pass By */}
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={!!newStop.pass_by}
              onChange={(e) =>
                setNewStop((s) => ({ ...s, pass_by: e.target.checked }))
              }
            />
            Pass By (show in list, but mark as “Pass By”)
          </label>

          {/* Stop audio */}
          <div className="border rounded-lg p-3 space-y-2 md:col-span-2">
            <div className="text-sm font-medium">Stop Audio</div>

            <input
              ref={newStopFileRef}
              type="file"
              className="hidden"
              accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadNewStopAudio(file);
                e.currentTarget.value = "";
              }}
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="border px-4 py-2 rounded-lg"
                disabled={uploadingNewStop}
                onClick={() => newStopFileRef.current?.click()}
              >
                {uploadingNewStop ? "Uploading…" : "Upload file"}
              </button>

              {newStop.audio_url ? (
                <span className="text-sm text-gray-700">Uploaded ✓</span>
              ) : (
                <span className="text-sm text-gray-500">No file uploaded</span>
              )}
            </div>
          </div>

          {/* Stop image */}
          <div className="border rounded-lg p-3 space-y-2 md:col-span-2">
            <div className="text-sm font-medium">Stop Image</div>

            <input
              ref={newStopImageRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadNewStopImage(file);
                e.currentTarget.value = "";
              }}
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="border px-4 py-2 rounded-lg"
                disabled={uploadingNewStopImage}
                onClick={() => newStopImageRef.current?.click()}
              >
                {uploadingNewStopImage ? "Uploading…" : "Upload image"}
              </button>

              {newStop.image_url ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">Uploaded ✓</span>
                  <img
                    src={newStop.image_url}
                    alt="New stop"
                    className="h-12 w-12 rounded-lg object-cover border"
                  />

                  <button
                    type="button"
                    className="border px-2 py-1 rounded-lg text-red-600 text-xs"
                    onClick={() => setNewStop((s) => ({ ...s, image_url: "" }))}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <span className="text-sm text-gray-500">No image uploaded</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-700">Latitude</div>
            <input
              className="border rounded-lg p-2 w-full"
              placeholder="44.3876"
              value={String(newStop.lat)}
              onChange={(e) => setNewStop((s) => ({ ...s, lat: e.target.value }))}
            />
          </div>

          <div>
            <div className="text-xs font-medium text-gray-700">Longitude</div>
            <input
              className="border rounded-lg p-2 w-full"
              placeholder="-68.2043"
              value={String(newStop.lng)}
              onChange={(e) => setNewStop((s) => ({ ...s, lng: e.target.value }))}
            />
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-medium text-gray-700">
              Trigger radius (meters)
            </div>
            <input
              className="border rounded-lg p-2 w-full"
              placeholder="75"
              value={String(newStop.radius_m)}
              onChange={(e) =>
                setNewStop((s) => ({ ...s, radius_m: Number(e.target.value) }))
              }
            />
          </div>
        </div>

        <button
          onClick={addStop}
          disabled={savingStop}
          className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {savingStop ? "Adding…" : "Add Stop"}
        </button>
      </div>

      {/* Stops list */}
      <div className="border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Stops</h2>

        {stops.length === 0 ? (
          <p>No stops yet.</p>
        ) : (
          <div className="space-y-3">
            {stops.map((s, i) => (
              <div key={s.id} className="border rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">
                    {i + 1}.{" "}
                    <input
                      className="border rounded-lg p-1 ml-2"
                      defaultValue={s.title}
                      onBlur={(e) => updateStopField(s.id, { title: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="border px-2 py-1 rounded-lg"
                      onClick={() => moveStop(s.id, "up")}
                      disabled={i === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="border px-2 py-1 rounded-lg"
                      onClick={() => moveStop(s.id, "down")}
                      disabled={i === stops.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      className="border px-2 py-1 rounded-lg text-red-600"
                      onClick={() => deleteStop(s.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* ✅ Pass By toggle (existing stop) */}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    defaultChecked={!!s.pass_by}
                    onChange={(e) =>
                      updateStopField(s.id, { pass_by: e.target.checked })
                    }
                  />
                  Pass By
                </label>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
                  <div>
                    <div className="text-xs font-medium text-gray-700">Latitude</div>
                    <input
                      className="border rounded-lg p-1 w-full"
                      defaultValue={String(s.lat)}
                      onBlur={(e) =>
                        updateStopField(s.id, { lat: Number(e.target.value) })
                      }
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-700">Longitude</div>
                    <input
                      className="border rounded-lg p-1 w-full"
                      defaultValue={String(s.lng)}
                      onBlur={(e) =>
                        updateStopField(s.id, { lng: Number(e.target.value) })
                      }
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-700">
                      Radius (meters)
                    </div>
                    <input
                      className="border rounded-lg p-1 w-full"
                      defaultValue={String(s.radius_m)}
                      onBlur={(e) =>
                        updateStopField(s.id, { radius_m: Number(e.target.value) })
                      }
                    />
                  </div>

                  {/* Audio */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="text-xs font-medium text-gray-700">Audio</div>

                    <input
                      ref={(el) => {
                        stopFileRefs.current[s.id] = el;
                      }}
                      type="file"
                      className="hidden"
                      accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadStopAudio(s.id, file);
                        e.currentTarget.value = "";
                      }}
                    />

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="border px-4 py-2 rounded-lg"
                        disabled={uploadingStopId === s.id}
                        onClick={() => stopFileRefs.current[s.id]?.click()}
                      >
                        {uploadingStopId === s.id ? "Uploading…" : "Upload file"}
                      </button>

                      {s.audio_url ? (
                        <div className="flex items-center gap-3">
                          <a
                            className="text-sm underline"
                            href={s.audio_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Preview
                          </a>

                          <button
                            type="button"
                            className="border px-2 py-1 rounded-lg text-red-600 text-xs"
                            disabled={deletingStopAudioId === s.id}
                            onClick={() => handleDeleteStopAudio(s.id, s.audio_url!)}
                          >
                            {deletingStopAudioId === s.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No file uploaded</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Image */}
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="text-sm font-medium">Stop Image</div>

                  <input
                    ref={(el) => {
                      stopImageRefs.current[s.id] = el;
                    }}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadStopImageForExistingStop(s.id, file);
                      e.currentTarget.value = "";
                    }}
                  />

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="border px-4 py-2 rounded-lg"
                      disabled={uploadingStopImageId === s.id}
                      onClick={() => stopImageRefs.current[s.id]?.click()}
                    >
                      {uploadingStopImageId === s.id ? "Uploading…" : "Upload image"}
                    </button>

                    {s.image_url ? (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-700">Uploaded ✓</span>
                        <img
                          src={s.image_url}
                          alt={s.title}
                          className="h-12 w-12 rounded-lg object-cover border"
                        />
                        <a
                          className="text-sm underline"
                          href={s.image_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Preview
                        </a>

                        <button
                          type="button"
                          className="border px-2 py-1 rounded-lg text-red-600 text-xs"
                          disabled={deletingStopImageId === s.id}
                          onClick={() => handleDeleteStopImage(s.id, s.image_url!)}
                        >
                          {deletingStopImageId === s.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">No image uploaded</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        Tip: deletions remove the Storage file (best effort) and clear the database URL.
      </div>
    </div>
  );
}
