// نظام النداء الصوتي العربي — Text-to-Speech
// يستخدم Google Translate TTS عبر Edge Function كمصدر أساسي (يعمل بأي متصفح بدون تثبيت أصوات)
// الاحتياط: Web Speech API إذا فشل الاتصال بالشبكة

export interface AnnounceOptions {
  name: string;
  gender?: 'male' | 'female';
  times?: number;
  pauseMs?: number;
}

const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const TTS_ENDPOINT    = `${SUPABASE_URL}/functions/v1/tts-proxy`;

function buildText(name: string, gender: 'male' | 'female' = 'male'): string {
  const prefix = gender === 'female' ? 'الطالبة' : 'الطالب';
  return `${prefix} ${name}، الرجاء التوجه إلى بوابة الخروج.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ===== الصوت عبر Edge Function (Google Translate TTS) =====
async function fetchAndPlayAudio(text: string): Promise<void> {
  const url = `${TTS_ENDPOINT}?text=${encodeURIComponent(text)}&lang=ar`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SUPABASE_ANON}` },
  });

  if (!res.ok) throw new Error(`TTS server error: ${res.status}`);

  const blob = await res.blob();
  const audioUrl = URL.createObjectURL(blob);

  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(audioUrl);
    audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(audioUrl); reject(new Error('خطأ في تشغيل الصوت')); };
    audio.play().catch(reject);
  });
}

// ===== الاحتياط: Web Speech API =====
let _cachedVoices: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const load = () => { _cachedVoices = window.speechSynthesis.getVoices(); };
  load();
  window.speechSynthesis.addEventListener('voiceschanged', load);
}

function speakFallback(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ss = window.speechSynthesis;
    if (!ss) { reject(new Error('Web Speech API غير مدعوم')); return; }

    const voices = _cachedVoices.length ? _cachedVoices : ss.getVoices();
    const arabicVoice =
      voices.find((v) => v.lang === 'ar-SA') ??
      voices.find((v) => v.lang.startsWith('ar')) ??
      voices.find((v) => /arabic/i.test(v.name)) ??
      null;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ar-SA';
    utter.rate = 0.82;
    utter.pitch = 1;
    utter.volume = 1;
    if (arabicVoice) utter.voice = arabicVoice;

    const timer = setTimeout(() => { ss.cancel(); resolve(); }, 15000);
    const interval = setInterval(() => { if (ss.paused) ss.resume(); }, 5000);
    const cleanup = () => { clearTimeout(timer); clearInterval(interval); };

    utter.onend  = () => { cleanup(); resolve(); };
    utter.onerror = (e) => {
      cleanup();
      if (e.error === 'interrupted' || e.error === 'canceled') resolve();
      else reject(new Error(`Web Speech error: ${e.error}`));
    };

    ss.speak(utter);
  });
}

// ===== الوظيفة الرئيسية =====
export async function announceStudent(opts: AnnounceOptions): Promise<void> {
  const { name, gender = 'male', times = 3, pauseMs = 1200 } = opts;
  const text = buildText(name, gender);

  for (let i = 0; i < times; i++) {
    try {
      // المصدر الأساسي: Google Translate TTS عبر Edge Function
      await fetchAndPlayAudio(text);
    } catch {
      // الاحتياط: Web Speech API
      await speakFallback(text);
    }
    if (i < times - 1) await sleep(pauseMs);
  }
}

export function isTTSSupported(): boolean {
  // يعمل دائماً ما دام الاتصال بالإنترنت متوفراً
  return true;
}

export function getAvailableArabicVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.startsWith('ar') || /arabic/i.test(v.name));
}
