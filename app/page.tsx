"use client";

import { useState, useEffect } from "react";
import { supabase, Video } from "@/lib/supabase";
import VideoCard from "@/components/VideoCard";
import { Loader2 } from "lucide-react";

const categories = [
  "All",
  "Music",
  "Gaming",
  "Live",
  "Comedy",
  "Technology",
  "News",
  "Sports",
  "Education",
  "Entertainment",
  "Travel",
  "Cooking",
];

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    fetchVideos();
  }, [activeCategory]);

  const fetchVideos = async () => {
    setLoading(true);
    let query = supabase
      .from("videos")
      .select("*, channel(*)")
      .order("created_at", { ascending: false });

    if (activeCategory !== "All") {
      query = query.eq("category", activeCategory);
    }

    const { data } = await query;
    setVideos((data as Video[]) || []);
    setLoading(false);
  };

  return (
    <div>
      <div className="sticky top-14 sm:top-14 z-30 bg-white border-b border-neutral-200">
        <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-neutral-400" />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-neutral-500 text-lg">No videos found</p>
            <p className="text-neutral-400 text-sm mt-2">
              {activeCategory === "All"
                ? "Be the first to upload a video!"
                : `No videos in the ${activeCategory} category yet.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
