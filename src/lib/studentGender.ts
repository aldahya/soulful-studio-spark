export type StudentGender = 'male' | 'female';

export function parseStudentGender(value: unknown): StudentGender | null {
  const normalized = String(value ?? '').trim().toLocaleLowerCase('ar');
  if (['male', 'm', 'ذكر', 'طالب', 'بنين'].includes(normalized)) return 'male';
  if (['female', 'f', 'أنثى', 'انثى', 'طالبة', 'بنات'].includes(normalized)) return 'female';
  return null;
}

export function defaultStudentGenderForSchool(slug?: string | null): StudentGender | null {
  if (slug === 'dahya-boys') return 'male';
  if (slug === 'dahya-girls') return 'female';
  return null;
}

export function studentGenderLabel(gender: StudentGender | null | undefined): string {
  if (gender === 'male') return 'ذكر';
  if (gender === 'female') return 'أنثى';
  return '';
}
