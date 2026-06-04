// Handles both the login and signup forms.
function initAuth(mode) {
  const form = document.getElementById('form');
  const alertEl = document.getElementById('alert');
  const submit = document.getElementById('submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alertEl);
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = mode === 'signup' ? 'Creating…' : 'Logging in…';

    try {
      const path = mode === 'signup' ? '/api/signup' : '/api/login';
      await apiPost(path, { email, password });
      window.location.href = '/dashboard.html';
    } catch (err) {
      showAlert(alertEl, err.message, 'error');
      submit.disabled = false;
      submit.textContent = original;
    }
  });
}
