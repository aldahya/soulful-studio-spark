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
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('05')) return '966' + digits.slice(1);
  if (digits.startsWith('5') && digits.length === 9) return '966' + digits;
  return digits || null;
}

export function whatsAppLink(phone: string | null | undefined, message?: string): string | null {
  const num = toWhatsAppNumber(phone);
  if (!num) return null;
  const base = `https://wa.me/${num}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
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
