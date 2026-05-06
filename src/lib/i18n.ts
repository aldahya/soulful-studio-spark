export const STAGE_LABELS = {
  primary: 'ابتدائي',
  intermediate: 'متوسط',
  secondary: 'ثانوي',
} as const;

export const STATUS_LABELS = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
} as const;

export const ROLE_LABELS = {
  admin: 'إداري',
  teacher: 'معلم',
} as const;

export type Stage = keyof typeof STAGE_LABELS;
export type AttendanceStatus = keyof typeof STATUS_LABELS;
export type AppRole = keyof typeof ROLE_LABELS;

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-success/10 text-success border-success/20',
  late: 'bg-warning/10 text-warning border-warning/20',
  absent: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function toWhatsAppNumber(phone?: string | null): string | null {
  if (!phone) return null;
  // remove everything except digits (drops +, spaces, dashes, parentheses, RTL marks…)
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  // strip international prefix "00"
  if (digits.startsWith('00')) digits = digits.slice(2);
  // already in international form
  if (digits.startsWith('966')) {
    const rest = digits.slice(3).replace(/^0+/, '');
    return '966' + rest;
  }
  // local Saudi format 05xxxxxxxx
  if (digits.startsWith('05') && digits.length === 10) return '966' + digits.slice(1);
  // bare 9-digit mobile starting with 5
  if (digits.startsWith('5') && digits.length === 9) return '966' + digits;
  // strip any leading zeros for other countries
  digits = digits.replace(/^0+/, '');
  return digits || null;
}

export function whatsAppLink(phone: string | null | undefined, message?: string): string | null {
  const num = toWhatsAppNumber(phone);
  // E.164 sanity check: 8–15 digits, no leading zero
  if (!num || !/^[1-9]\d{7,14}$/.test(num)) return null;
  const base = `https://wa.me/${num}`;
  if (!message) return base;
  // Sanitize: NFC normalize and strip the Unicode replacement char (U+FFFD) which
  // breaks WhatsApp's parser and shows a blank page.
  const clean = message.normalize('NFC').replace(/\uFFFD/g, '').slice(0, 3500);
  return `${base}?text=${encodeURIComponent(clean)}`;
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
