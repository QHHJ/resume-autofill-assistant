import { useEffect, useState } from 'react';
import ProfileTable from './components/ProfileTable';
import { chooseProfile, parseProfile, readProfile, storedHandle, writeProfile } from './profileFile';
import type { ProfileFile } from './profileFile';

export default function ResumeApp() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('选择并绑定个人 JSON 文件，然后填写当前页面');
  const [results, setResults] = useState<Array<{ id: string; label: string; reason: string; ok: boolean }>>([]);
  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState<ProfileFile>();
  const [draft, setDraft] = useState('');
  const [base, setBase] = useState('');
  const [legacy, setLegacy] = useState(false);
  const [rowEditing, setRowEditing] = useState(false);
  useEffect(() => {
    storedHandle()
      .then(async file => {
        if (file) {
          setHandle(file);
          setText(await readProfile(file));
          setStatus('已读取绑定文件');
        } else setStatus('请先选择并绑定个人 JSON 文件');
      })
      .catch(error => setStatus(error.message));
    chrome.storage.local.get('personalResumeProfile').then(data => setLegacy(!!data.personalResumeProfile));
  }, []);
  useEffect(() => {
    if (!handle || busy || editing || rowEditing) return;
    const reload = () => {
      readProfile(handle)
        .then(setText)
        .catch(error => setStatus(error.message));
    };
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, [handle, busy, editing, rowEditing]);
  async function task(run: () => Promise<void>) {
    setBusy(true);
    try {
      await run();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    if (!handle) throw new Error('请先绑定文件');
    setText(await readProfile(handle));
    setStatus('已从文件重新读取；未保存的编辑草稿保持不变');
  }
  async function saveField(path: string[], value: unknown) {
    if (!handle) throw new Error('请先绑定文件');
    const profile = parseProfile(text);
    let target = profile;
    for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
    target[path[path.length - 1]] = value;
    const updated = JSON.stringify(profile, null, 2);
    setBusy(true);
    try {
      setText(await writeProfile(handle, text, updated));
      setStatus('已保存到绑定的 JSON 文件');
    } finally {
      setBusy(false);
    }
  }
  async function execute(action: string) {
    setBusy(true);
    setStatus(
      action === 'fill'
        ? '读取控件 → 匹配内容与操作 → 填写（必要时匹配下拉选项）…'
        : action === 'remember'
          ? '读取本页最终值并归入档案…'
          : '精简档案…',
    );
    setResults([]);
    try {
      if (!handle) throw new Error('请先绑定文件');
      const source = await readProfile(handle);
      setText(source);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.runtime.sendMessage({
        type: 'resume_direct',
        action,
        tabId: tab?.id,
        text: JSON.stringify(parseProfile(source)),
      });
      if (!response?.ok) throw new Error(response?.error || '扩展未响应，请重新加载');
      if (action === 'remember') {
        setText(await writeProfile(handle, source, JSON.stringify(response.profile)));
      }
      setStatus(response.summary + (action === 'remember' ? '，已写入绑定文件' : ''));
      setResults(response.results || []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  async function downloadLegacy() {
    try {
      const stored = await chrome.storage.local.get('personalResumeProfile');
      const json = JSON.stringify(parseProfile(stored.personalResumeProfile || '{}'), null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = '个人信息-迁移.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('已导出旧档案，请绑定刚导出的迁移文件。原存储保留但不再用于填写');
    } catch {
      setStatus('JSON 格式不正确，请先修正');
    }
  }
  const button = 'rounded-lg border px-3 py-2 disabled:opacity-40';
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-sm text-slate-800">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-bold">简历填写</h1>
        <button onClick={() => chrome.runtime.openOptionsPage()} className="text-blue-600">
          模型设置
        </button>
      </header>
      <p className="mb-4 text-slate-500">读取表单，一次匹配，直接填写。最后由你检查。</p>
      <section className="mb-4 space-y-2 rounded-xl border bg-white p-3">
        <p>档案文件：{handle?.name || '尚未绑定'}</p>
        <button
          className={button}
          disabled={busy || editing || rowEditing}
          onClick={() =>
            task(async () => {
              const file = await chooseProfile();
              setHandle(file);
              setText(await readProfile(file));
              setStatus('已绑定，后续保存直接写回这个文件');
            })
          }>
          选择并绑定 JSON
        </button>
        {handle && (
          <>
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                task(async () => {
                  if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted')
                    throw new Error('未获得文件读写权限');
                  if (!editing && !rowEditing) await refresh();
                  else setStatus('已重新授权，编辑草稿保持不变');
                })
              }>
              重新授权
            </button>
            <button className={button} disabled={busy || rowEditing} onClick={() => task(refresh)}>
              重新读取文件
            </button>
          </>
        )}
        {legacy && (
          <button className={button} disabled={busy} onClick={downloadLegacy}>
            导出旧档案用于迁移
          </button>
        )}
      </section>
      <div className="grid gap-3">
        <button
          className={`${button} bg-blue-600 text-white`}
          disabled={busy || editing || rowEditing || !handle || !text || text === '{}'}
          onClick={() => execute('fill')}>
          填写当前页面
        </button>
        <button
          className={`${button} bg-white`}
          disabled={busy || editing || rowEditing || !handle}
          onClick={() => execute('remember')}>
          已检查，记住本页补充
        </button>
      </div>
      <p className="my-3 text-xs text-slate-500">
        “记住”会将本页有值的字段归入档案。请先检查自动填写并完成手动补充，再点击。
      </p>
      <div role="status" className="my-4 rounded-lg bg-blue-50 p-3">
        {status}
      </div>
      {results.length > 0 && (
        <ul className="mb-4 space-y-2">
          {results.map(r => (
            <li key={r.id} className={r.ok ? 'text-green-700' : 'text-amber-700'}>
              {r.label}：{r.reason}
            </li>
          ))}
        </ul>
      )}
      <ProfileTable
        text={text}
        disabled={busy || editing || !handle}
        onSave={saveField}
        onEditingChange={setRowEditing}
      />
      <section className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy || rowEditing || !handle}
            onClick={() =>
              task(async () => {
                if (editing) {
                  setEditing(false);
                  return;
                }
                const source = await readProfile(handle!);
                setText(source);
                setBase(source);
                setDraft(source);
                setEditing(true);
              })
            }>
            {editing ? '取消编辑' : '编辑原始 JSON'}
          </button>
        </div>
        {editing && (
          <>
            <textarea
              aria-label="个人信息 JSON"
              className="my-3 h-80 w-full border p-2 font-mono text-xs"
              disabled={busy}
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                task(async () => {
                  setText(await writeProfile(handle!, base, draft));
                  setEditing(false);
                  setStatus('已保存到绑定的 JSON 文件');
                })
              }>
              保存到原文件
            </button>
          </>
        )}
      </section>
      <p className="mt-4 text-xs text-slate-500">
        填写和记住会将档案、表单字段发送给设置中的 Navigator。个人档案仅以绑定的 JSON 文件为准。外部修改后请重新读取。
      </p>
    </main>
  );
}
