"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ThumbsUp,
  ThumbsDown,
  Reply,
  Edit2,
  Trash2,
  Flag,
  Globe,
  Check,
  X,
  Loader2,
  Clock,
  MapPin,
  CornerDownRight,
} from "lucide-react";
import { supabase, Comment } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { timeAgo } from "@/lib/utils";

const EDIT_TIME_LIMIT_MINUTES = 15;
const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "offensive", label: "Offensive or inappropriate content" },
  { value: "misinformation", label: "Misinformation" },
  { value: "other", label: "Other" },
];

function formatFullDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderMentions(text: string): React.ReactNode {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const username = part.substring(1);
      return (
        <Link
          key={i}
          href={`/search?q=${encodeURIComponent(username)}`}
          className="text-blue-600 hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function CommentItem({
  comment,
  videoId,
  onReply,
  onDelete,
  onUpdate,
  depth,
}: {
  comment: Comment;
  videoId: string;
  onReply: (parentId: string, reply: Comment) => void;
  onDelete: (commentId: string) => void;
  onUpdate: (commentId: string, newText: string) => void;
  depth: number;
}) {
  const router = useRouter();
  const { user, channel } = useAuth();
  const [likeCount, setLikeCount] = useState(comment.like_count || 0);
  const [dislikeCount, setDislikeCount] = useState(comment.dislike_count || 0);
  const [userReaction, setUserReaction] = useState<"like" | "dislike" | null>(
    comment.user_reaction || null
  );
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState("");
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<
    { id: string; old_text: string | null; new_text: string | null; action: string; created_at: string }[]
  >([]);
  const [canEdit, setCanEdit] = useState(false);
  const editTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (comment.created_at) {
      const elapsed = Date.now() - new Date(comment.created_at).getTime();
      setCanEdit(elapsed < EDIT_TIME_LIMIT_MINUTES * 60 * 1000);
    }
  }, [comment.created_at]);

  const handleLike = async () => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    if (userReaction === "like") {
      await supabase.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", user.id);
      setUserReaction(null);
      setLikeCount((c) => c - 1);
    } else {
      if (userReaction === "dislike") setDislikeCount((c) => c - 1);
      await supabase
        .from("comment_likes")
        .upsert({ user_id: user.id, comment_id: comment.id, type: "like" }, { onConflict: "user_id,comment_id" });
      setUserReaction("like");
      setLikeCount((c) => c + 1);
    }
  };

  const handleDislike = async () => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    if (userReaction === "dislike") {
      await supabase.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", user.id);
      setUserReaction(null);
      setDislikeCount((c) => c - 1);
    } else {
      if (userReaction === "like") setLikeCount((c) => c - 1);
      await supabase
        .from("comment_likes")
        .upsert({ user_id: user.id, comment_id: comment.id, type: "dislike" }, { onConflict: "user_id,comment_id" });
      setUserReaction("dislike");
      setDislikeCount((c) => c + 1);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !replyText.trim()) return;
    setReplyLoading(true);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        video_id: videoId,
        user_id: user.id,
        text: replyText.trim(),
        parent_id: comment.id,
        mentions: extractMentionsLocal(replyText),
      })
      .select("*, channel!inner(*)")
      .single();

    if (error) {
      setReplyLoading(false);
      return;
    }

    await supabase.from("comment_history").insert({
      comment_id: data.id,
      user_id: user.id,
      new_text: data.text,
      action: "created",
    });

    onReply(comment.id, data as Comment);
    setReplyText("");
    setShowReplyForm(false);
    setReplyLoading(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editText.trim()) return;
    setEditLoading(true);
    setEditError("");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    let moderationResult: { allowed: boolean; reason?: string; sanitizedText?: string } = { allowed: true };
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/moderate-comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "validate", text: editText }),
      });
      const modData = await res.json();
      moderationResult = modData;
    } catch {
      // If moderation service is down, allow the edit
    }

    if (!moderationResult.allowed) {
      setEditError(moderationResult.reason || "Comment not allowed.");
      setEditLoading(false);
      return;
    }

    const { error } = await supabase
      .from("comments")
      .update({
        text: editText.trim(),
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq("id", comment.id);

    if (error) {
      setEditError("Could not save your edit.");
      setEditLoading(false);
      return;
    }

    await supabase.from("comment_history").insert({
      comment_id: comment.id,
      user_id: user.id,
      old_text: comment.text,
      new_text: editText.trim(),
      action: "edited",
    });

    onUpdate(comment.id, editText.trim());
    setShowEditForm(false);
    setEditLoading(false);
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm("Delete this comment? This cannot be undone.")) return;

    await supabase.from("comment_history").insert({
      comment_id: comment.id,
      user_id: user.id,
      old_text: comment.text,
      action: "deleted",
    });

    await supabase.from("comments").delete().eq("id", comment.id);
    onDelete(comment.id);
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    setReportLoading(true);
    setReportError("");

    const { error } = await supabase.from("comment_reports").insert({
      user_id: user.id,
      comment_id: comment.id,
      reason: reportReason,
      details: reportDetails.trim(),
    });

    if (error) {
      if (error.code === "23505") {
        setReportError("You have already reported this comment.");
      } else {
        setReportError("Could not submit report. Please try again.");
      }
      setReportLoading(false);
      return;
    }

    await supabase
      .from("comments")
      .update({ is_flagged: true })
      .eq("id", comment.id);

    setReportSuccess(true);
    setReportLoading(false);
    setTimeout(() => {
      setShowReportForm(false);
      setReportSuccess(false);
      setReportDetails("");
    }, 2500);
  };

  const handleTranslate = async () => {
    if (translatedText) {
      setTranslatedText(null);
      return;
    }
    setTranslateLoading(true);
    setTranslateError("");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/translate-comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: comment.text, targetLang: "en", commentId: comment.id }),
      });
      if (!res.ok) throw new Error("Translation failed");
      const data = await res.json();
      if (data.error) {
        setTranslateError("Translation failed. Please try again.");
      } else {
        setTranslatedText(data.translatedText);
        setDetectedLang(data.languageName || data.detectedLanguage);
      }
    } catch {
      setTranslateError("Translation service unavailable.");
    }
    setTranslateLoading(false);
  };

  const handleShowHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    const { data } = await supabase
      .from("comment_history")
      .select("id, old_text, new_text, action, created_at")
      .eq("comment_id", comment.id)
      .order("created_at", { ascending: true });
    setHistoryEntries(data || []);
    setShowHistory(true);
  };

  const isOwner = user?.id === comment.user_id;

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {comment.channel?.avatar_url ? (
          <img
            src={comment.channel.avatar_url}
            alt={comment.channel.name}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700 font-medium">
            {comment.channel?.name?.charAt(0).toUpperCase() || "?"}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header: username, location, date */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <Link
            href={comment.channel ? `/channel/${comment.channel.id}` : "#"}
            className="text-sm font-medium text-neutral-900 hover:opacity-70"
          >
            {comment.channel?.name || "Unknown"}
          </Link>
          {comment.channel?.location && (
            <span className="flex items-center gap-0.5 text-neutral-400">
              <MapPin size={11} />
              {comment.channel.location}
            </span>
          )}
          <span className="text-neutral-400" title={formatFullDate(comment.created_at)}>
            {timeAgo(comment.created_at)}
          </span>
          {comment.is_edited && (
            <span className="text-neutral-400 flex items-center gap-0.5">
              <Edit2 size={10} />
              edited
              {comment.edited_at && (
                <span className="hidden sm:inline" title={formatFullDate(comment.edited_at)}>
                  {" "}on {new Date(comment.edited_at).toLocaleDateString()}
                </span>
              )}
            </span>
          )}
          {comment.is_flagged && (
            <span className="text-orange-500 text-xs flex items-center gap-0.5">
              <Flag size={10} />
              Flagged for review
            </span>
          )}
        </div>

        {/* Text or edit form */}
        {showEditForm ? (
          <form onSubmit={handleEdit} className="mt-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm resize-none"
              autoFocus
            />
            {editError && <p className="text-xs text-red-600 mt-1">{editError}</p>}
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                disabled={editLoading || !editText.trim()}
                className="flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-full text-xs font-medium disabled:opacity-50"
              >
                {editLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditForm(false);
                  setEditText(comment.text);
                  setEditError("");
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-full text-xs font-medium"
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-1 text-sm text-neutral-800">
            <p>{renderMentions(comment.text)}</p>
            {translatedText && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-600 mb-1 flex items-center gap-1">
                  <Globe size={11} />
                  Translated from {detectedLang || "detected language"}
                </p>
                <p className="text-sm text-neutral-800">{translatedText}</p>
              </div>
            )}
            {translateError && <p className="text-xs text-red-600 mt-1">{translateError}</p>}
          </div>
        )}

        {/* History */}
        {showHistory && (
          <div className="mt-2 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
            <p className="text-xs font-medium text-neutral-600 mb-2">Edit history</p>
            {historyEntries.length === 0 ? (
              <p className="text-xs text-neutral-400">No history available.</p>
            ) : (
              <div className="space-y-2">
                {historyEntries.map((entry) => (
                  <div key={entry.id} className="text-xs">
                    <span className="text-neutral-500 font-medium capitalize">{entry.action}</span>
                    <span className="text-neutral-400 ml-2">{formatFullDate(entry.created_at)}</span>
                    {entry.new_text && <p className="text-neutral-800 mt-0.5">{entry.new_text}</p>}
                    {entry.old_text && entry.action === "edited" && (
                      <p className="text-neutral-400 mt-0.5 line-through">{entry.old_text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {/* Like / Dislike */}
          <div className="flex items-center bg-neutral-100 rounded-full overflow-hidden">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 px-3 py-1.5 hover:bg-neutral-200 transition-colors ${
                userReaction === "like" ? "text-neutral-900" : "text-neutral-500"
              }`}
            >
              <ThumbsUp size={14} fill={userReaction === "like" ? "currentColor" : "none"} />
              {likeCount > 0 && <span className="text-xs font-medium">{likeCount}</span>}
            </button>
            <div className="w-px h-5 bg-neutral-300" />
            <button
              onClick={handleDislike}
              className={`flex items-center gap-1 px-3 py-1.5 hover:bg-neutral-200 transition-colors ${
                userReaction === "dislike" ? "text-neutral-900" : "text-neutral-500"
              }`}
            >
              <ThumbsDown size={14} fill={userReaction === "dislike" ? "currentColor" : "none"} />
              {dislikeCount > 0 && <span className="text-xs font-medium">{dislikeCount}</span>}
            </button>
          </div>

          {/* Reply */}
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="flex items-center gap-1 px-3 py-1.5 hover:bg-neutral-100 rounded-full text-xs font-medium text-neutral-600 transition-colors"
          >
            <Reply size={14} />
            Reply
          </button>

          {/* Translate */}
          <button
            onClick={handleTranslate}
            disabled={translateLoading}
            className="flex items-center gap-1 px-3 py-1.5 hover:bg-neutral-100 rounded-full text-xs font-medium text-neutral-600 transition-colors disabled:opacity-50"
          >
            {translateLoading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
            {translatedText ? "Hide translation" : "Translate"}
          </button>

          {/* Owner actions */}
          {isOwner && canEdit && !comment.is_edited && (
            <button
              onClick={() => setShowEditForm(!showEditForm)}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-neutral-100 rounded-full text-xs font-medium text-neutral-600 transition-colors"
            >
              <Edit2 size={14} />
              Edit
            </button>
          )}
          {isOwner && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-neutral-100 rounded-full text-xs font-medium text-neutral-600 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}

          {/* Report */}
          {!isOwner && (
            <button
              onClick={() => setShowReportForm(!showReportForm)}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-neutral-100 rounded-full text-xs font-medium text-neutral-600 transition-colors"
            >
              <Flag size={14} />
              Report
            </button>
          )}

          {/* History (if edited) */}
          {comment.is_edited && (
            <button
              onClick={handleShowHistory}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-neutral-100 rounded-full text-xs font-medium text-neutral-600 transition-colors"
            >
              <Clock size={14} />
              History
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReplyForm && (
          <form onSubmit={handleReplySubmit} className="mt-3 flex gap-3">
            {channel?.avatar_url ? (
              <img
                src={channel.avatar_url}
                alt={channel.name}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700 text-xs font-medium flex-shrink-0">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Add a reply..."
                className="w-full h-9 px-3 bg-transparent border-b border-neutral-300 outline-none focus:border-neutral-900 text-neutral-900 text-sm transition-colors"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="submit"
                  disabled={replyLoading || !replyText.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-full text-xs font-medium disabled:opacity-50"
                >
                  {replyLoading ? <Loader2 size={12} className="animate-spin" /> : <CornerDownRight size={12} />}
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyText("");
                  }}
                  className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-full text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Report form */}
        {showReportForm && (
          <form onSubmit={handleReport} className="mt-3 p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
            {reportSuccess ? (
              <p className="text-sm text-green-600 flex items-center gap-2">
                <Check size={16} />
                Report submitted. A moderator will review this comment.
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-neutral-800 mb-3">Report this comment</p>
                <div className="space-y-2 mb-3">
                  {REPORT_REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.value}
                        checked={reportReason === r.value}
                        onChange={() => setReportReason(r.value)}
                        className="accent-neutral-900"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Additional details (optional)..."
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm resize-none"
                />
                {reportError && <p className="text-xs text-red-600 mt-2">{reportError}</p>}
                <div className="flex gap-2 mt-3">
                  <button
                    type="submit"
                    disabled={reportLoading}
                    className="flex items-center gap-1 px-4 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-full text-xs font-medium disabled:opacity-50"
                  >
                    {reportLoading ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />}
                    Submit report
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReportForm(false)}
                    className="px-4 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-full text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-4 pl-2 border-l-2 border-neutral-100">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                videoId={videoId}
                onReply={onReply}
                onDelete={onDelete}
                onUpdate={onUpdate}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function extractMentionsLocal(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]+)/g);
  if (!matches) return [];
  return matches.map((m) => m.substring(1));
}
