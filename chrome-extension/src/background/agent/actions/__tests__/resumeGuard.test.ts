import { describe, expect, it } from 'vitest';
import { isBlockedResumeClick, isBlockedResumeKey } from '../resumeGuard';

describe('personal resume action guard', () => {
  it('blocks submission, including an icon inside an accessible button', () => {
    expect(isBlockedResumeClick('button', { 'aria-label': '立即投递' }, '')).toBe(true);
    expect(isBlockedResumeClick('input', { type: 'submit', value: '继续' }, '')).toBe(true);
    expect(isBlockedResumeClick('button', {}, 'Submit application')).toBe(true);
    expect(isBlockedResumeClick('button', {}, '删除教育经历')).toBe(true);
  });
  it('allows calendar choices and dropdown options', () => {
    expect(isBlockedResumeClick('button', { type: 'button' }, '2024')).toBe(false);
    expect(isBlockedResumeClick('li', { role: 'option' }, '本科')).toBe(false);
  });
  it('blocks implicit submission but permits normal navigation', () => {
    expect(isBlockedResumeKey('Control+Enter')).toBe(true);
    expect(isBlockedResumeKey('Space')).toBe(true);
    expect(isBlockedResumeKey('Tab')).toBe(false);
    expect(isBlockedResumeKey('ArrowDown')).toBe(false);
  });
});
