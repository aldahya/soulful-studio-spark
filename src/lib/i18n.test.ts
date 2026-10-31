import { describe, expect, it } from 'vitest';
import { normalizeSaudiPhoneInput, phoneLookupCandidates } from './i18n';

describe('phoneLookupCandidates', () => {
  it('matches a local Saudi mobile with an extra leading zero', () => {
    expect(phoneLookupCandidates('00509331919')).toContain('0509331919');
  });

  it('matches local and international Saudi mobile formats', () => {
    const candidates = phoneLookupCandidates('+966 50 933 1919');
    expect(candidates).toContain('0509331919');
    expect(candidates).toContain('966509331919');
    expect(candidates).toContain('00966509331919');
  });

  it('normalizes Arabic numerals', () => {
    expect(phoneLookupCandidates('٠٥٠٩٣٣١٩١٩')).toContain('0509331919');
  });
});

describe('normalizeSaudiPhoneInput', () => {
  it('stores local Saudi mobile input with the 966 country code', () => {
    expect(normalizeSaudiPhoneInput('509331919')).toBe('966509331919');
    expect(normalizeSaudiPhoneInput('0509331919')).toBe('966509331919');
  });

  it('keeps international Saudi input in canonical 966 format', () => {
    expect(normalizeSaudiPhoneInput('966 50 933 1919')).toBe('966509331919');
    expect(normalizeSaudiPhoneInput('+966 50 933 1919')).toBe('966509331919');
    expect(normalizeSaudiPhoneInput('00966 50 933 1919')).toBe('966509331919');
  });

  it('normalizes Arabic numerals and limits canonical numbers to twelve digits', () => {
    expect(normalizeSaudiPhoneInput('٥٠٩٣٣١٩١٩')).toBe('966509331919');
    expect(normalizeSaudiPhoneInput('9665093319199')).toBe('966509331919');
  });
});
