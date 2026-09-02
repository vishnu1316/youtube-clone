"use client";

import Link from "next/link";
import Image from "next/image";
import { Video } from "@/lib/supabase";
import { formatViews, timeAgo } from "@/lib/utils";

export default function VideoCard({ video }: { video: Video }) {
  return (
    <Link href={`/video/${video.id}`} className="group cursor-pointer">
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-200">
        {video.thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt={video.title}
            fill
            className="object-cover group-hover:rounded-none transition-all duration-200"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400">
            No Thumbnail
          </div>
        )}
        {video.duration && video.duration !== "0:00" && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
            {video.duration}
          </span>
        )}
      </div>
      <div className="flex gap-3 mt-3">
        <div className="flex-shrink-0">
          {video.channel?.avatar_url ? (
            <Image
              src={video.channel.avatar_url}
              alt={video.channel.name}
              width={36}
              height={36}
              className="rounded-full"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700 text-sm font-medium">
              {video.channel?.name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-neutral-900 line-clamp-2 leading-5">
            {video.title}
          </h3>
          <p className="text-xs text-neutral-500 mt-1 hover:text-neutral-800 transition-colors">
            {video.channel?.name || "Unknown Channel"}
          </p>
          <p className="text-xs text-neutral-500">
            {formatViews(video.views)} - {timeAgo(video.created_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
