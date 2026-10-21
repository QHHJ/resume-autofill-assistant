export type ProfileFile = FileSystemFileHandle & {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
};

export function parseProfile(text: string): Record<string, unknown> {
  const value = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('档案必须是 JSON 对象');
  return value;
}

// Only the file handle is persisted. Profile contents live in the user's file.
export async function storedHandle(handle?: ProfileFile): Promise<ProfileFile | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('resume-file', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('handles');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', handle ? 'readwrite' : 'readonly');
      const store = tx.objectStore('handles');
      const request = handle ? store.put(handle, 'profile') : store.get('profile');
      tx.oncomplete = () => resolve(handle || request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function readProfile(handle: ProfileFile): Promise<string> {
  if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted')
    throw new Error('文件权限已失效，请点击“重新授权”');
  const text = await (await handle.getFile()).text();
  parseProfile(text);
  return text;
}

export async function writeProfile(handle: ProfileFile, expected: string, next: string): Promise<string> {
  const output = JSON.stringify(parseProfile(next), null, 2);
  // Serialize extension writes; also reject changes made externally since editing began.
  return navigator.locks.request('resume-profile-write', async () => {
    if ((await readProfile(handle)) !== expected)
      throw new Error('文件已被其他操作修改，请重新读取后再保存；你的草稿仍保留');
    const writer = await handle.createWritable();
    try {
      await writer.write(output);
      await writer.close();
    } catch (error) {
      await writer.abort().catch(() => {});
      throw error;
    }
    const saved = await readProfile(handle);
    if (saved !== output) throw new Error('写入后校验不一致，请重新读取文件');
    return saved;
  });
}

export async function chooseProfile(): Promise<ProfileFile> {
  const picker = window as unknown as { showOpenFilePicker(options: unknown): Promise<ProfileFile[]> };
  const [handle] = await picker.showOpenFilePicker({
    multiple: false,
    types: [{ description: '个人档案 JSON', accept: { 'application/json': ['.json'] } }],
  });
  if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted')
    throw new Error('需要授权读写这份 JSON 文件');
  await readProfile(handle);
  await storedHandle(handle);
  return handle;
}
