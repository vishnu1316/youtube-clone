import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
  nl: "Dutch",
  tr: "Turkish",
  pl: "Polish",
  sv: "Swedish",
};

function detectLanguage(text: string): string {
  const codePoints = [...text];

  if (codePoints.some((c) => {
    const n = c.codePointAt(0)!;
    return n >= 0x3040 && n <= 0x309f;
  })) return "ja";
  if (codePoints.some((c) => {
    const n = c.codePointAt(0)!;
    return n >= 0xac00 && n <= 0xd7af;
  })) return "ko";
  if (codePoints.some((c) => {
    const n = c.codePointAt(0)!;
    return n >= 0x4e00 && n <= 0x9fff;
  })) return "zh";
  if (codePoints.some((c) => {
    const n = c.codePointAt(0)!;
    return n >= 0x0400 && n <= 0x04ff;
  })) return "ru";
  if (codePoints.some((c) => {
    const n = c.codePointAt(0)!;
    return n >= 0x0600 && n <= 0x06ff;
  })) return "ar";
  if (codePoints.some((c) => {
    const n = c.codePointAt(0)!;
    return n >= 0x0900 && n <= 0x097f;
  })) return "hi";

  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "en";

  const scored = Object.entries(SCORE_MAP).map(([lang, dict]) => {
    let score = 0;
    for (const w of words) {
      if (dict.has(w)) score++;
    }
    return { lang, score };
  }).sort((a, b) => b.score - a.score);

  if (scored[0].score > 0) return scored[0].lang;
  return "en";
}

const SCORE_MAP: Record<string, Set<string>> = {
  en: new Set(["the", "and", "is", "to", "of", "a", "in", "it", "that", "you", "for", "on", "are", "with", "this", "but", "have", "from", "not", "was", "very", "good", "love", "great", "awesome"]),
  es: new Set(["el", "la", "los", "las", "de", "que", "y", "en", "un", "una", "es", "se", "no", "te", "lo", "muy", "bueno", "amor", "grande", "increible"]),
  fr: new Set(["le", "la", "les", "de", "et", "en", "un", "une", "est", "se", "ne", "te", "lo", "très", "bon", "amour", "grand", "incroyable"]),
  de: new Set(["der", "die", "das", "und", "in", "ein", "eine", "ist", "se", "nicht", "te", "lo", "sehr", "gut", "liebe", "groß", "unglaublich"]),
  it: new Set(["il", "la", "le", "di", "e", "in", "un", "una", "è", "se", "non", "te", "lo", "molto", "buono", "amore", "grande", "incredibile"]),
  pt: new Set(["o", "a", "os", "as", "de", "que", "e", "em", "um", "uma", "é", "se", "não", "te", "lo", "muito", "bom", "amor", "grande", "incrível"]),
  nl: new Set(["de", "het", "een", "en", "in", "is", "te", "lo", "se", "niet", "zeer", "goed", "liefde", "groot", "ongelooflijk"]),
  tr: new Set(["ve", "bir", "bu", "için", "ile", "çok", "iyi", "aşk", "büyük", "inanılmaz"]),
  pl: new Set(["i", "w", "na", "jest", "nie", "to", "bardzo", "dobry", "miłość", "wielki", "niesamowity"]),
  sv: new Set(["och", "en", "ett", "är", "inte", "det", "mycket", "bra", "kärlek", "stor", "otrolig"]),
};

async function translateWithGoogle(text: string, target: string, source: string): Promise<string | null> {
  const apiKey = Deno.env.get("GOOGLE_TRANSLATE_API_KEY");
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target, source, format: "text" }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.translations?.[0]?.translatedText ?? null;
  } catch {
    return null;
  }
}

function simpleTranslate(text: string, target: string, source: string): string {
  if (source === target) return text;
  const dict = SIMPLE_DICT[`${source}->${target}`];
  if (!dict) return `[${LANGUAGE_NAMES[target] || target}] ${text}`;
  let result = text;
  for (const [from, to] of Object.entries(dict)) {
    result = result.replace(new RegExp(`\\b${from}\\b`, "gi"), to);
  }
  return result;
}

const SIMPLE_DICT: Record<string, Record<string, string>> = {
  "en->es": { good: "bueno", love: "amor", great: "grande", awesome: "increible", very: "muy", the: "el", and: "y", is: "es" },
  "es->en": { bueno: "good", amor: "love", grande: "great", increible: "awesome", muy: "very", el: "the", la: "the", y: "and", es: "is" },
  "en->fr": { good: "bon", love: "amour", great: "grand", awesome: "incroyable", very: "très", the: "le", and: "et", is: "est" },
  "fr->en": { bon: "good", amour: "love", grand: "great", incroyable: "awesome", très: "very", le: "the", la: "the", et: "and", est: "is" },
  "en->de": { good: "gut", love: "liebe", great: "groß", awesome: "unglaublich", very: "sehr", the: "der", and: "und", is: "ist" },
  "de->en": { gut: "good", liebe: "love", groß: "great", unglaublich: "awesome", sehr: "very", der: "the", und: "and", ist: "is" },
  "en->ja": { good: "良い", love: "愛", great: "素晴らしい", awesome: "素晴らしい", very: "とても" },
  "ja->en": { 良い: "good", 愛: "love", 素晴らしい: "awesome", とても: "very" },
  "en->zh": { good: "好", love: "爱", great: "伟大", awesome: "太棒了", very: "非常" },
  "zh->en": { 好: "good", 爱: "love", 伟大: "great", 太棒了: "awesome", 非常: "very" },
  "en->ru": { good: "хороший", love: "любовь", great: "великий", awesome: "потрясающий", very: "очень" },
  "ru->en": { хороший: "good", любовь: "love", великий: "great", потрясающий: "awesome", очень: "very" },
  "en->ar": { good: "جيد", love: "حب", great: "عظيم", awesome: "رائع", very: "جدا" },
  "ar->en": { جيد: "good", حب: "love", عظيم: "great", رائع: "awesome", جدا: "very" },
  "en->hi": { good: "अच्छा", love: "प्यार", great: "महान", awesome: "शानदार", very: "बहुत" },
  "hi->en": { अच्छा: "good", प्यार: "love", महान: "great", शानदार: "awesome", बहुत: "very" },
  "en->it": { good: "buono", love: "amore", great: "grande", awesome: "incredibile", very: "molto", the: "il", and: "e", is: "è" },
  "it->en": { buono: "good", amore: "love", grande: "great", incredibile: "awesome", molto: "very", il: "the", e: "and", è: "is" },
  "en->pt": { good: "bom", love: "amor", great: "grande", awesome: "incrível", very: "muito", the: "o", and: "e", is: "é" },
  "pt->en": { bom: "good", amor: "love", grande: "great", incrível: "awesome", muito: "very", o: "the", e: "and", é: "is" },
  "en->ko": { good: "좋은", love: "사랑", great: "위대한", awesome: "멋진", very: "매우" },
  "ko->en": { 좋은: "good", 사랑: "love", 위대한: "great", 멋진: "awesome", 매우: "very" },
  "en->nl": { good: "goed", love: "liefde", great: "groot", awesome: "ongelooflijk", very: "zeer", the: "de", and: "en", is: "is" },
  "nl->en": { goed: "good", liefde: "love", groot: "great", ongelooflijk: "awesome", zeer: "very", de: "the", en: "and" },
  "en->tr": { good: "iyi", love: "aşk", great: "büyük", awesome: "inanılmaz", very: "çok" },
  "tr->en": { iyi: "good", aşk: "love", büyük: "great", inanılmaz: "awesome", çok: "very" },
  "en->pl": { good: "dobry", love: "miłość", great: "wielki", awesome: "niesamowity", very: "bardzo" },
  "pl->en": { dobry: "good", miłość: "love", wielki: "great", niesamowity: "awesome", bardzo: "very" },
  "en->sv": { good: "bra", love: "kärlek", great: "stor", awesome: "otrolig", very: "mycket", the: "den", and: "och", is: "är" },
  "sv->en": { bra: "good", kärlek: "love", stor: "great", otrolig: "awesome", mycket: "very", den: "the", och: "and", är: "is" },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { text, targetLang, commentId } = await req.json();

    if (!text || typeof text !== "string" || text.length > 5000) {
      return new Response(JSON.stringify({ error: "Invalid text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = (targetLang || "en").toLowerCase();
    const detectedSource = detectLanguage(text);

    if (detectedSource === target) {
      return new Response(JSON.stringify({
        translatedText: text,
        detectedLanguage: detectedSource,
        languageName: LANGUAGE_NAMES[detectedSource] || detectedSource,
        source: "same-language",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const googleResult = await translateWithGoogle(text, target, detectedSource);
    if (googleResult) {
      return new Response(JSON.stringify({
        translatedText: googleResult,
        detectedLanguage: detectedSource,
        languageName: LANGUAGE_NAMES[detectedSource] || detectedSource,
        source: "google",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fallback = simpleTranslate(text, target, detectedSource);
    return new Response(JSON.stringify({
      translatedText: fallback,
      detectedLanguage: detectedSource,
      languageName: LANGUAGE_NAMES[detectedSource] || detectedSource,
      source: "fallback",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Translation failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
