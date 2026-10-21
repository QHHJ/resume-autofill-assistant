import { useState } from 'react';

const labels: Record<string, string> = {
  basic: '基本信息',
  name: '姓名',
  phone: '手机',
  email: '邮箱',
  gender: '性别',
  birthday: '出生日期',
  age: '年龄',
  nationality: '国籍',
  ethnicity: '民族',
  politicalStatus: '政治面貌',
  location: '所在城市',
  jobStatus: '当前状态',
  summary: '个人简介',
  socialLinks: '社交链接',
  github: 'GitHub',
  idNumber: '身份证号',
  education: '教育经历',
  school: '学校',
  degree: '学历',
  major: '专业',
  startDate: '开始时间',
  endDate: '结束时间',
  honors: '荣誉及院系',
  work: '工作经历',
  company: '工作单位',
  title: '职位',
  description: '详细介绍',
  projects: '项目经历',
  role: '担任角色',
  techStack: '技术栈',
  skills: '技能',
  languages: '编程语言',
  tools: '工具与技术',
  certificates: '证书',
  jobPreference: '求职偏好',
  positions: '意向职位',
  industries: '意向行业',
  salaryRange: '期望薪资',
  jobType: '工作性质',
  availableDate: '到岗时间',
  custom: '补充信息',
  department: '部门',
  gpa: '绩点',
  maritalStatus: '婚姻状况',
  healthStatus: '健康状况',
  workStartDate: '参加工作日期',
  currentSalary: '当前薪资',
  schoolEn: '学校英文名',
  majorEn: '专业英文名',
  nameEn: '英文名',
  companyEn: '公司英文名',
  titleEn: '职位英文名',
  link: '链接',
};
export type ProfileRow = { path: string[]; label: string; group: string; value: string; kind: string };
export function profileRows(profile: unknown): ProfileRow[] {
  const rows: ProfileRow[] = [];
  function walk(value: unknown, path: string[], group: string, label: string) {
    if (Array.isArray(value)) {
      if (value.every(v => typeof v === 'string')) {
        rows.push({ path, label, group, value: value.join('\n'), kind: 'list' });
        return;
      }
      value.forEach((item, index) => {
        const record = item as Record<string, unknown>;
        if (
          record &&
          typeof record === 'object' &&
          typeof record.key === 'string' &&
          typeof record.value === 'string'
        ) {
          rows.push({
            path: [...path, String(index), 'value'],
            label: record.key,
            group,
            value: record.value,
            kind: 'string',
          });
          return;
        }
        const title =
          path[0] === 'work'
            ? String(record?.title || '').includes('实习')
              ? '实习经历'
              : '工作经历'
            : labels[path[0]] || label;
        walk(
          item,
          [...path, String(index)],
          `${title} ${index + 1}${record?.school ? ' · ' + record.school : ''}`,
          title,
        );
      });
      return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) =>
        walk(
          item,
          [...path, key],
          path.length ? group : labels[key] || key,
          path[0] === 'work' &&
            key === 'company' &&
            String((value as Record<string, unknown>).title || '').includes('实习')
            ? '实习工作单位'
            : key === 'name' && path[0] === 'projects'
              ? '项目名称'
              : labels[key] || key,
        ),
      );
      return;
    }
    rows.push({ path, label, group, value: String(value ?? ''), kind: typeof value });
  }
  walk(profile, [], '个人信息', '个人信息');
  return rows;
}
export default function ProfileTable({
  text,
  disabled,
  onSave,
  onEditingChange,
}: {
  text: string;
  disabled: boolean;
  onSave: (path: string[], value: unknown) => Promise<void>;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  let rows: ProfileRow[] = [];
  try {
    rows = profileRows(JSON.parse(text || '{}'));
  } catch {
    return <p>JSON 格式不正确，请在原始 JSON 编辑中修正。</p>;
  }
  const filtered = rows.filter(row =>
    `${row.group} ${row.label} ${row.value}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="my-4 rounded-xl border bg-white p-3">
      <h2 className="mb-2 font-semibold">我的信息</h2>
      <p className="mb-2 text-xs text-slate-500">右侧点击内容可修改；保存后直接用于下次填写。多行条目每行一项。</p>
      <input
        aria-label="搜索个人信息"
        placeholder="搜索，如：实习、学校、电话"
        className="mb-3 w-full rounded border p-2"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <table className="w-full table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b">
            <th className="w-1/3 py-2">描述</th>
            <th>对应内容</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, index) => {
            const id = JSON.stringify(row.path);
            return (
              <tr key={id} className="border-b align-top">
                <th className="break-words py-2 pr-2 font-normal">
                  <span className="block text-xs text-slate-400">{row.group}</span>
                  {row.label}
                </th>
                <td className="break-words py-2">
                  {editing === id ? (
                    <>
                      <textarea
                        aria-label={`修改${row.label}`}
                        className="min-h-24 w-full rounded border p-2"
                        value={draft}
                        disabled={saving}
                        onChange={e => setDraft(e.target.value)}
                      />
                      <button
                        disabled={saving || disabled}
                        className="mr-3 text-blue-600"
                        onClick={async () => {
                          setSaving(true);
                          try {
                            let value: unknown = draft;
                            if (row.kind === 'list')
                              value = draft
                                .split('\n')
                                .map(v => v.trim())
                                .filter(Boolean);
                            if (row.kind === 'number') {
                              value = Number(draft);
                              if (!draft.trim() || !Number.isFinite(value)) throw new Error('请输入有效数字');
                            }
                            if (row.kind === 'boolean') {
                              if (!['true', 'false'].includes(draft)) throw new Error('请输入 true 或 false');
                              value = draft === 'true';
                            }
                            await onSave(row.path, value);
                            setEditing('');
                            onEditingChange?.(false);
                            setError('');
                          } catch (e) {
                            setError(e instanceof Error ? e.message : '保存失败');
                          } finally {
                            setSaving(false);
                          }
                        }}>
                        保存
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => {
                          setEditing('');
                          onEditingChange?.(false);
                        }}>
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={disabled}
                      aria-label={`编辑${row.label} ${index + 1}`}
                      className="w-full whitespace-pre-wrap text-left hover:text-blue-600"
                      onClick={() => {
                        setDraft(row.value);
                        setEditing(id);
                        onEditingChange?.(true);
                      }}>
                      {row.value || '点击补充'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
