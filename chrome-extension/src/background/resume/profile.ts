export function compactProfile(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => compactProfile(item)).filter(item => item !== '' && item != null);
  }
  if (!value || typeof value !== 'object') return value;
  const data = value as Record<string, unknown>;
  if ('value' in data && ('hitCount' in data || 'lastUrl' in data)) return data.value;
  const ignored = /^(meta|id|createdAt|updatedAt|hitCount|lastUrl|avatar|.*PinnedId)$/;
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key, item]) => !ignored.test(key) && item !== '' && item != null)
      .map(([key, item]) => [key, compactProfile(item)]),
  );
}

export function parseObject(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '');
  const value = JSON.parse(cleaned);
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('模型回复不是 JSON 对象');
  return value;
}

// Merge only returned leaf updates; never replace the entire user profile with model output.
export function setProfileValue(profile: Record<string, unknown>, path: string[], value: string): void {
  if (
    !path.length ||
    path.length > 8 ||
    path.some(key => !key || ['__proto__', 'constructor', 'prototype'].includes(key))
  )
    throw new Error('无效档案路径');
  let current = profile;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (current[key] == null) current[key] = /^\d+$/.test(path[i + 1]) ? [] : {};
    if (typeof current[key] !== 'object') throw new Error('档案路径与已有字段冲突');
    current = current[key] as Record<string, unknown>;
  }
  const key = path[path.length - 1];
  if (Array.isArray(current[key])) throw new Error('档案位置指向整个列表，需要指定其中一项');
  if (current[key] != null && typeof current[key] === 'object')
    throw new Error('档案位置指向整段记录，需要指定具体字段');
  current[key] = value;
}
