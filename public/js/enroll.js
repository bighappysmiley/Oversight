// Device-side enrollment: validate the setup code, detect the OS, and present
// the right installation path (iOS profile or Android app).
function detectOS() {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  // iPadOS reports as desktop Safari
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
  return 'other';
}

const alertEl = document.getElementById('alert');
let currentCode = '';

function getCodeFromUrl() {
  const u = new URL(location.href);
  return (u.searchParams.get('code') || '').trim().toUpperCase();
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
      showAlert(alertEl, 'That code is invalid or has expired. Ask your parent to generate a new one.', 'error');
      return;
    }
    currentCode = code;
    showPlatform(info.name);
  } catch (err) {
    showAlert(alertEl, err.message, 'error');
  }
}

function showPlatform(suggestedName) {
  document.getElementById('code-entry').hidden = true;
  document.getElementById('platform').hidden = false;
  document.getElementById('intro').textContent = 'Follow the steps below to protect this device.';

  const nameInput = document.getElementById('dev-name');
  if (suggestedName) nameInput.value = suggestedName;

  const os = detectOS();
  document.getElementById('ios-block').hidden = os !== 'ios';
  document.getElementById('android-block').hidden = os !== 'android';
  document.getElementById('other-block').hidden = os === 'ios' || os === 'android';

  if (os === 'ios') {
    const link = document.getElementById('ios-install');
    const setHref = () => {
      const name = encodeURIComponent(nameInput.value || 'iOS device');
      link.href = `/api/profile?code=${encodeURIComponent(currentCode)}&name=${name}`;
    };
    setHref();
    nameInput.addEventListener('input', setHref);
  }

  if (os === 'android') {
    document.getElementById('android-code').textContent = currentCode;
  }
}

// Init
const codeInput = document.getElementById('code');
document.getElementById('continue').addEventListener('click', () => validateAndShow(codeInput.value));
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') validateAndShow(codeInput.value); });

const urlCode = getCodeFromUrl();
if (urlCode) {
  codeInput.value = urlCode;
  validateAndShow(urlCode);
}
