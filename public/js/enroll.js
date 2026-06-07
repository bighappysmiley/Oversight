// Device-side setup: validate the code, detect the OS, and present the right
// real installer (Apple profile / Android app / desktop Safe DNS).
function detectOS() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const touch = navigator.maxTouchPoints || 0;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipod/i.test(ua)) return 'ios';
  if (/ipad/i.test(ua)) return 'ios';
  if (platform === 'MacIntel' && touch > 1) return 'ios'; // iPadOS reports as Mac
  if (/macintosh|mac os x/i.test(ua)) return 'mac';
  if (/cros/i.test(ua)) return 'chromeos';
  if (/windows|win64|win32/i.test(ua)) return 'windows';
  if (/linux/i.test(ua)) return 'linux';
  return 'other';
}

const CHOICES = [
  { key: 'ios', sub: null, label: 'iPhone / iPad' },
  { key: 'mac', sub: null, label: 'Mac' },
  { key: 'android', sub: null, label: 'Android' },
  { key: 'desktop', sub: 'win', label: 'Windows' },
  { key: 'desktop', sub: 'linux', label: 'Linux' },
  { key: 'desktop', sub: 'chrome', label: 'Chromebook' },
];

const alertEl = document.getElementById('alert');
let currentCode = '';

function getCodeFromUrl() {
  return (new URL(location.href).searchParams.get('code') || '').trim().toUpperCase();
}

async function validateAndShow(code) {
  hideAlert(alertEl);
  code = (code || '').trim().toUpperCase();
  if (code.length < 6) {
    showAlert(alertEl, 'Please enter the full setup code.', 'error');
    return;
  }
  try {
    const info = await apiGet('/api/enroll/info?code=' + encodeURIComponent(code));
    if (!info.valid) {
      showAlert(alertEl, 'That code is invalid or has expired. Ask your parent for a new one.', 'error');
      return;
    }
    currentCode = code;
    document.getElementById('code-entry').hidden = true;
    document.getElementById('platform').hidden = false;
    document.getElementById('intro').textContent = 'Choose this device, then follow the steps.';
    if (info.name) document.getElementById('dev-name').value = info.name;
    buildChooser();
    initialShow(detectOS());
  } catch (err) {
    showAlert(alertEl, err.message, 'error');
  }
}

function buildChooser() {
  const wrap = document.getElementById('osswitch');
  wrap.innerHTML = '';
  CHOICES.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = c.label;
    b._choice = c;
    b.addEventListener('click', () => showBlock(c.key, c.sub, b));
    wrap.appendChild(b);
  });
}

function initialShow(os) {
  let key = null;
  let sub = null;
  if (os === 'ios') key = 'ios';
  else if (os === 'mac') key = 'mac';
  else if (os === 'android') key = 'android';
  else if (os === 'windows') { key = 'desktop'; sub = 'win'; }
  else if (os === 'linux') { key = 'desktop'; sub = 'linux'; }
  else if (os === 'chromeos') { key = 'desktop'; sub = 'chrome'; }

  if (!key) {
    document.getElementById('intro').textContent = 'Choose your device below to set up.';
    return;
  }
  let match = null;
  document.querySelectorAll('#osswitch button').forEach((b) => {
    if (b._choice.key === key && (b._choice.sub || null) === (sub || null)) match = b;
  });
  showBlock(key, sub, match);
}

function showBlock(key, sub, btn) {
  ['ios', 'mac', 'android', 'desktop'].forEach((k) => {
    document.getElementById('b-' + k).hidden = k !== key;
  });
  document.getElementById('name-field').style.display = key === 'desktop' ? 'none' : '';

  if (key === 'desktop') {
    document.getElementById('desktop-win').hidden = sub !== 'win';
    document.getElementById('desktop-linux').hidden = sub !== 'linux';
    document.getElementById('desktop-chrome').hidden = sub !== 'chrome';
  }

  const name = document.getElementById('dev-name');
  if (key === 'ios') {
    const link = document.getElementById('ios-install');
    const upd = () => {
      link.href = '/api/profile?code=' + encodeURIComponent(currentCode) +
        '&platform=ios&name=' + encodeURIComponent(name.value || 'iPhone / iPad');
    };
    upd();
    name.oninput = upd;
  } else if (key === 'mac') {
    document.getElementById('mac-code').textContent = currentCode;
    const link = document.getElementById('mac-install');
    const upd = () => {
      link.href = '/api/profile?code=' + encodeURIComponent(currentCode) +
        '&platform=macos&name=' + encodeURIComponent(name.value || 'Mac');
    };
    upd();
    name.oninput = upd;
  } else if (key === 'android') {
    document.getElementById('android-code').textContent = currentCode;
  }

  document.querySelectorAll('#osswitch button').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

const codeInput = document.getElementById('code');
document.getElementById('continue').addEventListener('click', () => validateAndShow(codeInput.value));
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') validateAndShow(codeInput.value); });

const urlCode = getCodeFromUrl();
if (urlCode) {
  codeInput.value = urlCode;
  validateAndShow(urlCode);
}
