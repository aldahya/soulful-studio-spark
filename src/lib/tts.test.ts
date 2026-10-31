import { describe, expect, it } from 'vitest';
import { buildAnnouncementText, normalizeStudentNameForSpeech } from './tts';

describe('Arabic announcement speech text', () => {
  it('normalizes spacing and common عبد ال compounds without changing the stored name', () => {
    expect(normalizeStudentNameForSpeech('  منصور عبدالرحمن   حمد البقعاوي\u200f  '))
      .toBe('منصور عبد الرحمن حمد البقعاوي');
  });

  it('uses clear vocalized phrasing for male and female announcements', () => {
    expect(buildAnnouncementText('عبدالله الخالدي', 'male'))
      .toBe('الطَّالِبُ، عبد الله الخالدي، يُرْجَى التَّوَجُّهُ إِلَى بَوَّابَةِ الْخُرُوجِ.');
    expect(buildAnnouncementText('ليان أحمد', 'female'))
      .toBe('الطَّالِبَةُ، ليان أحمد، يُرْجَى التَّوَجُّهُ إِلَى بَوَّابَةِ الْخُرُوجِ.');
  });
});
