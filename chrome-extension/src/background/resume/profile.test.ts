import { expect, it } from 'vitest';
import { compactProfile, parseObject, setProfileValue } from './profile';
it('removes bookkeeping but preserves facts and unconfirmed notes', () => {
  expect(
    compactProfile({
      meta: { id: '1' },
      basic: { phone: [{ value: '123', hitCount: 2 }], phonePinnedId: '1', name: '张三', empty: '' },
      custom: [{ key: '待确认', value: '生日未确认' }],
    }),
  ).toEqual({ basic: { phone: ['123'], name: '张三' }, custom: [{ key: '待确认', value: '生日未确认' }] });
});
it('updates one education without dropping other records', () => {
  const profile = {
    education: [
      { school: '甲', startDate: '2024' },
      { school: '乙', startDate: '2020' },
    ],
  };
  setProfileValue(profile, ['education', '1', 'startDate'], '2020-09');
  expect(profile.education[0].startDate).toBe('2024');
  expect(profile.education[1].startDate).toBe('2020-09');
  expect(() => setProfileValue(profile, ['__proto__', 'polluted'], 'yes')).toThrow();
});
it('parses plain JSON without tool calls', () => {
  expect(parseObject('```json\n{"fills":[]}\n```')).toEqual({ fills: [] });
});
