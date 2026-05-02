// قوالب رسائل واتساب الاحترافية لمدارس الضاحية
// تنسيق RTL، Emojis منضبطة، فواصل واضحة، خاتمة ديناميكية حسب الحالة.
import type { AttendanceStatus, Stage } from './i18n';
import { STAGE_LABELS } from './i18n';

export type NotifyKind = 'present' | 'late' | 'absent' | 'dismissal';

export interface NotifyContext {
  schoolName: string;        // اسم المدرسة
  studentName: string;       // اسم الطالب
  className?: string | null; // الفصل (اختياري)
  stage?: Stage | null;      // المرحلة
  date: string | Date;       // التاريخ
  time?: string | Date | null; // وقت العملية
  lateMinutes?: number | null; // مدة التأخر
  reason?: string | null;    // سبب الانصراف/الاستئذان
}

const FA = '━━━━━━━━━━━━━━━━━━'; // فاصل أنيق

function fmtDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}
function fmtTime(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function header(schoolName: string): string {
  return `🏫 ${schoolName}\n${FA}`;
}
function footer(kind: NotifyKind): string {
  if (kind === 'absent') return `${FA}\nنأمل منكم متابعة انتظام الطالب الدراسي 📚`;
  if (kind === 'late')   return `${FA}\nنرجو الحرص على الوصول مبكراً 🌅`;
  if (kind === 'dismissal') return `${FA}\nشكراً لتعاونكم 🤝`;
  return `${FA}\nمع تمنياتنا له بيوم دراسي موفق 🌟`;
}

function classLine(ctx: NotifyContext): string | null {
  const parts: string[] = [];
  if (ctx.stage) parts.push(STAGE_LABELS[ctx.stage]);
  if (ctx.className) parts.push(ctx.className);
  return parts.length ? `🏷️ الصف: ${parts.join(' - ')}` : null;
}

export function buildNotifyMessage(kind: NotifyKind, ctx: NotifyContext): string {
  const time = fmtTime(ctx.time);
  const lines: string[] = [];

  lines.push(header(ctx.schoolName));
  lines.push('السلام عليكم ورحمة الله وبركاته،');
  lines.push('');
  lines.push(`نحيطكم علماً بأن الطالب:`);
  lines.push(`👤 ${ctx.studentName}`);
  lines.push('');

  switch (kind) {
    case 'present':
      lines.push('تم تسجيل حضوره بنجاح ✅');
      break;
    case 'late': {
      let s = 'تم تسجيل تأخره عن بداية الدوام ⏰';
      if (ctx.lateMinutes && ctx.lateMinutes > 0) s += `\n🕒 مدة التأخر: ${ctx.lateMinutes} دقيقة`;
      lines.push(s);
      break;
    }
    case 'absent':
      lines.push('لم يتم تسجيل حضوره لهذا اليوم ❌');
      lines.push('يرجى تزويد المدرسة بسبب الغياب.');
      break;
    case 'dismissal':
      lines.push('تم تسجيل انصرافه من المدرسة 🚪');
      if (ctx.reason) lines.push(`📝 السبب: ${ctx.reason}`);
      break;
  }

  lines.push('');
  lines.push(`📅 التاريخ: ${fmtDate(ctx.date)}`);
  if (time) lines.push(`⏰ الوقت: ${time}`);
  const cls = classLine(ctx);
  if (cls) lines.push(cls);

  lines.push(footer(kind));
  return lines.join('\n');
}

// منع الإرسال المزدوج لنفس الحالة في نفس اليوم (داخل المتصفح)
const SENT_KEY = 'wa_sent_log_v1';
function loadSent(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); } catch { return {}; }
}
function saveSent(map: Record<string, number>) {
  try { localStorage.setItem(SENT_KEY, JSON.stringify(map)); } catch {}
}
export function makeSentKey(studentId: string, kind: NotifyKind, dateISO: string): string {
  return `${studentId}|${kind}|${dateISO}`;
}
export function wasSent(key: string): boolean {
  const map = loadSent();
  const at = map[key];
  if (!at) return false;
  // صلاحية 12 ساعة لمنع التكرار
  return Date.now() - at < 12 * 60 * 60 * 1000;
}
export function markSent(key: string) {
  const map = loadSent();
  map[key] = Date.now();
  // تنظيف الإدخالات القديمة
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const k of Object.keys(map)) if (map[k] < cutoff) delete map[k];
  saveSent(map);
}

// تحويل الحالة إلى نوع الإشعار
export function statusToKind(status: AttendanceStatus | 'permission'): NotifyKind {
  if (status === 'permission') return 'dismissal';
  if (status === 'late') return 'late';
  if (status === 'absent') return 'absent';
  return 'present';
}
