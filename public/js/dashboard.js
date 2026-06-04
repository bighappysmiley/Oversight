// Parent dashboard logic: auth guard, per-device policy editor, device management.
const state = {
  account: null,
  policy: null,
  mode: 'auto',
  target: 'default', // 'default' or a device id
  devices: [],
};

function el(id) { return document.getElementById(id); }

function relTime(iso) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- auth guard + bootstrap ----------
async function boot() {
  try {
    const { account } = await apiGet('/api/account');
    state.account = account;
  } catch (err) {
    window.location.href = '/login.html';
    return;
  }
  el('acct-email').textContent = state.account.email;
  updateProtectionStatus();
  await loadDevices();
  await loadPolicyFor('default');
  wireUp();
}

function updateProtectionStatus() {
  const status = el('prot-status');
  if (state.account.protectionPasswordSet) {
    status.className = 'alert alert-ok show';
    status.textContent = '✓ A protection password is set. You can change it below.';
  } else {
    status.className = 'alert alert-info show';
    status.textContent = 'No protection password yet. Set one before adding a device.';
  }
}

// ---------- policy ----------
function policyQuery() {
  return state.target && state.target !== 'default'
    ? '?device=' + encodeURIComponent(state.target)
    : '';
}

async function loadPolicyFor(target) {
  state.target = target;
  const { policy } = await apiGet('/api/policy' + policyQuery());
  state.policy = policy;
  state.mode = policy.mode || 'auto';
  el('t-adult').checked = !!policy.filterAdultContent;
  el('t-safe').checked = !!policy.safeSearch;
  el('t-social').checked = !!policy.blockSocialMedia;
  el('policy-target-hint').textContent = target === 'default'
    ? 'The default applies to devices you add later.'
    : 'These rules apply to this device only.';
  renderMode();
  renderTags();
}

function renderMode() {
  document.querySelectorAll('#mode-seg button').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === state.mode);
  });
  const m = state.mode;
  const adult = el('t-adult');
  if (m === 'auto') {
    el('filters-panel').hidden = false;
    el('row-adult').hidden = false;
    el('row-social').hidden = false;
    adult.checked = true;
    adult.disabled = true;
    el('block-panel').hidden = true;
    el('allow-panel').hidden = true;
    el('mode-hint').textContent = 'Automatically blocks adult and explicit websites. Nothing to manage.';
  } else if (m === 'blocklist') {
    el('filters-panel').hidden = false;
    el('row-adult').hidden = false;
    el('row-social').hidden = false;
    adult.disabled = false;
    el('block-panel').hidden = false;
    el('allow-panel').hidden = false;
    el('allow-title').textContent = 'Allowed exceptions';
    el('allow-desc').textContent = 'Sites here stay reachable even with filtering on.';
    el('mode-hint').textContent = 'Blocks adult content plus any sites you list. Everything else is allowed.';
  } else {
    // allowlist
    el('filters-panel').hidden = true;
    el('block-panel').hidden = true;
    el('allow-panel').hidden = false;
    el('allow-title').textContent = 'Allowed websites';
    el('allow-desc').textContent = 'Only these websites will be reachable. Everything else is blocked.';
    el('mode-hint').textContent = 'Only the sites you list will work. Everything else is blocked.';
  }
}

function renderTags() {
  renderTagList('blocked-tags', state.policy.blockedDomains, 'blockedDomains');
  renderTagList('allowed-tags', state.policy.allowedDomains, 'allowedDomains');
}

function renderTagList(containerId, list, key) {
  const c = el(containerId);
  c.innerHTML = '';
  if (!list || !list.length) {
    const span = document.createElement('span');
    span.className = 'row-desc';
    span.textContent = 'None yet.';
    c.appendChild(span);
    return;
  }
  list.forEach((domain, i) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = domain;
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.setAttribute('aria-label', `Remove ${domain}`);
    x.onclick = () => { state.policy[key].splice(i, 1); renderTags(); };
    tag.appendChild(x);
    c.appendChild(tag);
  });
}

function normalizeDomain(raw) {
  let d = (raw || '').trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  if (!d || !d.includes('.') || /\s/.test(d)) return null;
  return d;
}

function addDomain(inputId, key) {
  const input = el(inputId);
  const d = normalizeDomain(input.value);
  if (!d) return;
  if (!state.policy[key]) state.policy[key] = [];
  if (!state.policy[key].includes(d)) state.policy[key].push(d);
  input.value = '';
  renderTags();
}

async function savePolicy() {
  const alertEl = el('policy-alert');
  hideAlert(alertEl);
  const btn = el('save-policy');
  btn.disabled = true;
  const body = {
    mode: state.mode,
    filterAdultContent: el('t-adult').checked,
    safeSearch: el('t-safe').checked,
    blockSocialMedia: el('t-social').checked,
    blockedDomains: state.policy.blockedDomains || [],
    allowedDomains: state.policy.allowedDomains || [],
    blockedCategories: state.policy.blockedCategories || [],
  };
  try {
    const { policy } = await apiPut('/api/policy' + policyQuery(), body);
    state.policy = policy;
    renderTags();
    const where = state.target === 'default' ? 'Default saved.' : 'Saved for this device.';
    showAlert(alertEl, where + ' Devices update automatically.', 'ok');
  } catch (err) {
    showAlert(alertEl, err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ---------- protection password ----------
async function saveProtection() {
  const alertEl = el('prot-alert');
  hideAlert(alertEl);
  const value = el('prot-pass').value;
  if (!value || value.length < 4) {
    showAlert(alertEl, 'Use at least 4 characters.', 'error');
    return;
  }
  const btn = el('save-prot');
  btn.disabled = true;
  try {
    const { account } = await apiPut('/api/account', { protectionPassword: value });
    state.account = account;
    el('prot-pass').value = '';
    updateProtectionStatus();
    showAlert(alertEl, 'Protection password saved. You can now add a device.', 'ok');
  } catch (err) {
    showAlert(alertEl, err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ---------- devices ----------
function deviceIcon(platform) {
  if (platform === 'android') {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="#18b8a6"><path d="M6 18c0 .6.4 1 1 1h10c.6 0 1-.4 1-1V8H6v10zM3.5 8C2.7 8 2 8.7 2 9.5v6a1.5 1.5 0 003 0v-6C5 8.7 4.3 8 3.5 8zm17 0c-.8 0-1.5.7-1.5 1.5v6a1.5 1.5 0 003 0v-6c0-.8-.7-1.5-1.5-1.5zM15.5 4l1-1.8-.7-.4-1 1.9C14 3.3 13 3 12 3s-2 .3-2.8.7l-1-1.9-.7.4 1 1.8C7 5 6 6.4 6 8h12c0-1.6-1-3-2.5-4z"/></svg>';
  }
  return '<svg width="22" height="22" viewBox="0 0 24 24" fill="#4f5bd5"><path d="M16 1H8C6.3 1 5 2.3 5 4v16c0 1.7 1.3 3 3 3h8c1.7 0 3-1.3 3-3V4c0-1.7-1.3-3-3-3zm-4 21c-.8 0-1.5-.7-1.5-1.5S11.2 19 12 19s1.5.7 1.5 1.5S12.8 22 12 22zm5-4H7V4h10v14z"/></svg>';
}

function populatePolicyDevices() {
  const sel = el('policy-device');
  sel.innerHTML = '';
  const def = document.createElement('option');
  def.value = 'default';
  def.textContent = 'Default — applies to new devices';
  sel.appendChild(def);
  state.devices.forEach((d) => {
    const o = document.createElement('option');
    o.value = d.id;
    o.textContent = `${d.name || 'Device'} (${d.platform === 'android' ? 'Android' : 'iOS'})`;
    sel.appendChild(o);
  });
  // keep current selection if still present, else fall back to default
  sel.value = state.devices.some((d) => d.id === state.target) || state.target === 'default'
    ? state.target
    : 'default';
}

async function loadDevices() {
  const c = el('device-list');
  try {
    const { devices } = await apiGet('/api/devices');
    state.devices = devices;
    populatePolicyDevices();
    if (!devices.length) {
      c.innerHTML = '<div class="empty">No devices yet. Click <strong>“Add a device”</strong> to protect your child\'s phone or tablet.</div>';
      return;
    }
    c.innerHTML = '';
    devices.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'device';
      const badge = d.platform === 'android'
        ? '<span class="badge badge-android">Android</span>'
        : '<span class="badge badge-ios">iOS</span>';
      row.innerHTML = `
        <div class="dev-icon">${deviceIcon(d.platform)}</div>
        <div class="dev-main">
          <div class="row-title">${escapeHtml(d.name || 'Device')} ${badge}</div>
          <div class="row-desc">Added ${relTime(d.enrolledAt)} · last seen ${relTime(d.lastSeen)}</div>
        </div>
        <button class="btn btn-ghost" data-policy="${d.id}">Edit rules</button>
        <button class="btn btn-danger" data-remove="${d.id}">Remove</button>`;
      c.appendChild(row);
    });
    c.querySelectorAll('[data-remove]').forEach((b) => {
      b.onclick = () => removeDevice(b.getAttribute('data-remove'), b);
    });
    c.querySelectorAll('[data-policy]').forEach((b) => {
      b.onclick = () => {
        switchTab('policy');
        el('policy-device').value = b.getAttribute('data-policy');
        loadPolicyFor(b.getAttribute('data-policy'));
      };
    });
  } catch (err) {
    c.innerHTML = `<div class="empty">Could not load devices: ${escapeHtml(err.message)}</div>`;
  }
}

async function removeDevice(id, btn) {
  if (!confirm('Remove this device from Oversight? On the device, protection must still be removed using your protection password.')) return;
  btn.disabled = true;
  try {
    await apiDel('/api/devices?id=' + encodeURIComponent(id));
    if (state.target === id) { state.target = 'default'; await loadPolicyFor('default'); }
    await loadDevices();
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
  }
}

// ---------- add-device modal ----------
async function openModal() {
  // Re-check with the server so a freshly set password is always recognised.
  try {
    const { account } = await apiGet('/api/account');
    state.account = account;
    updateProtectionStatus();
  } catch (_) { /* keep cached state */ }

  if (!state.account.protectionPasswordSet) {
    switchTab('security');
    const status = el('prot-status');
    status.className = 'alert alert-error show';
    status.textContent = 'Please set a protection password first, then add your device.';
    return;
  }
  el('modal-step-name').hidden = false;
  el('modal-step-code').hidden = true;
  hideAlert(el('modal-alert'));
  el('dev-name').value = '';
  el('modal').classList.add('show');
}
function closeModal() { el('modal').classList.remove('show'); }

async function generateCode() {
  const btn = el('modal-generate');
  btn.disabled = true;
  hideAlert(el('modal-alert'));
  try {
    const { code } = await apiPost('/api/enroll/start', { name: el('dev-name').value });
    el('code-display').textContent = code;
    el('enroll-url').value = `${location.origin}/enroll?code=${code}`;
    el('modal-step-name').hidden = true;
    el('modal-step-code').hidden = false;
  } catch (err) {
    showAlert(el('modal-alert'), err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ---------- tabs ----------
function switchTab(tab) {
  document.querySelectorAll('.side nav a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
}

// ---------- wire up ----------
function wireUp() {
  document.querySelectorAll('.side nav a').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); switchTab(a.dataset.tab); });
  });
  el('logout').addEventListener('click', async (e) => {
    e.preventDefault();
    await apiPost('/api/logout');
    window.location.href = '/';
  });

  // policy
  el('policy-device').addEventListener('change', (e) => loadPolicyFor(e.target.value));
  document.querySelectorAll('#mode-seg button').forEach((b) => {
    b.addEventListener('click', () => { state.mode = b.dataset.mode; renderMode(); });
  });
  el('blocked-add').addEventListener('click', () => addDomain('blocked-input', 'blockedDomains'));
  el('allowed-add').addEventListener('click', () => addDomain('allowed-input', 'allowedDomains'));
  el('blocked-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain('blocked-input', 'blockedDomains'); } });
  el('allowed-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain('allowed-input', 'allowedDomains'); } });
  el('save-policy').addEventListener('click', savePolicy);

  // protection
  el('save-prot').addEventListener('click', saveProtection);
  el('prot-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveProtection(); } });

  // devices / modal
  el('add-device').addEventListener('click', openModal);
  el('modal-cancel').addEventListener('click', closeModal);
  el('modal-done').addEventListener('click', () => { closeModal(); loadDevices(); });
  el('modal-generate').addEventListener('click', generateCode);
  el('copy-url').addEventListener('click', () => {
    const input = el('enroll-url');
    input.select();
    navigator.clipboard?.writeText(input.value).catch(() => {});
    el('copy-url').textContent = 'Copied';
    setTimeout(() => (el('copy-url').textContent = 'Copy'), 1500);
  });
  el('modal').addEventListener('click', (e) => { if (e.target === el('modal')) closeModal(); });
}

boot();
