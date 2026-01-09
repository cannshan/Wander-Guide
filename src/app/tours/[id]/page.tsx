"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { uploadAudio } from "@/lib/uploadAudio";
import { uploadStopImage } from "@/lib/uploadStopImage";
import { deleteStopImage } from "@/lib/deleteStopImage";
import { deleteStopAudio } from "@/lib/deleteStopAudio";

// ✅ Tour cover image helpers
import { uploadTourImage } from "@/lib/uploadTourImage";
import { deleteTourImage } from "@/lib/deleteTourImage";

// ✅ per-button image helpers
import {
  uploadTourButtonImage,
  type TourButtonImageKey,
} from "@/lib/uploadTourButtonImage";
import { deleteTourButtonImage } from "@/lib/deleteTourButtonImage";

// ✅ intro audio delete helper
import { deleteTourIntroAudio } from "@/lib/deleteTourIntroAudio";

type Category = {
  id: string;
  name: string;
};

type Tour = {
  id: string;
  title: string;
  city: string | null;
  is_published: boolean;
  intro_audio_url: string | null;

  // ✅ Tour cover image
  cover_image_url: string | null;

  // ✅ per-button images
  highlights_image_url: string | null;
  map_image_url: string | null;
  start_image_url: string | null;

  // ✅ per-button colors (hex)
  start_touring_color_hex: string | null;
  highlights_button_color_hex: string | null;
  map_button_color_hex: string | null;
  where_starts_button_color_hex: string | null;

  // ✅ Category support
  category_id: string | null;
  categories?: { name: string } | null;
};

// ✅ Stronger typing for Supabase tour row
type TourRow = {
  id: string;
  title: string | null;
  city: string | null;
  is_published: boolean | null;
  intro_audio_url: string | null;

  cover_image_url: string | null;
  highlights_image_url: string | null;
  map_image_url: string | null;
  start_image_url: string | null;

  start_touring_color_hex: string | null;
  highlights_button_color_hex: string | null;
  map_button_color_hex: string | null;
  where_starts_button_color_hex: string | null;

  category_id: string | null;

  // Depending on your relationship, Supabase can return object or array.
  // If it's one-to-one / many-to-one, it's usually an object (or null).
  categories: { name: string } | null;
};

type Stop = {
  id: string;
  tour_id: string;
  title: string;

  // ✅ allow paste-anything behavior in UI (no Number() coercion in inputs)
  lat: string | number;
  lng: string | number;

  radius_m: number;
  pass_by: boolean;
  audio_url: string | null;
  image_url: string | null;
  sort_order: number;
};

const blankStop: {
  title: string;
  lat: string;
  lng: string;
  radius_m: number;
  pass_by: boolean;
  audio_url: string;
  image_url: string;
} = {
  title: "",
  lat: "",
  lng: "",
  radius_m: 75,
  pass_by: false,
  audio_url: "",
  image_url: "",
};

/* ============================
   ✅ Color helpers (wheel + hex)
============================ */

function isHex6(v: string) {
  return /^#?[0-9a-fA-F]{6}$/.test(v.trim());
}

function normalizeHex6(v: string): string | "" {
  const t = v.trim();
  if (!t) return "";
  if (!isHex6(t)) return "";
  return t.startsWith("#") ? t.toUpperCase() : `#${t.toUpperCase()}`;
}

/** input[type="color"] must receive a valid #RRGGBB, so we guarantee fallback */
function safeColorForPicker(v: string | null | undefined, fallback: string) {
  const n = normalizeHex6(v ?? "");
  return n || fallback;
}

export default function TourDetailPage() {
  const params = useParams<{ id: string }>();
  const tourId = useMemo(() => (params?.id as string) ?? "", [params]);
  const router = useRouter();

  const [tour, setTour] = useState<Tour | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  // Tour form state
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  // ✅ color fields state
  const [startTouringColorHex, setStartTouringColorHex] = useState<string>("");
  const [highlightsColorHex, setHighlightsColorHex] = useState<string>("");
  const [mapColorHex, setMapColorHex] = useState<string>("");
  const [whereStartsColorHex, setWhereStartsColorHex] = useState<string>("");

  // Category form state
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  // Stop form state
  const [newStop, setNewStop] = useState({ ...blankStop });

  const [error, setError] = useState<string | null>(null);
  const [savingTour, setSavingTour] = useState(false);
  const [savingStop, setSavingStop] = useState(false);

  // Upload state
  const [uploadingIntro, setUploadingIntro] = useState(false);
  const [uploadingStopId, setUploadingStopId] = useState<string | null>(null);
  const [uploadingNewStop, setUploadingNewStop] = useState(false);

  // Tour cover upload/delete state
  const [uploadingCover, setUploadingCover] = useState(false);
  const [deletingCover, setDeletingCover] = useState(false);

  // per-button image upload/delete state
  const [uploadingButtonKey, setUploadingButtonKey] =
    useState<TourButtonImageKey | null>(null);
  const [deletingButtonKey, setDeletingButtonKey] =
    useState<TourButtonImageKey | null>(null);

  // Stop image upload state
  const [uploadingStopImageId, setUploadingStopImageId] = useState<
    string | null
  >(null);
  const [uploadingNewStopImage, setUploadingNewStopImage] = useState(false);

  // Delete states
  const [deletingStopImageId, setDeletingStopImageId] = useState<
    string | null
  >(null);
  const [deletingStopAudioId, setDeletingStopAudioId] = useState<
    string | null
  >(null);

  // intro audio delete state
  const [deletingIntro, setDeletingIntro] = useState(false);

  // Stop dirty tracking + per-stop save state
  const [dirtyStops, setDirtyStops] = useState<Set<string>>(new Set());
  const [savingStopIds, setSavingStopIds] = useState<Set<string>>(new Set());

  function markStopDirty(stopId: string) {
    setDirtyStops((prev) => {
      const next = new Set(prev);
      next.add(stopId);
      return next;
    });
  }

  function setStopSaving(stopId: string, saving: boolean) {
    setSavingStopIds((prev) => {
      const next = new Set(prev);
      if (saving) next.add(stopId);
      else next.delete(stopId);
      return next;
    });
  }

  // Hidden file inputs
  const introFileRef = useRef<HTMLInputElement | null>(null);
  const newStopFileRef = useRef<HTMLInputElement | null>(null);
  const stopFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Tour cover file input
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  // per-button file inputs
  const highlightsFileRef = useRef<HTMLInputElement | null>(null);
  const mapFileRef = useRef<HTMLInputElement | null>(null);
  const startFileRef = useRef<HTMLInputElement | null>(null);

  // Image file inputs
  const newStopImageRef = useRef<HTMLInputElement | null>(null);
  const stopImageRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    setError(null);

    // Load categories for dropdown
    setLoadingCats(true);
    const { data: cats, error: catsErr } = await supabase
      .from("categories")
      .select("id,name")
      .order("name", { ascending: true });

    if (catsErr) {
      setError(catsErr.message);
      setCategories([]);
    } else {
      setCategories((cats as Category[]) ?? []);
    }
    setLoadingCats(false);

    const { data: rawTour, error: tourErr } = await supabase
      .from("tours")
      .select(
        [
          "id",
          "title",
          "city",
          "is_published",
          "intro_audio_url",
          "cover_image_url",
          "highlights_image_url",
          "map_image_url",
          "start_image_url",
          // ✅ color fields
          "start_touring_color_hex",
          "highlights_button_color_hex",
          "map_button_color_hex",
          "where_starts_button_color_hex",
          "category_id",
          "categories(name)",
        ].join(",")
      )
      .eq("id", tourId)
      .single();

    if (tourErr) {
      setError(tourErr.message);
      setLoading(false);
      return;
    }

    const tourData = rawTour as unknown as TourRow;

    setTour({
      id: tourData.id,
      title: tourData.title ?? "",
      city: tourData.city ?? null,
      is_published: !!tourData.is_published,
      intro_audio_url: tourData.intro_audio_url ?? null,

      cover_image_url: tourData.cover_image_url ?? null,

      highlights_image_url: tourData.highlights_image_url ?? null,
      map_image_url: tourData.map_image_url ?? null,
      start_image_url: tourData.start_image_url ?? null,

      start_touring_color_hex: tourData.start_touring_color_hex ?? null,
      highlights_button_color_hex: tourData.highlights_button_color_hex ?? null,
      map_button_color_hex: tourData.map_button_color_hex ?? null,
      where_starts_button_color_hex: tourData.where_starts_button_color_hex ?? null,

      category_id: tourData.category_id ?? null,
      categories: tourData.categories ?? null,
    });

    setTitle(tourData.title ?? "");
    setCity(tourData.city ?? "");
    setIsPublished(!!tourData.is_published);
    setCategoryId(tourData.category_id ?? "");

    // ✅ load color values into inputs
    setStartTouringColorHex(tourData.start_touring_color_hex ?? "");
    setHighlightsColorHex(tourData.highlights_button_color_hex ?? "");
    setMapColorHex(tourData.map_button_color_hex ?? "");
    setWhereStartsColorHex(tourData.where_starts_button_color_hex ?? "");

    const { data: stopsData, error: stopsErr } = await supabase
      .from("stops")
      .select(
        "id,tour_id,title,lat,lng,radius_m,pass_by,audio_url,image_url,sort_order"
      )
      .eq("tour_id", tourId)
      .order("sort_order", { ascending: true });

    if (stopsErr) {
      setError(stopsErr.message);
      setStops([]);
    } else {
      setStops(
        (stopsData ?? []).map((s: any) => ({
          ...s,
          pass_by: !!s.pass_by,
          // ✅ keep whatever comes back, but UI always treats as pasteable strings
          lat: s.lat ?? "",
          lng: s.lng ?? "",
        }))
      );
    }

    // Clear dirty state after a fresh load
    setDirtyStops(new Set());
    setSavingStopIds(new Set());

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

    // normalize hex strings (empty => null)
    const startTouringHex = normalizeHex6(startTouringColorHex) || null;
    const highlightsHex = normalizeHex6(highlightsColorHex) || null;
    const mapHex = normalizeHex6(mapColorHex) || null;
    const whereStartsHex = normalizeHex6(whereStartsColorHex) || null;

    const { error } = await supabase
      .from("tours")
      .update({
        title: title.trim(),
        city: city.trim() || null,
        is_published: isPublished,
        category_id: categoryId ? categoryId : null,

        // ✅ save colors
        start_touring_color_hex: startTouringHex,
        highlights_button_color_hex: highlightsHex,
        map_button_color_hex: mapHex,
        where_starts_button_color_hex: whereStartsHex,

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

    // ✅ allow paste-anything; no Number() coercion / no finite checks
    const lat = newStop.lat;
    const lng = newStop.lng;
    const radius = Number(newStop.radius_m);

    const nextSort =
      stops.length === 0 ? 0 : Math.max(...stops.map((s) => s.sort_order)) + 1;

    const { error } = await supabase.from("stops").insert({
      tour_id: tourId,
      title: newStop.title.trim(),
      lat,
      lng,
      radius_m: Number.isFinite(radius) ? radius : 75,
      pass_by: !!newStop.pass_by,
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

  /* ============================
     Stop Edit (LOCAL ONLY) + Save button per stop
  ============================ */

  const updateStopLocal = (
    stopId: string,
    patch: Partial<Pick<Stop, "title" | "lat" | "lng" | "radius_m" | "pass_by">>
  ) => {
    setStops((prev) =>
      prev.map((s) => (s.id === stopId ? { ...s, ...patch } : s))
    );
    markStopDirty(stopId);
  };

  const saveStop = async (stopId: string) => {
    const stop = stops.find((s) => s.id === stopId);
    if (!stop) return;

    setError(null);
    setStopSaving(stopId, true);

    try {
      // ✅ allow paste-anything; no finite checks on lat/lng
      const payload: any = {
        title: stop.title?.trim(),
        lat: stop.lat,
        lng: stop.lng,
        radius_m: Number(stop.radius_m),
        pass_by: !!stop.pass_by,
        updated_at: new Date().toISOString(),
      };

      if (!payload.title) throw new Error("Stop title is required.");
      if (!Number.isFinite(payload.radius_m)) payload.radius_m = 75;

      const { error } = await supabase.from("stops").update(payload).eq("id", stopId);
      if (error) throw error;

      // Mark as clean
      setDirtyStops((prev) => {
        const next = new Set(prev);
        next.delete(stopId);
        return next;
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to save stop.");
    } finally {
      setStopSaving(stopId, false);
    }
  };

  /* ============================
     Tour Cover Image Upload + Delete
  ============================ */

  const uploadCoverImage = async (file: File) => {
    if (!tour) return;
    setError(null);
    setUploadingCover(true);

    try {
      const url = await uploadTourImage(tour.id, file);
      setTour((t) => (t ? { ...t, cover_image_url: url } : t));
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload tour cover image.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleDeleteCoverImage = async () => {
    if (!tour?.cover_image_url) return;

    const ok = confirm("Delete this tour cover image?");
    if (!ok) return;

    setError(null);
    setDeletingCover(true);

    try {
      await deleteTourImage(tour.id, tour.cover_image_url);
      setTour((t) => (t ? { ...t, cover_image_url: null } : t));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete tour cover image.");
    } finally {
      setDeletingCover(false);
    }
  };

  /* ============================
     Tour Button Images (Highlights / Map / Start) Upload + Delete
  ============================ */

  const uploadButtonImage = async (key: TourButtonImageKey, file: File) => {
    if (!tour) return;
    setError(null);
    setUploadingButtonKey(key);

    try {
      const url = await uploadTourButtonImage(tour.id, file, key);
      setTour((t) => (t ? ({ ...t, [key]: url } as any) : t));
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload button image.");
    } finally {
      setUploadingButtonKey(null);
    }
  };

  const handleDeleteButtonImage = async (key: TourButtonImageKey) => {
    if (!tour) return;
    const currentUrl = (tour as any)[key] as string | null;
    if (!currentUrl) return;

    const ok = confirm("Delete this button image?");
    if (!ok) return;

    setError(null);
    setDeletingButtonKey(key);

    try {
      await deleteTourButtonImage(tour.id, currentUrl, key);
      setTour((t) => (t ? ({ ...t, [key]: null } as any) : t));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete button image.");
    } finally {
      setDeletingButtonKey(null);
    }
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
     Intro Audio Delete Handler
  ============================ */

  const handleDeleteIntroAudio = async () => {
    if (!tour?.intro_audio_url) return;

    const ok = confirm("Delete intro audio?");
    if (!ok) return;

    setError(null);
    setDeletingIntro(true);

    try {
      await deleteTourIntroAudio(tour.id, tour.intro_audio_url);
      setTour((t) => (t ? { ...t, intro_audio_url: null } : t));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete intro audio.");
    } finally {
      setDeletingIntro(false);
    }
  };

  /* ============================
     Audio Delete Handler
  ============================ */

  const handleDeleteStopAudio = async (stopId: string, audioUrl: string) => {
    const ok = confirm("Delete this stop audio?");
    if (!ok) return;

    setError(null);
    setDeletingStopAudioId(stopId);

    try {
      await deleteStopAudio(stopId, audioUrl);

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
     Stop Image Upload + Delete
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

  const buttonCards: Array<{
    label: string;
    key: TourButtonImageKey;
    url: string | null;
    ref: React.RefObject<HTMLInputElement | null>;
  }> = [
    {
      label: "Highlights button image",
      key: "highlights_image_url",
      url: tour.highlights_image_url,
      ref: highlightsFileRef,
    },
    {
      label: "Map button image",
      key: "map_image_url",
      url: tour.map_image_url,
      ref: mapFileRef,
    },
    {
      label: "Where tour starts button image",
      key: "start_image_url",
      url: tour.start_image_url,
      ref: startFileRef,
    },
  ];

  // picker fallbacks (so the wheel always renders)
  const FALLBACK_START_TOURING = "#111111";
  const FALLBACK_HIGHLIGHTS = "#111111";
  const FALLBACK_MAP = "#111111";
  const FALLBACK_WHERE_STARTS = "#111111";

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

      {error && (
        <div className="border rounded-xl p-3 text-red-600">{error}</div>
      )}

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

          {/* Category dropdown */}
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Category</label>
            <select
              className="border rounded-lg p-2 w-full"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={loadingCats}
            >
              <option value="">
                {loadingCats ? "Loading categories..." : "No category"}
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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

        {/* Button Colors (wheel + hex) */}
        <div className="border rounded-lg p-3 space-y-3">
          <div className="text-sm font-medium">
            Button Colors (Color wheel + Hex)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Start Touring */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">
                Start Touring button color
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border"
                  value={safeColorForPicker(
                    startTouringColorHex,
                    FALLBACK_START_TOURING
                  )}
                  onChange={(e) => setStartTouringColorHex(e.target.value)}
                  aria-label="Start Touring color picker"
                />
                <input
                  type="text"
                  className="border rounded-lg px-2 py-1 text-sm w-32 font-mono"
                  placeholder="#RRGGBB"
                  value={startTouringColorHex}
                  onChange={(e) => setStartTouringColorHex(e.target.value)}
                  onBlur={() =>
                    setStartTouringColorHex(normalizeHex6(startTouringColorHex))
                  }
                />
                <button
                  type="button"
                  className="border px-2 py-1 rounded-lg text-xs"
                  onClick={() => setStartTouringColorHex("")}
                >
                  Clear
                </button>
              </div>
              <div className="text-[11px] text-gray-500">
                Tip: paste your brand hex, e.g.{" "}
                <span className="font-mono">#FF785A</span>
              </div>
            </div>

            {/* Highlights */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">Highlights button color</div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border"
                  value={safeColorForPicker(
                    highlightsColorHex,
                    FALLBACK_HIGHLIGHTS
                  )}
                  onChange={(e) => setHighlightsColorHex(e.target.value)}
                  aria-label="Highlights color picker"
                />
                <input
                  type="text"
                  className="border rounded-lg px-2 py-1 text-sm w-32 font-mono"
                  placeholder="#RRGGBB"
                  value={highlightsColorHex}
                  onChange={(e) => setHighlightsColorHex(e.target.value)}
                  onBlur={() =>
                    setHighlightsColorHex(normalizeHex6(highlightsColorHex))
                  }
                />
                <button
                  type="button"
                  className="border px-2 py-1 rounded-lg text-xs"
                  onClick={() => setHighlightsColorHex("")}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Map */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">Map button color</div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border"
                  value={safeColorForPicker(mapColorHex, FALLBACK_MAP)}
                  onChange={(e) => setMapColorHex(e.target.value)}
                  aria-label="Map color picker"
                />
                <input
                  type="text"
                  className="border rounded-lg px-2 py-1 text-sm w-32 font-mono"
                  placeholder="#RRGGBB"
                  value={mapColorHex}
                  onChange={(e) => setMapColorHex(e.target.value)}
                  onBlur={() => setMapColorHex(normalizeHex6(mapColorHex))}
                />
                <button
                  type="button"
                  className="border px-2 py-1 rounded-lg text-xs"
                  onClick={() => setMapColorHex("")}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Where tour starts */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">
                Where the tour starts button color
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border"
                  value={safeColorForPicker(
                    whereStartsColorHex,
                    FALLBACK_WHERE_STARTS
                  )}
                  onChange={(e) => setWhereStartsColorHex(e.target.value)}
                  aria-label="Where starts color picker"
                />
                <input
                  type="text"
                  className="border rounded-lg px-2 py-1 text-sm w-32 font-mono"
                  placeholder="#RRGGBB"
                  value={whereStartsColorHex}
                  onChange={(e) => setWhereStartsColorHex(e.target.value)}
                  onBlur={() =>
                    setWhereStartsColorHex(normalizeHex6(whereStartsColorHex))
                  }
                />
                <button
                  type="button"
                  className="border px-2 py-1 rounded-lg text-xs"
                  onClick={() => setWhereStartsColorHex("")}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tour Cover Image */}
        <div className="border rounded-lg p-3 space-y-2">
          <div className="text-sm font-medium">Tour Cover Image</div>

          <input
            ref={coverFileRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadCoverImage(file);
              e.currentTarget.value = "";
            }}
          />

          {tour.cover_image_url ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-lg border bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tour.cover_image_url}
                  alt="Tour cover"
                  className="w-full h-48 object-cover"
                />
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  className="border px-4 py-2 rounded-lg"
                  disabled={uploadingCover}
                  onClick={() => coverFileRef.current?.click()}
                >
                  {uploadingCover ? "Uploading…" : "Replace image"}
                </button>

                <a
                  className="text-sm underline"
                  href={tour.cover_image_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview
                </a>

                <button
                  type="button"
                  className="border px-2 py-1 rounded-lg text-red-600 text-xs"
                  disabled={deletingCover}
                  onClick={handleDeleteCoverImage}
                >
                  {deletingCover ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="border px-4 py-2 rounded-lg"
                disabled={uploadingCover}
                onClick={() => coverFileRef.current?.click()}
              >
                {uploadingCover ? "Uploading…" : "Upload image"}
              </button>

              <span className="text-sm text-gray-500">No image uploaded</span>
            </div>
          )}
        </div>

        {/* Button Images */}
        <div className="border rounded-lg p-3 space-y-3">
          <div className="text-sm font-medium">
            Button Images (Highlights / Map / Where Tour Starts)
          </div>

          {buttonCards.map((b) => (
            <div key={b.key} className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">{b.label}</div>

              <input
                ref={b.ref}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadButtonImage(b.key, file);
                  e.currentTarget.value = "";
                }}
              />

              {b.url ? (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-lg border bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={b.url}
                      alt={b.label}
                      className="w-full h-40 object-cover"
                    />
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      className="border px-4 py-2 rounded-lg"
                      disabled={uploadingButtonKey === b.key}
                      onClick={() => b.ref.current?.click()}
                    >
                      {uploadingButtonKey === b.key
                        ? "Uploading…"
                        : "Replace image"}
                    </button>

                    <a
                      className="text-sm underline"
                      href={b.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Preview
                    </a>

                    <button
                      type="button"
                      className="border px-2 py-1 rounded-lg text-red-600 text-xs"
                      disabled={deletingButtonKey === b.key}
                      onClick={() => handleDeleteButtonImage(b.key)}
                    >
                      {deletingButtonKey === b.key ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="border px-4 py-2 rounded-lg"
                    disabled={uploadingButtonKey === b.key}
                    onClick={() => b.ref.current?.click()}
                  >
                    {uploadingButtonKey === b.key ? "Uploading…" : "Upload image"}
                  </button>

                  <span className="text-sm text-gray-500">No image uploaded</span>
                </div>
              )}
            </div>
          ))}
        </div>

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

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              className="border px-4 py-2 rounded-lg"
              disabled={uploadingIntro}
              onClick={() => introFileRef.current?.click()}
            >
              {uploadingIntro ? "Uploading…" : "Upload file"}
            </button>

            {tour.intro_audio_url ? (
              <>
                <a
                  className="text-sm underline"
                  href={tour.intro_audio_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview
                </a>

                <button
                  type="button"
                  className="border px-2 py-1 rounded-lg text-red-600 text-xs"
                  disabled={deletingIntro}
                  onClick={handleDeleteIntroAudio}
                >
                  {deletingIntro ? "Deleting…" : "Delete"}
                </button>
              </>
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
              onChange={(e) =>
                setNewStop((s) => ({ ...s, title: e.target.value }))
              }
            />
          </div>

          {/* Pass By */}
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
              onChange={(e) =>
                setNewStop((s) => ({ ...s, lat: e.target.value }))
              }
            />
          </div>

          <div>
            <div className="text-xs font-medium text-gray-700">Longitude</div>
            <input
              className="border rounded-lg p-2 w-full"
              placeholder="-68.2043"
              value={String(newStop.lng)}
              onChange={(e) =>
                setNewStop((s) => ({ ...s, lng: e.target.value }))
              }
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
                      value={s.title}
                      onChange={(e) =>
                        updateStopLocal(s.id, { title: e.target.value })
                      }
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
                      className="bg-black text-white px-2 py-1 rounded-lg disabled:opacity-60"
                      disabled={!dirtyStops.has(s.id) || savingStopIds.has(s.id)}
                      onClick={() => saveStop(s.id)}
                    >
                      {savingStopIds.has(s.id)
                        ? "Saving…"
                        : dirtyStops.has(s.id)
                        ? "Save"
                        : "Saved"}
                    </button>

                    <button
                      className="border px-2 py-1 rounded-lg text-red-600"
                      onClick={() => deleteStop(s.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Pass By toggle */}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!s.pass_by}
                    onChange={(e) =>
                      updateStopLocal(s.id, { pass_by: e.target.checked })
                    }
                  />
                  Pass By
                </label>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
                  <div>
                    <div className="text-xs font-medium text-gray-700">
                      Latitude
                    </div>
                    <input
                      className="border rounded-lg p-1 w-full"
                      value={String(s.lat)}
                      onChange={(e) =>
                        updateStopLocal(s.id, { lat: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-700">
                      Longitude
                    </div>
                    <input
                      className="border rounded-lg p-1 w-full"
                      value={String(s.lng)}
                      onChange={(e) =>
                        updateStopLocal(s.id, { lng: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-700">
                      Radius (meters)
                    </div>
                    <input
                      className="border rounded-lg p-1 w-full"
                      value={String(s.radius_m)}
                      onChange={(e) =>
                        updateStopLocal(s.id, {
                          radius_m: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  {/* Audio */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="text-xs font-medium text-gray-700">
                      Audio
                    </div>

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
                            onClick={() =>
                              handleDeleteStopAudio(s.id, s.audio_url!)
                            }
                          >
                            {deletingStopAudioId === s.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">
                          No file uploaded
                        </span>
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
                      {uploadingStopImageId === s.id
                        ? "Uploading…"
                        : "Upload image"}
                    </button>

                    {s.image_url ? (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-700">Uploaded ✓</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                          onClick={() =>
                            handleDeleteStopImage(s.id, s.image_url!)
                          }
                        >
                          {deletingStopImageId === s.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">
                        No image uploaded
                      </span>
                    )}
                  </div>
                </div>

                {dirtyStops.has(s.id) && (
                  <div className="text-xs text-gray-500">
                    Unsaved changes — click{" "}
                    <span className="font-medium">Save</span>.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
