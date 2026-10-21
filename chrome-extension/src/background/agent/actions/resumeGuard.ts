// Conservative personal-fork guard. This is not a guarantee against site autosave.
export function isBlockedResumeClick(
  tagName: string | null,
  attributes: Record<string, string>,
  text: string,
): boolean {
  const label = [text, attributes['aria-label'], attributes.title, attributes.value].filter(Boolean).join(' ');
  if (
    /(提交|投递|申请职位|立即申请|确认申请|保存简历|删除|注销|支付|submit|apply\s*(now|for|to)|send\s*application|delete|checkout)/i.test(
      label,
    )
  )
    return true;
  return (
    attributes.type?.toLowerCase() === 'submit' || (tagName?.toLowerCase() === 'input' && attributes.type === 'image')
  );
}

export function isBlockedResumeKey(keys: string): boolean {
  return /enter|return|space/i.test(keys) || keys === ' ';
}
