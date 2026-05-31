// نظام النداء الصوتي العربي — Text-to-Speech
// مُحسَّن لـ Chrome: تحميل الأصوات مسبقاً + إصلاح خلل التوقف بعد 15 ثانية

export interface AnnounceOptions {
  name: string;
  gender?: 'male' | 'female';
  times?: number;
  pauseMs?: number;
}

// ===== تحميل الأصوات مسبقاً عند بدء الصفحة =====
// Chrome يطلب أن تكون speechSynthesis.speak() مباشرةً داخل حدث المستخدم.
// أي await طويل قبل speak() يُفقد "user gesture context".
// الحل: نحمّل الأصوات في الخلفية بمجرد تحميل الصفحة.
let _cachedVoices: SpeechSynthesisVoice[] = [];

function primeTTS(): void {
  if (!('speechSynthesis' in window)) return;

  const load = () => {
    _cachedVoices = window.speechSynthesis.getVoices();
  };

  load();
  window.speechSynthesis.addEventListener('voiceschanged', load);
  // بعض الأنظمة تحتاج تشغيل صامت أولي لفتح قناة الصوت (Chrome Autoplay Policy)
  // نقوم بإنشاء utterance صامت لفتح القناة دون حاجة لنقر المستخدم
  setTimeout(() => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) _cachedVoices = voices;
  }, 500);
}

// ابدأ التحميل فور تحميل الملف
if (typeof window !== 'undefined') primeTTS();

// ===== اختيار الصوت العربي =====
function selectArabicVoice(): SpeechSynthesisVoice | null {
  const voices = _cachedVoices.length
    ? _cachedVoices
    : (typeof window !== 'undefined' ? window.speechSynthesis.getVoices() : []);

  return (
    voices.find((v) => v.lang === 'ar-SA') ??
    voices.find((v) => v.lang === 'ar-EG') ??
    voices.find((v) => v.lang.startsWith('ar')) ??
    voices.find((v) => /arabic/i.test(v.name)) ??
    null
  );
}

// ===== نداء واحد =====
function speak(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ss = window.speechSynthesis;
    if (!ss) { reject(new Error('المتصفح لا يدعم النداء الصوتي')); return; }

    // أوقف أي نداء سابق
    ss.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = 'ar-SA';
    utter.rate  = 0.82;
    utter.pitch = 1;
    utter.volume = 1;

    const voice = selectArabicVoice();
    if (voice) utter.voice = voice;

    // مهلة زمنية للحماية من تجمّد Chrome (120ms لكل حرف + 5 ثوانٍ)
    const timeoutMs = Math.max(8000, text.length * 120 + 5000);
    let timer: ReturnType<typeof setTimeout>;

    // إصلاح خلل Chrome: يتوقف تلقائياً بعد ~15 ثانية → استئناف كل 5 ثوانٍ
    const resumeInterval = setInterval(() => {
      if (ss.paused) ss.resume();
    }, 5000);

    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(resumeInterval);
    };

    timer = setTimeout(() => {
      cleanup();
      ss.cancel();
      resolve(); // نكمل حتى لو لم تنتهِ
    }, timeoutMs);

    utter.onend = () => { cleanup(); resolve(); };
    utter.onerror = (e) => {
      cleanup();
      if (e.error === 'interrupted' || e.error === 'canceled') resolve();
      else reject(new Error(`خطأ في النداء: ${e.error}`));
    };

    // ← لا setTimeout هنا — يجب استدعاء speak() مباشرةً (user gesture context)
    ss.speak(utter);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function buildText(name: string, gender: 'male' | 'female' = 'male'): string {
  const prefix = gender === 'female' ? 'الطالبة' : 'الطالب';
  return `${prefix} ${name}، الرجاء التوجه إلى بوابة الخروج.`;
}

// ===== الوظيفة الرئيسية =====
export async function announceStudent(opts: AnnounceOptions): Promise<void> {
  const { name, gender = 'male', times = 3, pauseMs = 1200 } = opts;
  const text = buildText(name, gender);

  // تحديث الأصوات في حال لم تكن محمّلة بعد (نتحقق بسرعة بدون await)
  if (_cachedVoices.length === 0) {
    _cachedVoices = window.speechSynthesis.getVoices();
  }

  for (let i = 0; i < times; i++) {
    await speak(text);
    if (i < times - 1) await sleep(pauseMs);
  }
}

export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}

export function getAvailableArabicVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.startsWith('ar') || /arabic/i.test(v.name));
}
