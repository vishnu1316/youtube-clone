import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PROFANITY_WORDS = [
  "fuck", "shit", "bitch", "asshole", "bastard", "dick", "piss", "cunt",
  "whore", "slut", "faggot", "nigger", "retard", "douche", "cock", "pussy",
  "wanker", "twat", "prick", "bollocks",
];

const SPAM_PATTERNS = [
  /(.)\1{9,}/i,           // 10+ repeated chars
  /https?:\/\/[^\s]+/gi,   // URLs (potential malicious links)
  /(.)\1{4,}[!@#$%^&*]/,  // repeated special chars + symbols
];

const EMOJI_FLOOD = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

const RATE_LIMIT_WINDOW_MINUTES = 5;
const RATE_LIMIT_MAX_COMMENTS = 10;
const EDIT_TIME_LIMIT_MINUTES = 15;
const MIN_COMMENT_LENGTH = 2;
const MAX_COMMENT_LENGTH = 2000;

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFANITY_WORDS.some((word) => {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i");
    return regex.test(lower);
  });
}

function isSpam(text: string): boolean {
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  const emojiMatches = text.match(EMOJI_FLOOD);
  if (emojiMatches && emojiMatches.length > 10) return true;
  return false;
}

function isDuplicateEmoji(text: string): boolean {
  const stripped = text.replace(EMOJI_FLOOD, "").replace(/\s/g, "");
  if (stripped.length === 0 && text.length > 5) return true;
  const emojiMatches = text.match(EMOJI_FLOOD);
  if (emojiMatches && emojiMatches.length > 0) {
    const allEmoji = emojiMatches.join("");
    const unique = new Set(emojiMatches);
    if (unique.size === 1 && emojiMatches.length > 5) return true;
  }
  return false;
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]+)/g);
  if (!matches) return [];
  return matches.map((m) => m.substring(1));
}

function sanitizeText(text: string): string {
  return text.trim().slice(0, MAX_COMMENT_LENGTH);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;

    const body = await req.json();
    const action = body.action as string;

    // ---- VALIDATE COMMENT ----
    if (action === "validate") {
      const text = sanitizeText(body.text || "");

      if (text.length < MIN_COMMENT_LENGTH) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: "Comment is too short (minimum 2 characters).",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (text.length > MAX_COMMENT_LENGTH) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: `Comment is too long (maximum ${MAX_COMMENT_LENGTH} characters).`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (containsProfanity(text)) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: "Your comment contains language that violates our community guidelines. Please remove any abusive or offensive words.",
          flagged: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (isSpam(text)) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: "Your comment appears to be spam. Please avoid posting links or excessive repeated characters.",
          flagged: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (isDuplicateEmoji(text)) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: "Comments cannot be only emoji or repeated special characters. Please add meaningful text.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Rate limiting: check comments in the last window
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { count: recentCount } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", windowStart);

      if (recentCount !== null && recentCount >= RATE_LIMIT_MAX_COMMENTS) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: `You're posting too quickly. Please wait a moment before commenting again. (Rate limit: ${RATE_LIMIT_MAX_COMMENTS} comments per ${RATE_LIMIT_WINDOW_MINUTES} minutes)`,
          rateLimited: true,
          requireCaptcha: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Duplicate comment detection: check if same text posted recently
      const { data: recentComments } = await supabase
        .from("comments")
        .select("text")
        .eq("user_id", userId)
        .gte("created_at", windowStart)
        .limit(50);

      if (recentComments) {
        const isDuplicate = recentComments.some(
          (c: { text: string }) => c.text.trim().toLowerCase() === text.toLowerCase()
        );
        if (isDuplicate) {
          return new Response(JSON.stringify({
            allowed: false,
            reason: "You've already posted this exact comment recently. Please avoid duplicate comments.",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const mentions = extractMentions(text);

      return new Response(JSON.stringify({
        allowed: true,
        sanitizedText: text,
        mentions,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- CHECK EDIT ELIGIBILITY ----
    if (action === "check-edit") {
      const commentId = body.commentId as string;
      if (!commentId) {
        return new Response(JSON.stringify({ error: "Missing commentId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: comment, error } = await supabase
        .from("comments")
        .select("user_id, created_at, is_deleted")
        .eq("id", commentId)
        .maybeSingle();

      if (error || !comment) {
        return new Response(JSON.stringify({ error: "Comment not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (comment.user_id !== userId) {
        return new Response(JSON.stringify({ error: "You can only edit your own comments" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const elapsed = Date.now() - new Date(comment.created_at).getTime();
      if (elapsed > EDIT_TIME_LIMIT_MINUTES * 60 * 1000) {
        return new Response(JSON.stringify({
          canEdit: false,
          reason: `Comments can only be edited within ${EDIT_TIME_LIMIT_MINUTES} minutes of posting.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ canEdit: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- CHECK CAPTCHA REQUIRED ----
    if (action === "check-captcha") {
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { count: recentCount } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", windowStart);

      const requireCaptcha = recentCount !== null && recentCount >= RATE_LIMIT_MAX_COMMENTS - 2;

      return new Response(JSON.stringify({ requireCaptcha }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Moderation service error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
