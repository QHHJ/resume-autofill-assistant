import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  invoke: vi.fn(),
  execute: vi.fn(),
  data: { personalResumeProfile: '' } as { personalResumeProfile: string; personalResumePrevious?: string },
}));
vi.mock('@extension/storage', () => ({
  AgentNameEnum: { Navigator: 'navigator' },
  agentModelStore: { getAgentModel: async () => ({ provider: 'test', modelName: 'test' }) },
  llmProviderStore: { getAllProviders: async () => ({ test: {} }) },
}));
vi.mock('../agent/helper', () => ({ createChatModel: () => ({ invoke: state.invoke }) }));
import { handleResume as runResume } from './service';
const handleResume = (message: { action: string; tabId?: number; text?: string }) =>
  runResume({ text: state.data.personalResumeProfile, ...message });
it('requires a file snapshot instead of falling back to the legacy stored JSON', async () => {
  await expect(runResume({ action: 'fill', tabId: 1 })).rejects.toThrow('绑定');
  expect(state.invoke).not.toHaveBeenCalled();
});
beforeEach(() => {
  state.invoke.mockReset();
  state.execute.mockReset();
  state.data = {
    personalResumeProfile: JSON.stringify({ education: [{ school: '硕士学校' }, { school: '本科学校' }] }),
  };
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => state.data, set: async (data: unknown) => Object.assign(state.data, data) } },
    tabs: { get: async () => ({ url: 'https://example.com/resume' }) },
    scripting: { executeScript: state.execute },
  });
});
it('uses one ordinary model call and executes mapped fields without a planner', async () => {
  state.execute
    .mockResolvedValueOnce([{ frameId: 0, result: { fields: [{ id: 'a', label: '学校', value: '', type: 'text' }] } }])
    .mockResolvedValueOnce([
      { frameId: 0, result: { results: [{ id: 'a', value: '本科学校', ok: true, reason: '已填入' }] } },
    ]);
  state.invoke.mockResolvedValue({ content: '{"fills":[{"id":"a","value":"本科学校"}]}' });
  const result = await handleResume({ action: 'fill', tabId: 1 });
  expect(state.invoke).toHaveBeenCalledTimes(1);
  expect(state.execute.mock.calls[1][0].args[1]).toEqual([{ id: 'a', action: 'input', value: '本科学校' }]);
  expect(result.summary).toContain('已填入 1 项');
});
it('does not remember a value with a visible field error', async () => {
  state.execute.mockResolvedValue([
    { frameId: 0, result: { fields: [{ id: 'a', value: '中国', type: 'combobox', validationError: '必填项未填写' }] } },
  ]);
  state.invoke.mockResolvedValue({ content: '{"updates":[{"id":"a","path":["basic","nationality"]}]}' });
  await handleResume({ action: 'remember', tabId: 1 });
  expect(JSON.parse(state.data.personalResumeProfile).basic).toBeUndefined();
});
it('derives control action locally and reports omitted fields', async () => {
  state.execute
    .mockResolvedValueOnce([
      {
        frameId: 0,
        result: {
          fields: [
            { id: 'a', label: '国家', value: '', allowedActions: ['select', 'skip'] },
            { id: 'b', label: '身高', value: '', allowedActions: ['input', 'skip'] },
          ],
        },
      },
    ])
    .mockResolvedValueOnce([{ frameId: 0, result: { results: [] } }]);
  state.invoke.mockResolvedValue({
    content: '{"fills":[{"id":"a","value":"中国","action":"input"},{"id":"unknown","value":"错误"}]}',
  });
  await handleResume({ action: 'fill', tabId: 1 });
  expect(state.execute.mock.calls[1][0].args[1]).toEqual([
    { id: 'a', value: '中国', action: 'select' },
    { id: 'b', value: '', action: 'skip' },
  ]);
});
it('returns actual webpage values for file save without writing local profile storage', async () => {
  state.execute.mockResolvedValue([
    { frameId: 0, result: { fields: [{ id: 'a', label: '专业', value: '用户补充专业', type: 'text' }] } },
  ]);
  state.invoke.mockResolvedValue({
    content: '{"updates":[{"id":"a","path":["education","1","major"],"value":"模型不应编造"}]}',
  });
  const result = await handleResume({ action: 'remember', tabId: 1 });
  expect(result.profile).toMatchObject({ education: [{ school: '硕士学校' }, { major: '用户补充专业' }] });
  expect(state.data.personalResumePrevious).toBeUndefined();
  expect(JSON.parse(state.data.personalResumeProfile).education[1].major).toBeUndefined();
});
it('adds new facts and saves valid leaves despite invalid whole-record mappings', async () => {
  const source = { basic: { phone: ['123'] }, education: [{ school: '旧学校' }] };
  const fields = [
    { id: 'badPhone', label: '电话', value: '456', type: 'text' },
    { id: 'badSchool', label: '学校', value: '新学校', type: 'text' },
    { id: 'height', label: '身高', value: '176', type: 'text' },
    { id: 'phone', label: '手机', value: '456', type: 'text' },
    { id: 'school', label: '学校', value: '新学校', type: 'text' },
  ];
  state.execute.mockResolvedValue([{ frameId: 0, result: { fields } }]);
  state.invoke.mockResolvedValue({
    content: JSON.stringify({
      updates: [
        { id: 'badPhone', path: ['basic', 'phone'] },
        { id: 'badSchool', path: ['education', '0'] },
        { id: 'height', path: ['basic', 'height'] },
        { id: 'phone', path: ['basic', 'phone', '0'] },
        { id: 'school', path: ['education', '0', 'school'] },
      ],
    }),
  });
  const result = await handleResume({ action: 'remember', tabId: 1, text: JSON.stringify(source) });
  expect(result.profile).toEqual({ basic: { phone: ['456'], height: '176' }, education: [{ school: '新学校' }] });
  expect(result.results).toHaveLength(2);
  expect(result.summary).toContain('已归入 3 项');
  expect(source.basic.phone).toEqual(['123']);
});
it('stops malformed output without retries or writes', async () => {
  state.execute.mockResolvedValue([{ frameId: 0, result: { fields: [{ id: 'a', value: '', type: 'text' }] } }]);
  state.invoke.mockResolvedValue({ content: 'not JSON' });
  await expect(handleResume({ action: 'fill', tabId: 1 })).rejects.toThrow();
  expect(state.invoke).toHaveBeenCalledTimes(1);
  expect(state.execute).toHaveBeenCalledTimes(1);
});
it('uses one local selection call and accepts only real option text', async () => {
  state.execute
    .mockResolvedValueOnce([
      {
        frameId: 0,
        result: {
          fields: [{ id: 'a', label: '政治面貌', type: 'combobox', allowedActions: ['select', 'skip'], value: '' }],
        },
      },
    ])
    .mockResolvedValueOnce([
      {
        frameId: 0,
        result: {
          results: [
            {
              id: 'a',
              value: '共青团员',
              ok: false,
              reason: '待匹配真实选项',
              options: ['中国共产主义青年团团员', '群众'],
            },
          ],
        },
      },
    ])
    .mockResolvedValueOnce([
      { frameId: 0, result: { results: [{ id: 'a', value: '中国共产主义青年团团员', ok: true, reason: '已选中' }] } },
    ]);
  state.invoke
    .mockResolvedValueOnce({ content: '{"fills":[{"id":"a","action":"select","value":"共青团员"}]}' })
    .mockResolvedValueOnce({
      content: '{"choices":[{"id":"a","value":"不存在的选项"},{"id":"a","value":"中国共产主义青年团团员"}]}',
    });
  const result = await handleResume({ action: 'fill', tabId: 1 });
  expect(state.invoke).toHaveBeenCalledTimes(2);
  expect(state.execute.mock.calls[2][0].args[1]).toEqual([
    { id: 'a', action: 'select', value: '中国共产主义青年团团员' },
  ]);
  expect(result.summary).toContain('已填入 1 项');
});
