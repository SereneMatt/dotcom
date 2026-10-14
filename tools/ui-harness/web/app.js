import { defaultViewports, normalizeUrl, parseViewport, viewportKey } from '/settings.js';

const $ = selector => document.querySelector(selector);
const message = (text, error = false) => {
  $('#message').textContent = text;
  $('#message').classList.toggle('error', error);
};

try {
  const response = await fetch('/api/workspace');
  if (!response.ok) throw new Error('Could not load this workspace. Restart the CLI and refresh.');
  const { settings, catalog, token, configPath } = await response.json();
  const state = structuredClone(settings);
  let savedSnapshot = JSON.stringify(settings);
  const cards = new Map();
  const available = new Map([...catalog.viewports, ...defaultViewports, ...state.viewports].map(size => [viewportKey(size), size]));
  const catalogKeys = new Set(catalog.viewports.map(viewportKey));
  $('#target-url').value = state.url;
  $('#scale').value = String(state.scale);
  if (!$('#scale').value) {
    $('#scale').add(new Option(`${Math.round(state.scale * 100)}%`, String(state.scale)));
    $('#scale').value = String(state.scale);
  }
  $('#catalog-source').href = catalog.source;
  $('#catalog-info').textContent = `${catalog.viewports.length} unique sizes · ${catalog.revision.slice(0, 7)}`;
  $('#save').title = `Save to ${configPath}`;
  $('#workspace-origin').textContent = `Workspace origin: ${location.origin}`;

  function changed() {
    $('#save-state').textContent = JSON.stringify(state) === savedSnapshot ? 'Settings unchanged' : 'Unsaved changes';
  }

  function resizeCard(card, size) {
    const scale = state.scale === 'fit' ? Math.min(1, card.clientWidth / size.width) : state.scale;
    card.querySelector('iframe').style.transform = `scale(${scale})`;
    card.querySelector('.frame-space').style.height = `${size.height * scale}px`;
    card.querySelector('.preview-meta').textContent = `${Math.round(scale * 100)}% display · CSS pixels`;
  }

  const resizeObserver = new ResizeObserver(entries => {
    for (const { target } of entries) resizeCard(target, available.get(target.dataset.viewport));
  });

  function layout() {
    $('#previews').classList.toggle('fixed-scale', state.scale !== 'fit');
    for (const [key, card] of cards) {
      const size = available.get(key);
      card.style.flex = state.scale === 'fit' ? '' : `0 0 ${size.width * state.scale + 2}px`;
      resizeCard(card, size);
    }
  }

  function selectSize(size, selected) {
    const key = viewportKey(size);
    if (selected) {
      if (state.viewports.some(item => viewportKey(item) === key)) return;
      if (state.viewports.length >= 128) return message('Select at most 128 viewports.', true);
      state.viewports.push(size);
    } else {
      if (state.viewports.length === 1) return message('Keep at least one viewport open.', true);
      state.viewports = state.viewports.filter(item => viewportKey(item) !== key);
    }
    message('');
    renderPreviews();
    renderCatalog();
    changed();
  }

  function renderPreviews() {
    const selected = new Set(state.viewports.map(viewportKey));
    for (const [key, card] of cards) {
      if (selected.has(key)) continue;
      resizeObserver.unobserve(card);
      card.remove();
      cards.delete(key);
    }
    for (const size of state.viewports) {
      const key = viewportKey(size);
      if (cards.has(key)) continue;
      const card = $('#preview-template').content.firstElementChild.cloneNode(true);
      card.dataset.viewport = key;
      card.querySelector('h2').textContent = `${size.width} × ${size.height}`;
      const frame = card.querySelector('iframe');
      frame.title = `Preview ${size.width} × ${size.height}`;
      frame.style.width = `${size.width}px`;
      frame.style.height = `${size.height}px`;
      frame.src = state.url;
      const remove = card.querySelector('.remove');
      remove.setAttribute('aria-label', `Remove ${size.width} × ${size.height}`);
      remove.addEventListener('click', () => selectSize(size, false));
      cards.set(key, card);
      $('#previews').append(card);
      resizeObserver.observe(card);
    }
    for (const card of cards.values()) card.querySelector('.remove').disabled = cards.size === 1;
    $('#selected-count').textContent = state.viewports.length;
    $('#preview-summary').textContent = `${state.viewports.length} live previews · scroll and navigate independently`;
    layout();
  }

  function renderCatalog() {
    const filter = $('#search').value.toLowerCase().replaceAll('×', 'x').replaceAll(/\s/g, '');
    const selected = new Set(state.viewports.map(viewportKey));
    const fragment = document.createDocumentFragment();
    const sizes = [...available.values()].sort((a, b) => Number(selected.has(viewportKey(b))) - Number(selected.has(viewportKey(a))) || a.width - b.width || a.height - b.height);
    for (const size of sizes) {
      const key = viewportKey(size);
      if (!key.includes(filter)) continue;
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(key);
      checkbox.disabled = checkbox.checked && selected.size === 1;
      checkbox.dataset.size = key;
      checkbox.addEventListener('change', () => {
        selectSize(size, checkbox.checked);
        document.querySelector(`input[data-size="${key}"]`)?.focus();
      });
      const text = document.createElement('span');
      text.textContent = `${size.width} × ${size.height}`;
      label.append(checkbox, text);
      if (!catalogKeys.has(key)) {
        const badge = document.createElement('small');
        badge.textContent = defaultViewports.some(item => viewportKey(item) === key) ? 'STARTER' : 'CUSTOM';
        label.append(badge);
      }
      fragment.append(label);
    }
    $('#catalog').replaceChildren(fragment);
  }

  function resetFrames() {
    for (const card of cards.values()) card.querySelector('iframe').src = state.url;
    $('#open-directly').href = state.url;
  }

  $('#navigate').addEventListener('submit', event => {
    event.preventDefault();
    try {
      state.url = normalizeUrl($('#target-url').value);
      $('#target-url').value = state.url;
      resetFrames();
      changed();
      message('Opened the project URL in all previews.');
    } catch (error) { message(error.message, true); }
  });
  $('#reload').addEventListener('click', () => {
    resetFrames();
    message('All previews returned to the project URL.');
  });
  $('#scale').addEventListener('change', () => {
    state.scale = $('#scale').value === 'fit' ? 'fit' : Number($('#scale').value);
    layout();
    changed();
  });
  $('#search').addEventListener('input', renderCatalog);
  $('#custom').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const size = parseViewport({ width: Number(form.get('width')), height: Number(form.get('height')) });
      available.set(viewportKey(size), size);
      selectSize(size, true);
      $('#search').value = '';
      renderCatalog();
    } catch (error) { message(error.message, true); }
  });
  $('#defaults').addEventListener('click', () => {
    state.viewports = structuredClone(defaultViewports);
    renderPreviews();
    renderCatalog();
    changed();
    message('Restored the four starting sizes. Existing previews kept their page state.');
  });
  $('#save').addEventListener('click', async () => {
    $('#save').disabled = true;
    const snapshot = JSON.stringify(state);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Harness-Token': token }, body: snapshot,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      savedSnapshot = snapshot;
      changed();
      message(`Settings saved to ${configPath}`);
    } catch (error) { message(`Could not save: ${error.message}`, true); }
    finally { $('#save').disabled = false; }
  });
  $('#open-directly').href = state.url;
  renderPreviews();
  renderCatalog();
} catch (error) { message(error.message, true); }
