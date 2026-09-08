import { BOARD_SPACES } from './boardData.js';
import { appState } from './state.js';
import { els, showToast } from './elements.js';
import { getHttpApiUrl } from './network.js';

export async function fetchThemes() {
  try {
    const res = await fetch(getHttpApiUrl('/api/themes'));
    appState.themesData = await res.json();
  } catch (err) {
    console.error('Failed to load themes:', err);
  }
}

export async function loadRulesCustomizer() {
  try {
    const res = await fetch(getHttpApiUrl('/api/rules/meta'));
    const { metadata, defaults } = await res.json();
    const list = document.getElementById('rules-customizer-list');
    if (!list) return;
    list.innerHTML = '';

    metadata.forEach(rule => {
      const item = document.createElement('div');
      item.className = 'rule-item';

      const header = document.createElement('div');
      header.className = 'rule-header';

      const title = document.createElement('span');
      title.className = 'rule-title';
      title.innerText = rule.label;
      header.appendChild(title);

      if (rule.type === 'boolean') {
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.id = `rule-${rule.key}`;
        toggle.checked = defaults[rule.key];
        toggle.style.transform = 'scale(1.3)';
        header.appendChild(toggle);
      } else if (rule.type === 'number') {
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `rule-${rule.key}`;
        input.value = defaults[rule.key];
        input.min = rule.min;
        input.max = rule.max;
        input.step = rule.step;
        input.className = 'form-control';
        input.style.width = '80px';
        input.style.padding = '4px 8px';
        header.appendChild(input);
      } else if (rule.type === 'select') {
        const sel = document.createElement('select');
        sel.id = `rule-${rule.key}`;
        sel.className = 'form-control';
        sel.style.width = '210px';
        sel.style.padding = '4px 8px';
        sel.style.fontSize = '0.85rem';
        rule.options.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.value;
          o.innerText = opt.label;
          if (opt.value === defaults[rule.key]) o.selected = true;
          sel.appendChild(o);
        });
        header.appendChild(sel);
      }

      item.appendChild(header);

      const desc = document.createElement('div');
      desc.className = 'rule-desc';
      desc.innerText = rule.desc;
      item.appendChild(desc);

      list.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load rules metadata:', err);
  }
}

export function getFormRules() {
  const rules = {};
  const checkboxes = document.querySelectorAll('#rules-customizer-list input[type="checkbox"]');
  checkboxes.forEach(cb => {
    const key = cb.id.replace('rule-', '');
    rules[key] = cb.checked;
  });

  const numbers = document.querySelectorAll('#rules-customizer-list input[type="number"]');
  numbers.forEach(num => {
    const key = num.id.replace('rule-', '');
    rules[key] = Number(num.value);
  });

  const selects = document.querySelectorAll('#rules-customizer-list select');
  selects.forEach(sel => {
    const key = sel.id.replace('rule-', '');
    rules[key] = sel.value;
  });

  if (Object.keys(appState.customSpaceNames).length > 0) {
    rules.customSpaceNames = { ...appState.customSpaceNames };
  }
  return rules;
}

export function openStreetCustomizer() {
  renderStreetCustomizerInputs();
  const modal = els.modalStreetCustomizer || document.getElementById('modal-street-customizer');
  if (modal) {
    modal.classList.add('open');
  }
}

export function closeStreetCustomizer() {
  const modal = els.modalStreetCustomizer || document.getElementById('modal-street-customizer');
  if (modal) {
    modal.classList.remove('open');
  }
}

export function resetStreetCustomizer() {
  appState.customSpaceNames = {};
  renderStreetCustomizerInputs();
  showToast('Reset to standard street names.', 'info');
}

export function saveCustomStreets() {
  const list = els.customStreetsList || document.getElementById('custom-streets-list');
  const modal = els.modalStreetCustomizer || document.getElementById('modal-street-customizer');
  if (list) {
    const inputs = list.querySelectorAll('input[data-space-id]');
    appState.customSpaceNames = {};
    inputs.forEach(inp => {
      const id = Number(inp.dataset.spaceId);
      const val = inp.value.trim();
      if (val && val !== BOARD_SPACES[id].name) {
        appState.customSpaceNames[id] = val;
      }
    });
  }
  if (modal) modal.classList.remove('open');
  showToast('Neighborhood street names applied! Create room to play.', 'success');
}

export async function applyPresetToInputs(presetKey) {
  if (!appState.themesData) {
    await fetchThemes();
  }
  const preset = appState.themesData?.neighborhoodPresets?.[presetKey];
  if (!preset) return;
  const list = els.customStreetsList || document.getElementById('custom-streets-list');
  if (!list) return;
  for (const [idStr, name] of Object.entries(preset.spaces)) {
    const inp = list.querySelector(`input[data-space-id="${idStr}"]`);
    if (inp) inp.value = name;
  }
  showToast(`Loaded ${preset.label} preset names.`, 'info');
}

export function renderStreetCustomizerInputs() {
  const list = els.customStreetsList || document.getElementById('custom-streets-list');
  if (!list) return;
  list.innerHTML = '';
  BOARD_SPACES.forEach(space => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.style.background = 'rgba(0,0,0,0.2)';
    row.style.padding = '6px 8px';
    row.style.borderRadius = '4px';

    const label = document.createElement('span');
    label.style.fontSize = '0.8rem';
    label.style.width = '35px';
    label.style.color = 'var(--text-muted)';
    label.innerText = `#${space.id}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control';
    input.style.fontSize = '0.82rem';
    input.style.padding = '4px 6px';
    input.dataset.spaceId = space.id;
    input.value = appState.customSpaceNames[space.id] || space.name;

    row.appendChild(label);
    row.appendChild(input);
    list.appendChild(row);
  });
}

export function initStreetCustomizer() {
  renderStreetCustomizerInputs();

  const btnOpen = els.btnOpenStreetCustomizer || document.getElementById('btn-open-street-customizer');
  const btnClose = els.btnCloseCustomizer || document.getElementById('btn-close-customizer');
  const btnPresetHometown = els.btnPresetHometown || document.getElementById('btn-preset-hometown');
  const btnPresetBeach = els.btnPresetBeach || document.getElementById('btn-preset-beach');
  const btnPresetMetro = els.btnPresetMetro || document.getElementById('btn-preset-metro');
  const btnReset = els.btnResetStreets || document.getElementById('btn-reset-streets');
  const btnSave = els.btnSaveCustomStreets || document.getElementById('btn-save-custom-streets');

  if (btnOpen) {
    btnOpen.onclick = (e) => {
      if (e) e.preventDefault();
      openStreetCustomizer();
    };
  }

  if (btnClose) {
    btnClose.onclick = (e) => {
      if (e) e.preventDefault();
      closeStreetCustomizer();
    };
  }

  if (btnPresetHometown) {
    btnPresetHometown.onclick = () => applyPresetToInputs('HOMETOWN_USA');
  }
  if (btnPresetBeach) {
    btnPresetBeach.onclick = () => applyPresetToInputs('BEACH_TOWN');
  }
  if (btnPresetMetro) {
    btnPresetMetro.onclick = () => applyPresetToInputs('METRO_HEIGHTS');
  }
  if (btnReset) {
    btnReset.onclick = () => resetStreetCustomizer();
  }
  if (btnSave) {
    btnSave.onclick = () => saveCustomStreets();
  }
}
