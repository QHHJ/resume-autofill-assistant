// Self-contained function serialized by chrome.scripting; no imported runtime helpers.
export async function resumePage(
  operation: string,
  entries: Array<{ id: string; value: string; action?: string }> = [],
) {
  const dropdownSelector =
    '[class*=sd-Select-container-],.phoenix-select,.ant-select,.el-select,.ivu-select,.arco-select,.semi-select,.select2-container,[role=combobox],[aria-haspopup=listbox]';
  const optionSelector =
    '[class*=sd-Select-common-item-],[class*=sd-Select-scrollable-] > [class*=sd-Menu-container-],.phoenix-selectList__listItem,[role=option],.el-select-dropdown__item,.ant-select-item-option,.ant-select-dropdown-menu-item,.ivu-select-item,.arco-select-option,.semi-select-option,.select2-results__option';
  const visible = (el: HTMLElement) =>
    !!el.getClientRects().length &&
    getComputedStyle(el).visibility !== 'hidden' &&
    !el.closest('[hidden],[aria-hidden=true]');
  const normalized = (text: string) => text.replace(/\s+/g, '').trim();
  const dropdownRoot = (el: HTMLElement) => el.closest<HTMLElement>(dropdownSelector);
  const groupOf = (el: HTMLElement) =>
    el.closest<HTMLElement>(
      '[class*=apply-field-],.form-item,.el-form-item,.ant-form-item,.form-group,[role=group],fieldset',
    );
  const errorOf = (el: HTMLElement) =>
    Array.from(
      (groupOf(el) || el).querySelectorAll<HTMLElement>(
        '[role=alert],[class*=sd-Input-message-],.ant-form-item-explain-error,.el-form-item__error',
      ),
    )
      .filter(visible)
      .map(node => node.textContent?.trim())
      .filter(Boolean)
      .join(' ');
  const writeInput = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const settle = async (el: HTMLElement) => {
    (el.querySelector('input') || el).blur();
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
  };
  const actionOf = (el: HTMLElement) => {
    const input = el as HTMLInputElement;
    if (
      el.closest('[class*=sd-DatePicker],[class*=sd-Cascader],[class*=sd-MultiSelect]') ||
      el.closest('.month-range-select,[class*=location_info-],[class*=day_info-]') ||
      (input.readOnly && !dropdownRoot(el)) ||
      ['radio', 'checkbox'].includes(input.type)
    )
      return 'unsupported';
    if (el.matches('.phoenix-select') && el.querySelector('[id*=date_time_picker]')) return 'date';
    if (el instanceof HTMLSelectElement || dropdownRoot(el)) return 'select';
    if (
      ['date', 'month', 'datetime-local', 'time'].includes(input.type) ||
      /date|日期/.test(`${input.placeholder || ''} ${el.className}`)
    )
      return 'date';
    return 'input';
  };
  const selector =
    'input:not([type=hidden]):not([type=password]):not([type=file]):not([type=submit]):not([type=button]):not([type=reset]),textarea,select,[contenteditable=true],' +
    dropdownSelector;
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
    el =>
      visible(el) &&
      !(el as HTMLInputElement).disabled &&
      el.getAttribute('aria-disabled') !== 'true' &&
      !el.closest('nav,[role=search],.constant-main-selector-container,.area-selector-container') &&
      !/搜索职位|职位关键字/.test(`${el.getAttribute('title') || ''} ${(el as HTMLInputElement).placeholder || ''}`) &&
      !el.parentElement?.closest(dropdownSelector),
  );
  const registry = ((window as Window & { __resumeElements?: Map<string, HTMLElement> }).__resumeElements ||=
    new Map<string, HTMLElement>());
  const valueOf = (el: HTMLElement) => {
    const input = el as HTMLInputElement;
    if (input.type === 'radio' || input.type === 'checkbox') return input.checked ? 'true' : '';
    if (el instanceof HTMLSelectElement) return el.selectedOptions[0]?.textContent?.trim() || '';
    const root = dropdownRoot(el);
    if (root) {
      if (root.matches('[class*=sd-Select-container-]'))
        return root.querySelector('[class*=sd-Input-display-value-]')?.textContent?.trim() || '';
      if (root.matches('.phoenix-select')) {
        const committed = root.querySelector<HTMLElement>('.phoenix-select__tipEle');
        return committed?.textContent?.trim() || '';
      }
      const selected = root.querySelector<HTMLElement>(
        '.ant-select-selection-item,.ant-select-selection-selected-value,.el-select__selected-item:not(.el-select__placeholder),.ivu-select-selected-value,.arco-select-view-value,.semi-select-selection-text,.select2-selection__rendered',
      );
      if (selected) return selected.textContent?.trim() || '';
      const inner = root.querySelector<HTMLInputElement>('input');
      // A searchable input contains a query, not a committed selection.
      if (inner?.readOnly) return inner.value;
      if (root.querySelector('[class*=placeholder]')) return '';
      if (root === el && !(el instanceof HTMLInputElement)) {
        const copy = root.cloneNode(true) as HTMLElement;
        copy
          .querySelectorAll('[role=listbox],ul,input,[class*=dropdown],[class*=arrow]')
          .forEach(node => node.remove());
        return copy.textContent?.trim() || '';
      }
      return ''; // An editable combobox input may contain only an uncommitted query.
    }
    return input.value ?? el.textContent?.trim() ?? '';
  };
  const fields = elements.map(el => {
    let id = el.dataset.resumeField;
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join('-');
      el.dataset.resumeField = id;
    }
    registry.set(id, el);
    const input = el as HTMLInputElement;
    const group = groupOf(el);
    const explicit = Array.from(input.labels || [])
      .map(label => {
        const copy = label.cloneNode(true) as HTMLElement;
        copy
          .querySelectorAll(
            'input,select,textarea,[class*=display-value],[class*=message-],[role=alert],[class*=addon]',
          )
          .forEach(control => control.remove());
        return copy.textContent?.trim();
      })
      .join(' ');
    const section = el.closest('fieldset,section,.education-item,.work-item,[data-nav-id]');
    const groupLabel = group?.querySelector<HTMLElement>(
      ':scope > [class^=title-],.form-item__text,[class*=form-item-label],[class*=field-label]',
    );
    const labelSource = groupLabel;
    const labelCopy = labelSource?.cloneNode(true) as HTMLElement | undefined;
    labelCopy
      ?.querySelectorAll(
        'input,select,textarea,[role=combobox],[contenteditable=true],[class*=selected],[class*=placeholder],[class*=selection]',
      )
      .forEach(node => node.remove());
    return {
      id,
      label:
        labelCopy?.textContent?.trim().slice(0, 180) ||
        explicit ||
        (el.getAttribute('aria-labelledby') || '')
          .split(/\s+/)
          .map(id => document.getElementById(id)?.textContent || '')
          .join(' ')
          .trim() ||
        el.getAttribute('aria-label') ||
        input.placeholder ||
        input.name,
      context:
        `${section?.querySelector('legend,[class*=blockTitle-],h2,h3')?.textContent || ''} ${(el.closest('[class*=apply-fields-]') || section || group?.parentElement)?.textContent || ''}`
          .trim()
          .slice(0, 1600),
      name: input.name,
      type: dropdownRoot(el) ? 'combobox' : input.type || el.getAttribute('role') || el.tagName,
      allowedActions: [actionOf(el), 'skip'],
      readOnly: !!input.readOnly || (el.matches('.phoenix-select') && actionOf(el) === 'date'),
      placeholder: input.placeholder || '',
      format:
        input.type === 'month'
          ? 'YYYY-MM'
          : input.type === 'date'
            ? 'YYYY-MM-DD'
            : el.getAttribute('data-date-format') || input.placeholder || '',
      value: valueOf(el),
      validationError: errorOf(el),
      searchable: !!dropdownRoot(el)?.querySelector('input:not([readonly])'),
      options:
        el instanceof HTMLSelectElement
          ? Array.from(el.options)
              .filter(o => !o.disabled)
              .map(o => o.text)
          : Array.from(el.querySelectorAll<HTMLElement>(optionSelector))
              .filter(o => o.getAttribute('aria-disabled') !== 'true')
              .map(o => o.textContent?.trim() || '')
              .filter(Boolean),
      choice: ['radio', 'checkbox'].includes(input.type) ? input.value : undefined,
    };
  });
  if (operation === 'read') return { url: location.href, title: document.title, fields, results: [] };
  const results: Array<{ id: string; value: string; ok: boolean; reason: string; options?: string[] }> = [];
  for (const entry of entries) {
    const el = registry.get(entry.id);
    if (!el?.isConnected) {
      results.push({ ...entry, ok: false, reason: '字段已变化' });
      continue;
    }
    const input = el as HTMLInputElement;
    const existing = valueOf(el);
    if (existing && !/^(请选择|请选择.*|please select|select.*)$/i.test(existing)) {
      results.push({ ...entry, ok: false, reason: '保留已有内容' });
      continue;
    }
    if (actionOf(el) === 'unsupported') {
      results.push({ ...entry, ok: false, reason: '该控件暂需手动填写' });
      continue;
    }
    if (entry.action === 'skip') {
      results.push({ ...entry, ok: false, reason: '模型未给出填写方案，本次跳过' });
      continue;
    }
    if (entry.action && entry.action !== actionOf(el)) {
      results.push({ ...entry, ok: false, reason: '操作类型与实际控件不符' });
      continue;
    }
    try {
      if (el instanceof HTMLSelectElement) {
        const option = Array.from(el.options).find(
          o => !o.disabled && (o.text.trim() === entry.value || o.value === entry.value),
        );
        if (!option) {
          results.push({
            ...entry,
            ok: false,
            reason: '待匹配真实选项',
            options: Array.from(el.options)
              .filter(o => !o.disabled)
              .map(o => o.text),
          });
          continue;
        }
        el.value = option.value;
      } else if (actionOf(el) === 'date' && (input.readOnly || el.matches('.phoenix-select'))) {
        throw new Error('只读日期选择器需手动选择');
      } else if (input.readOnly || dropdownRoot(el)) {
        const root = dropdownRoot(el) || el;
        const trigger = root.matches('.phoenix-select')
          ? root
          : root.querySelector<HTMLElement>(
              '.ant-select-selector,.ant-select-selection,.ivu-select-selection,.el-select__wrapper,.select2-selection,input',
            ) || root;
        const before = new Set(Array.from(document.querySelectorAll<HTMLElement>(optionSelector)).filter(visible));
        const localOwner = root.closest('[class*=sd-Dropdown-container-]');
        const openMenu = localOwner?.querySelector<HTMLElement>('[class*=sd-Dropdown-dropdown-]');
        const alreadyOpen =
          (openMenu && visible(openMenu)) ||
          root.classList.contains('phoenix-select--active') ||
          trigger.getAttribute('aria-expanded') === 'true';
        if (!alreadyOpen) {
          trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
          trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, relatedTarget: document.body }));
          trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          trigger.click();
        }
        const search = root.querySelector<HTMLInputElement>('input:not([readonly])');
        await new Promise(resolve => setTimeout(resolve, 200));
        // Phoenix's dictionary/area picker commits only after its own confirmation button.
        const pickers = Array.from(
          document.querySelectorAll<HTMLElement>('.constant-main-selector-container,.area-selector-container'),
        ).filter(visible);
        if (root.matches('.phoenix-select') && pickers.length === 1) {
          const picker = pickers[0];
          const footerButton = (text: string) =>
            Array.from(picker.querySelectorAll<HTMLElement>('.phoenix-button__content')).find(
              node => node.textContent?.trim() === text,
            );
          const choices = () =>
            Array.from(picker.querySelectorAll<HTMLElement>('.list-item-container,.area-item-container')).filter(
              visible,
            );
          const choiceText = (node: HTMLElement) =>
            node.querySelector('.item-text-label,.area-text-label')?.textContent?.trim() || '';
          let options = choices();
          const originalOptions = options.map(choiceText).filter(Boolean);
          let matches = options.filter(node => normalized(choiceText(node)) === normalized(entry.value));
          // Search the popup, never the trigger's display input. This also exposes virtualized options.
          if (!matches.length) {
            const popupSearch = picker.querySelector<HTMLInputElement>('input[placeholder="搜索"]');
            if (popupSearch) {
              writeInput(popupSearch, entry.value);
              await new Promise(resolve => setTimeout(resolve, 500));
              options = choices();
              matches = options.filter(node => normalized(choiceText(node)) === normalized(entry.value));
            }
          }
          if (matches.length !== 1) {
            const texts = [...new Set([...originalOptions, ...options.map(choiceText)].filter(Boolean))];
            footerButton('取消')?.click();
            results.push({
              ...entry,
              ok: false,
              reason: matches.length > 1 ? '存在多个同名地区，请手动选择' : '待匹配真实选项',
              options: matches.length > 1 ? undefined : texts,
            });
            continue;
          }
          // The actual radio handler lives on the icon, not on the surrounding option row.
          const radio = matches[0].querySelector('.icon-container svg');
          if (!radio) {
            footerButton('取消')?.click();
            throw new Error('该地区仍需逐级展开，请手动选择');
          }
          radio.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 200));
          const selected = Array.from(picker.querySelectorAll('.select-text-label,.select-area-text-label'));
          if (selected.length !== 1 || normalized(selected[0].textContent || '') !== normalized(entry.value)) {
            footerButton('取消')?.click();
            throw new Error('弹层未确认选中目标值，请手动检查');
          }
          const confirm = footerButton('确定');
          if (!confirm) throw new Error('未找到弹层确定按钮');
          confirm.click();
          await settle(el);
          const actual = valueOf(el);
          const ok = el.isConnected && normalized(actual) === normalized(entry.value) && !errorOf(el);
          results.push({ ...entry, ok, reason: ok ? '已选中并确认' : '弹层选择未写回表单，请手动检查' });
          continue;
        }
        const available = Array.from(document.querySelectorAll<HTMLElement>(optionSelector)).filter(
          option =>
            visible(option) &&
            (localOwner ? localOwner.contains(option) : root.contains(option) || !before.has(option)),
        );
        // Read existing choices first: searching “三年制” can hide the valid option “3年”.
        if (search && !available.length) {
          search.focus();
          writeInput(search, entry.value);
          // Search queries are never treated as committed selections.
          await new Promise(resolve => setTimeout(resolve, 400));
        }
        let options: HTMLElement[] = [];
        // Wait for the dropdown's opening animation/data, without replanning or retrying the task.
        const deadline = Date.now() + 1200;
        do {
          await new Promise(resolve => setTimeout(resolve, 100));
          const ownerIds = [root, trigger, root.querySelector('input')]
            .filter(Boolean)
            .flatMap(node =>
              `${node!.getAttribute('aria-controls') || ''} ${node!.getAttribute('aria-owns') || ''}`
                .trim()
                .split(/\s+/),
            )
            .filter(Boolean);
          const mokaOwner = root.closest('[class*=sd-Dropdown-container-]');
          const owners = mokaOwner ? [mokaOwner] : ownerIds.map(id => document.getElementById(id)).filter(Boolean);
          options = Array.from(document.querySelectorAll<HTMLElement>(optionSelector)).filter(
            option =>
              visible(option) &&
              option.getAttribute('aria-disabled') !== 'true' &&
              !option.matches('[disabled],.is-disabled,[class*=option-disabled],[class*=item-disabled]') &&
              (owners.length
                ? owners.some(owner => owner!.contains(option))
                : root.contains(option) || !before.has(option)),
          );
        } while (!options.length && Date.now() < deadline);
        const matches = options.filter(option => normalized(option.textContent || '') === normalized(entry.value));
        if (matches.length !== 1) {
          trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
          if (options.length && !matches.length) {
            results.push({
              ...entry,
              ok: false,
              reason: '待匹配真实选项',
              options: options.map(o => o.textContent?.trim() || '').filter(Boolean),
            });
            continue;
          }
          throw new Error(
            !options.length
              ? '未识别到该下拉框的选项'
              : matches.length > 1
                ? '存在多个同名选项，请手动选择'
                : `没有“${entry.value}”选项，可选：${options
                    .slice(0, 8)
                    .map(o => o.textContent?.trim())
                    .join('、')}`,
          );
        }
        matches[0].scrollIntoView({ block: 'nearest' });
        const optionTarget = matches[0].querySelector<HTMLElement>('[class*=sd-Menu-container-]') || matches[0];
        optionTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        optionTarget.click();
        await settle(el);
        const actual = valueOf(el);
        const ok = el.isConnected && normalized(actual) === normalized(entry.value) && !errorOf(el);
        results.push({
          ...entry,
          ok,
          reason: ok
            ? '已选中'
            : `待检查：当前显示“${actual || '空'}”${errorOf(el) ? `，${errorOf(el)}` : '，未能确认选中状态'}`,
        });
        continue;
      } else if (el.isContentEditable) el.textContent = entry.value;
      else {
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement))
          throw new Error('该控件不是文本输入框，需手动处理');
        const prototype =
          el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(el, entry.value);
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      await settle(el);
      const actual = valueOf(el);
      const ok = el.isConnected && actual === entry.value && !errorOf(el);
      results.push({
        ...entry,
        ok,
        reason: ok ? '已填入' : '填写未通过核验，请手动检查',
      });
    } catch (error) {
      results.push({ ...entry, ok: false, reason: error instanceof Error ? error.message : '填写失败' });
    }
  }
  return { url: location.href, title: document.title, fields, results };
}
