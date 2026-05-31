// نظام النداء الصوتي العربي — Text-to-Speech
// يدعم اللغة العربية ويكرر النداء 3 مرات
// مُحسَّن لـ Chrome مع إصلاح خلل التوقف بعد 15 ثانية

export interface AnnounceOptions {
  name: string;
  gender?: 'male' | 'female';
  times?: number;
  pauseMs?: number;
}

function buildText(name: string, gender: 'male' | 'female' = 'male'): string {
  const prefix = gender === 'female' ? 'الطالبة' : 'الطالب';
  return `${prefix} ${name}، الرجاء التوجه إلى بوابة الخروج.`;
}

// تحميل الأصوات مع انتظار حقيقي (Chrome يُحمّلها بشكل غير متزامن)
async function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  let voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) return voices;

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
    // احتياطي: بعد 3 ثوانٍ نكمل بأي صوت متاح
    setTimeout(finish, 3000);
  });
}

function selectArabicVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  // الأولوية: ar-SA → ar-EG → أي عربي → اسمه يحتوي Arabic
  return (
    voices.find((v) => v.lang === 'ar-SA') ??
    voices.find((v) => v.lang === 'ar-EG') ??
    voices.find((v) => v.lang.startsWith('ar')) ??
    voices.find((v) => /arabic/i.test(v.name)) ??
    null
  );
}

function speak(text: string, voice: SpeechSynthesisVoice | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('المتصفح لا يدعم نظام النداء الصوتي'));
      return;
    }

    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ar-SA';
    utter.rate = 0.82;
    utter.pitch = 1;
    utter.volume = 1;
    if (voice) utter.voice = voice;

    // مهلة زمنية: تقدير 120ms لكل حرف + 5 ثوانٍ احتياط
    const timeoutMs = Math.max(8000, text.length * 120 + 5000);
    let timer: ReturnType<typeof setTimeout>;

    // إصلاح خلل Chrome: يتوقف تلقائياً بعد ~15 ثانية → نستأنف كل 5 ثوانٍ
    const resumeInterval = setInterval(() => {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 5000);

    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(resumeInterval);
    };

    timer = setTimeout(() => {
      cleanup();
      window.speechSynthesis.cancel();
      resolve(); // نكمل حتى لو لم تنتهِ
    }, timeoutMs);

    utter.onend = () => { cleanup(); resolve(); };
    utter.onerror = (e) => {
      cleanup();
      if (e.error === 'interrupted' || e.error === 'canceled') resolve();
      else reject(new Error(`خطأ في النداء: ${e.error}`));
    };

    // بعض متصفحات الجوال تحتاج تأخيراً صغيراً بعد cancel()
    setTimeout(() => window.speechSynthesis.speak(utter), 80);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export async function announceStudent(opts: AnnounceOptions): Promise<void> {
  const { name, gender = 'male', times = 3, pauseMs = 1200 } = opts;
  const text = buildText(name, gender);

  const voices = await loadVoices();
  const voice  = selectArabicVoice(voices);

  for (let i = 0; i < times; i++) {
    await speak(text, voice);
    if (i < times - 1) await sleep(pauseMs);
  }
}

export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}

// معلومات تشخيصية للواجهة
export function getAvailableArabicVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.startsWith('ar') || /arabic/i.test(v.name));
}
