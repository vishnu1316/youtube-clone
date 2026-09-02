"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send, AlertCircle, ShieldCheck } from "lucide-react";
import { supabase, Comment } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import CommentItem from "./CommentItem";

type SortOption = "newest" | "oldest" | "most_liked" | "relevant";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  oldest: "Oldest",
  most_liked: "Most liked",
  relevant: "Most relevant",
};

const CAPTCHA_CHALLENGES = [
  { question: "What is 3 + 4?", answer: "7" },
  { question: "What is 8 - 3?", answer: "5" },
  { question: "What is 2 + 6?", answer: "8" },
  { question: "What is 9 - 4?", answer: "5" },
  { question: "What is 5 + 2?", answer: "7" },
  { question: "What is 10 - 7?", answer: "3" },
];

function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]+)/g);
  if (!matches) return [];
  return matches.map((m) => m.substring(1));
}

export default function CommentSection({ videoId }: { videoId: string }) {
  const router = useRouter();
  const { user, channel } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [sort, setSort] = useState<SortOption>("relevant");
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [captchaIndex, setCaptchaIndex] = useState(0);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaError, setCaptchaError] = useState("");

  const fetchComments = useCallback(async () => {
    setLoading(true);

    const { data: topComments } = await supabase
      .from("comments")
      .select("*, channel!inner(*)")
      .eq("video_id", videoId)
      .is("parent_id", null)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false });

    if (!topComments) {
      setLoading(false);
      return;
    }

    const topList = topComments as Comment[];

    // Fetch replies for all top-level comments
    const topIds = topList.map((c) => c.id);
    let repliesMap: Record<string, Comment[]> = {};
    if (topIds.length > 0) {
      const { data: replies } = await supabase
        .from("comments")
        .select("*, channel!inner(*)")
        .eq("video_id", videoId)
        .in("parent_id", topIds)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });
      if (replies) {
        for (const reply of replies as Comment[]) {
          if (!repliesMap[reply.parent_id!]) repliesMap[reply.parent_id!] = [];
          repliesMap[reply.parent_id!].push(reply);
        }
      }
    }

    // Fetch like/dislike counts and user reactions
    const allIds = [...topIds, ...Object.values(repliesMap).flat().map((r) => r.id)];
    let likeCounts: Record<string, { likes: number; dislikes: number }> = {};
    let userReactions: Record<string, "like" | "dislike"> = {};

    if (allIds.length > 0) {
      const { data: likes } = await supabase
        .from("comment_likes")
        .select("comment_id, type, user_id")
        .in("comment_id", allIds);

      if (likes) {
        for (const like of likes as { comment_id: string; type: "like" | "dislike"; user_id: string }[]) {
          if (!likeCounts[like.comment_id]) likeCounts[like.comment_id] = { likes: 0, dislikes: 0 };
          if (like.type === "like") likeCounts[like.comment_id].likes++;
          else likeCounts[like.comment_id].dislikes++;
          if (user && like.user_id === user.id) {
            userReactions[like.comment_id] = like.type;
          }
        }
      }
    }

    const enriched = topList.map((c) => ({
      ...c,
      like_count: likeCounts[c.id]?.likes || 0,
      dislike_count: likeCounts[c.id]?.dislikes || 0,
      user_reaction: userReactions[c.id] || null,
      replies: (repliesMap[c.id] || []).map((r) => ({
        ...r,
        like_count: likeCounts[r.id]?.likes || 0,
        dislike_count: likeCounts[r.id]?.dislikes || 0,
        user_reaction: userReactions[r.id] || null,
      })),
    }));

    setComments(enriched);
    setLoading(false);
  }, [videoId, user]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Check if CAPTCHA is needed
  useEffect(() => {
    if (!user) return;
    const checkCaptcha = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/moderate-comment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "check-captcha" }),
        });
        const data = await res.json();
        if (data.requireCaptcha) {
          setRequireCaptcha(true);
          setCaptchaIndex(Math.floor(Math.random() * CAPTCHA_CHALLENGES.length));
        }
      } catch {
        // If service is down, don't block commenting
      }
    };
    void checkCaptcha();
  }, [user]);

  const sortedComments = [...comments].sort((a, b) => {
    switch (sort) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "most_liked":
        return (b.like_count || 0) - (a.like_count || 0);
      case "relevant":
      default:
        const aScore = (a.like_count || 0) - (a.dislike_count || 0) + (a.replies?.length || 0) * 2;
        const bScore = (b.like_count || 0) - (b.dislike_count || 0) + (b.replies?.length || 0) * 2;
        return bScore - aScore;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    if (!newComment.trim()) return;

    // CAPTCHA verification if required
    if (requireCaptcha) {
      if (captchaInput.trim() !== CAPTCHA_CHALLENGES[captchaIndex].answer) {
        setCaptchaError("Incorrect CAPTCHA answer. Please try again.");
        setCaptchaIndex(Math.floor(Math.random() * CAPTCHA_CHALLENGES.length));
        setCaptchaInput("");
        return;
      }
      setCaptchaError("");
    }

    setSubmitting(true);
    setCommentError("");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    // Validate through moderation edge function
    let moderationResult: { allowed: boolean; reason?: string; sanitizedText?: string; requireCaptcha?: boolean } = { allowed: true };
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/moderate-comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "validate", text: newComment }),
      });
      const modData = await res.json();
      moderationResult = modData;
    } catch {
      // If moderation service is down, allow the comment
    }

    if (!moderationResult.allowed) {
      setCommentError(moderationResult.reason || "Comment not allowed.");
      setSubmitting(false);
      if (moderationResult.requireCaptcha) {
        setRequireCaptcha(true);
        setCaptchaIndex(Math.floor(Math.random() * CAPTCHA_CHALLENGES.length));
      }
      return;
    }

    const sanitizedText = moderationResult.sanitizedText || newComment.trim();
    const mentions = extractMentions(sanitizedText);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        video_id: videoId,
        user_id: user.id,
        text: sanitizedText,
        mentions,
      })
      .select("*, channel!inner(*)")
      .single();

    if (error) {
      setCommentError("Could not post your comment. Please try again.");
      setSubmitting(false);
      return;
    }

    // Record in history
    await supabase.from("comment_history").insert({
      comment_id: data.id,
      user_id: user.id,
      new_text: data.text,
      action: "created",
    });

    const newCommentObj: Comment = {
      ...data,
      like_count: 0,
      dislike_count: 0,
      user_reaction: null,
      replies: [],
    } as Comment;

    setComments((c) => [newCommentObj, ...c]);
    setNewComment("");
    setCaptchaInput("");
    setRequireCaptcha(false);
    setSubmitting(false);
  };

  const handleReply = (parentId: string, reply: Comment) => {
    setComments((c) =>
      c.map((comment) => {
        if (comment.id === parentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), reply],
          };
        }
        return comment;
      })
    );
  };

  const handleDelete = (commentId: string) => {
    setComments((c) =>
      c
        .filter((comment) => comment.id !== commentId)
        .map((comment) => ({
          ...comment,
          replies: (comment.replies || []).filter((r) => r.id !== commentId),
        }))
    );
  };

  const handleUpdate = (commentId: string, newText: string) => {
    setComments((c) =>
      c.map((comment) => {
        if (comment.id === commentId) {
          return { ...comment, text: newText, is_edited: true, edited_at: new Date().toISOString() };
        }
        return {
          ...comment,
          replies: (comment.replies || []).map((r) =>
            r.id === commentId ? { ...r, text: newText, is_edited: true, edited_at: new Date().toISOString() } : r
          ),
        };
      })
    );
  };

  return (
    <div>
      <h2 className="text-lg font-medium text-neutral-900 mb-4">
        {comments.length} Comments
      </h2>

      {/* Sort options */}
      {comments.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-neutral-500">Sort by:</span>
          {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setSort(opt)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                sort === opt
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {SORT_LABELS[opt]}
            </button>
          ))}
        </div>
      )}

      {/* New comment form */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
          {channel?.avatar_url ? (
            <img
              src={channel.avatar_url}
              alt={channel.name}
              className="w-10 h-10 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700 font-medium flex-shrink-0">
              {user.email?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              maxLength={2000}
              className="w-full h-10 px-3 bg-transparent border-b border-neutral-300 outline-none focus:border-neutral-900 text-neutral-900 text-sm transition-colors"
            />
            {commentError && (
              <p className="flex items-start gap-1.5 mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                {commentError}
              </p>
            )}
            {requireCaptcha && (
              <div className="mt-3 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                <p className="text-xs text-neutral-600 mb-2 flex items-center gap-1">
                  <ShieldCheck size={14} />
                  Please verify you&apos;re not a bot:
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-700">{CAPTCHA_CHALLENGES[captchaIndex].question}</span>
                  <input
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    className="w-20 h-8 px-2 bg-white border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
                    placeholder="Answer"
                  />
                </div>
                {captchaError && <p className="text-xs text-red-600 mt-1">{captchaError}</p>}
              </div>
            )}
            <div className="flex justify-end mt-2 gap-2">
              {newComment.trim() && (
                <button
                  type="button"
                  onClick={() => setNewComment("")}
                  className="px-4 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="flex items-center gap-2 px-4 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Comment
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 bg-neutral-100 rounded-xl text-center">
          <p className="text-neutral-500 text-sm">
            <Link href="/auth/signin" className="text-blue-600 hover:underline">
              Sign in
            </Link>{" "}
            to leave a comment
          </p>
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : sortedComments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-neutral-400 text-sm">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              videoId={videoId}
              onReply={handleReply}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
