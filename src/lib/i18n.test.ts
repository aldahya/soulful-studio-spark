import { describe, expect, it } from 'vitest';
import { phoneLookupCandidates } from './i18n';

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
