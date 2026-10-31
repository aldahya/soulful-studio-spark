import { describe, expect, it } from 'vitest';
import {
  defaultStudentGenderForSchool,
  parseStudentGender,
  studentGenderLabel,
} from './studentGender';

describe('student gender helpers', () => {
  it('accepts Arabic and English gender values', () => {
    expect(parseStudentGender('ذكر')).toBe('male');
    expect(parseStudentGender('طالب')).toBe('male');
    expect(parseStudentGender('female')).toBe('female');
    expect(parseStudentGender('أنثى')).toBe('female');
  });

  it('does not guess gender for mixed or unknown values', () => {
    expect(parseStudentGender('')).toBeNull();
    expect(parseStudentGender('اسم غير واضح')).toBeNull();
    expect(defaultStudentGenderForSchool('ajyal')).toBeNull();
    expect(defaultStudentGenderForSchool('dahya-girls')).toBe('female');
  });

  it('returns Arabic labels for exports', () => {
    expect(studentGenderLabel('male')).toBe('ذكر');
    expect(studentGenderLabel('female')).toBe('أنثى');
  });
});
