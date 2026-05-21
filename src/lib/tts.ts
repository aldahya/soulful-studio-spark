// نظام النداء الصوتي العربي — Text-to-Speech
// يدعم اللغة العربية ويكرر النداء 3 مرات

export interface AnnounceOptions {
  name: string;
  gender?: 'male' | 'female'; // ذكر أو أنثى
  times?: number;              // عدد مرات التكرار (افتراضي: 3)
  pauseMs?: number;            // توقف بين النداءات بالمللي ثانية
}

function buildText(name: string, gender: 'male' | 'female' = 'male'): string {
  const prefix = gender === 'female' ? 'الطالبة' : 'الطالب';
  return `${prefix} ${name}، الرجاء التوجه إلى بوابة الخروج.`;
}

function speak(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('المتصفح لا يدعم نظام النداء الصوتي'));
      return;
    }
    // إيقاف أي نداء جارٍ
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ar-SA';
    utter.rate = 0.85;
    utter.pitch = 1;
    utter.volume = 1;

    // اختيار صوت عربي إن وُجد
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(
      (v) => v.lang.startsWith('ar') || v.name.includes('Arabic') || v.name.includes('Arab')
    );
    if (arabicVoice) utter.voice = arabicVoice;

    utter.onend = () => resolve();
    utter.onerror = (e) => {
      // interrupted يعني تم إلغاؤه — ليس خطأ حقيقياً
      if (e.error === 'interrupted') resolve();
      else reject(new Error(`خطأ في النداء: ${e.error}`));
    };

    window.speechSynthesis.speak(utter);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export async function announceStudent(opts: AnnounceOptions): Promise<void> {
  const { name, gender = 'male', times = 3, pauseMs = 1200 } = opts;
  const text = buildText(name, gender);

  // تأكد من تحميل الأصوات
  if (window.speechSynthesis.getVoices().length === 0) {
    await new Promise<void>((res) => {
      window.speechSynthesis.onvoiceschanged = () => res();
      setTimeout(res, 1000); // timeout احتياطي
    });
  }

  for (let i = 0; i < times; i++) {
    await speak(text);
    if (i < times - 1) await sleep(pauseMs);
  }
}

export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}
