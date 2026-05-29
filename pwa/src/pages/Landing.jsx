import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const ua = navigator.userAgent;
const platform = navigator.platform || '';
const isMac = /Mac/.test(platform) || /Macintosh/.test(ua);
const isWindows = /Win/.test(platform) || /Windows/.test(ua);
const isLinux = /Linux/.test(platform) && !/Android/.test(ua);
const isAndroid = /Android/.test(ua);
const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
const isMobile = isAndroid || isIOS;

const FEATURES = [
  { icon: '🔒', title: 'Website Blocking', desc: 'Block distracting or harmful sites with a blocklist or strict allowlist.' },
  { icon: '⏱️', title: 'App Limits', desc: 'Set daily time limits for any app. Oversight enforces them automatically.' },
  { icon: '🌙', title: 'Downtime Schedules', desc: 'Schedule screen-free hours so kids can sleep and focus.' },
  { icon: '📊', title: 'Usage Reports', desc: 'See exactly which apps and sites your child uses every day.' },
  { icon: '🖥️', title: 'Live Screen View', desc: "View a real-time screenshot of your child's device from anywhere." },
  { icon: '📋', title: 'Import from Excel', desc: 'Paste or import entire domain blocklists from a spreadsheet.' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} style={s.copyBtn}>
      {copied ? '✓ Copied!' : 'Copy Command'}
    </button>
  );
}

function WaitlistForm({ platform }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!email) return;
    try {
      await api.joinWaitlist(email, platform);
      setSubmitted(true);
    } catch {
      setError("Couldn't save — please try emailing us directly.");
    }
  };

  if (submitted) {
    return <p style={{ color: '#a5b4fc', marginTop: 16 }}>Thanks! We'll notify you when the {platform} app is ready.</p>;
  }
  return (
    <form onSubmit={submit} style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        style={s.emailInput}
      />
      <button type="submit" style={s.ctaPrimary}>Notify Me</button>
      {error && <p style={{ color: '#f87171', width: '100%', margin: 0 }}>{error}</p>}
    </form>
  );
}

function ChildPanel() {
  if (isIOS) {
    return (
      <div style={s.platformPanel}>
        <h3 style={s.panelTitle}>📱 iOS App Coming Soon</h3>
        <p style={s.panelText}>
          We're working on an iOS app. Enter your email to be notified when it's ready.
        </p>
        <WaitlistForm platform="iOS" />
      </div>
    );
  }

  if (isAndroid) {
    return (
      <div style={s.platformPanel}>
        <h3 style={s.panelTitle}>🤖 Android App Coming Soon</h3>
        <p style={s.panelText}>
          We're working on an Android app. Enter your email to be notified when it's ready.
        </p>
        <WaitlistForm platform="Android" />
      </div>
    );
  }

  if (isWindows) {
    const cmd = 'irm https://your-server.com/install.ps1 | iex';
    return (
      <div style={s.platformPanel}>
        <h3 style={s.panelTitle}>🪟 Download the Windows Agent</h3>
        <p style={s.panelText}>Run this command in PowerShell (as Administrator):</p>
        <div style={s.codeBlock}>
          <code style={s.code}>{cmd}</code>
        </div>
        <CopyButton text={cmd} />
        <details style={s.details}>
          <summary style={s.summary}>Manual install steps</summary>
          <ol style={s.stepsList}>
            <li>Install Python 3.9+ from python.org</li>
            <li>Run: <code style={s.inlineCode}>pip install requests psutil pywin32</code></li>
            <li>Download the <code style={s.inlineCode}>mac-agent/</code> folder from the repo</li>
            <li>Run: <code style={s.inlineCode}>python agent_windows.py --pair</code></li>
            <li>Run as Admin: <code style={s.inlineCode}>python agent_windows.py --install</code></li>
          </ol>
        </details>
      </div>
    );
  }

  if (isLinux) {
    const cmd = 'curl -fsSL https://your-server.com/install-linux.sh | sudo bash';
    return (
      <div style={s.platformPanel}>
        <h3 style={s.panelTitle}>🐧 Download the Linux Agent</h3>
        <p style={s.panelText}>Run this command in your terminal:</p>
        <div style={s.codeBlock}>
          <code style={s.code}>{cmd}</code>
        </div>
        <CopyButton text={cmd} />
        <details style={s.details}>
          <summary style={s.summary}>Manual install steps</summary>
          <ol style={s.stepsList}>
            <li>Install deps: <code style={s.inlineCode}>sudo apt install python3 python3-pip xdotool</code></li>
            <li>Run: <code style={s.inlineCode}>pip3 install requests psutil</code></li>
            <li>Download the <code style={s.inlineCode}>mac-agent/</code> folder from the repo</li>
            <li>Run: <code style={s.inlineCode}>python3 agent_linux.py --pair</code></li>
            <li>Run as root: <code style={s.inlineCode}>sudo python3 agent_linux.py --install</code></li>
          </ol>
        </details>
      </div>
    );
  }

  // Default: Mac
  const cmd = 'curl -fsSL https://your-server.com/install.sh | sudo bash';
  return (
    <div style={s.platformPanel}>
      <h3 style={s.panelTitle}>🍎 Download the Mac Agent</h3>
      <p style={s.panelText}>Run this command in Terminal:</p>
      <div style={s.codeBlock}>
        <code style={s.code}>{cmd}</code>
      </div>
      <CopyButton text={cmd} />
      <details style={s.details}>
        <summary style={s.summary}>Manual install steps</summary>
        <ol style={s.stepsList}>
          <li>Install Python 3.9+ if needed (comes with macOS 12+)</li>
          <li>Run: <code style={s.inlineCode}>pip3 install requests</code></li>
          <li>Download the <code style={s.inlineCode}>mac-agent/</code> folder from the repo</li>
          <li>Run: <code style={s.inlineCode}>python3 agent.py --pair</code></li>
          <li>Run as root: <code style={s.inlineCode}>sudo python3 agent.py --install</code></li>
        </ol>
      </details>
    </div>
  );
}

function RoleModal({ onClose }) {
  const navigate = useNavigate();
  const [view, setView] = useState('choose'); // 'choose' | 'parent' | 'child'

  return (
    <div style={s.modalCard}>
      {view === 'choose' && (
        <>
          <h2 style={s.modalTitle}>Who are you?</h2>
          <div style={s.roleRow}>
            <button style={s.roleCard} onClick={() => setView('parent')}>
              <span style={s.roleIcon}>👨‍👩‍👧</span>
              <h3 style={s.roleCardTitle}>I'm a Parent</h3>
              <p style={s.roleCardDesc}>Manage your child's device from the web dashboard — works on any device</p>
            </button>
            <button style={s.roleCard} onClick={() => setView('child')}>
              <span style={s.roleIcon}>👦</span>
              <h3 style={s.roleCardTitle}>I'm a Child</h3>
              <p style={s.roleCardDesc}>This is the device to monitor — install the agent here</p>
            </button>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕ Close</button>
        </>
      )}

      {view === 'parent' && (
        <>
          <h2 style={s.modalTitle}>Welcome, Parent</h2>
          <p style={s.panelText}>The Oversight Dashboard is a web app — no download needed.</p>
          <div style={s.stepsListInline}>
            <div style={s.stepItem}><span style={s.stepNum}>1</span> Create an account</div>
            <div style={s.stepItem}><span style={s.stepNum}>2</span> Add your child's device</div>
            <div style={s.stepItem}><span style={s.stepNum}>3</span> Set controls &amp; relax</div>
          </div>
          <button onClick={() => navigate('/login')} style={{ ...s.ctaPrimary, marginTop: 24 }}>
            Open Dashboard →
          </button>
          <p style={s.pwaTip}>
            💡 Tip: On iPhone/Android tap <strong>Share → Add to Home Screen</strong> for an app-like experience.
          </p>
          <button style={s.backBtn} onClick={() => setView('choose')}>← Back</button>
        </>
      )}

      {view === 'child' && (
        <>
          <h2 style={s.modalTitle}>Install the Agent</h2>
          <ChildPanel />
          <button style={s.backBtn} onClick={() => setView('choose')}>← Back</button>
        </>
      )}
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  return (
    <div style={s.page}>
      {/* Nav */}
      <header style={s.nav}>
        <div style={s.navLogo}>
          <span style={{ fontSize: 28 }}>👁️</span>
          <span style={s.navLogoText}>Oversight</span>
        </div>
        <div style={s.navLinks}>
          <button onClick={() => navigate('/login')} style={s.navBtn}>Sign In</button>
          <button onClick={() => navigate('/login')} style={s.navBtnOutline}>Create Account</button>
        </div>
      </header>

      {/* Hero */}
      <section style={s.hero}>
        <span style={s.badge}>Complete parental controls for every device</span>
        <h1 style={s.heroTitle}>Keep your kids safe<br />on every screen</h1>
        <p style={s.heroSub}>
          Monitor usage, block sites, set time limits, and view live screenshots — all from one dashboard. Works on Mac, Windows, Linux, iOS &amp; Android.
        </p>

        <button onClick={() => setShowModal(!showModal)} style={s.ctaPrimary}>
          {isMobile ? 'Get Oversight' : 'Download Oversight'}
        </button>

        {showModal && (
          <div style={s.modalWrapper}>
            <RoleModal onClose={() => setShowModal(false)} />
          </div>
        )}
      </section>

      {/* Features */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Everything you need to keep kids safe online</h2>
        <div style={s.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} style={s.featureCard}>
              <span style={s.featureIcon}>{f.icon}</span>
              <h3 style={s.featureTitle}>{f.title}</h3>
              <p style={s.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Platform support */}
      <section style={s.platformSection}>
        <h2 style={s.sectionTitle}>Works on every device</h2>
        <div style={s.platformRow}>
          {[
            { icon: '🍎', label: 'Mac', status: '✅' },
            { icon: '🪟', label: 'Windows', status: '✅' },
            { icon: '🐧', label: 'Linux', status: '✅' },
            { icon: '📱', label: 'iOS', status: 'Coming soon' },
            { icon: '🤖', label: 'Android', status: 'Coming soon' },
          ].map(p => (
            <div key={p.label} style={s.platformCard}>
              <span style={{ fontSize: 32 }}>{p.icon}</span>
              <span style={s.platformLabel}>{p.label}</span>
              <span style={{ fontSize: 13, color: p.status === '✅' ? '#4ade80' : '#94a3b8' }}>{p.status}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={s.footer}>
        <button onClick={() => navigate('/login')} style={s.footerLink}>Sign In</button>
        <span style={{ color: '#4b5563' }}> · </span>
        <button onClick={() => navigate('/login')} style={s.footerLink}>Create Account</button>
        <span style={{ display: 'block', marginTop: 12, color: '#4b5563', fontSize: 12 }}>© 2025 Oversight. Built for families.</span>
      </footer>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#0f0f23', fontFamily: 'system-ui, sans-serif', color: '#f1f5f9' },

  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid #1e1e3a', position: 'sticky', top: 0, background: '#0f0f23', zIndex: 20 },
  navLogo: { display: 'flex', alignItems: 'center', gap: 10 },
  navLogoText: { fontSize: 20, fontWeight: 700, color: '#e0e7ff' },
  navLinks: { display: 'flex', gap: 12, alignItems: 'center' },
  navBtn: { padding: '8px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  navBtnOutline: { padding: '8px 20px', background: 'transparent', color: '#a5b4fc', border: '1px solid #4f46e5', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },

  hero: { textAlign: 'center', padding: '100px 24px 60px', maxWidth: 760, margin: '0 auto' },
  badge: { display: 'inline-block', background: '#1e1b4b', color: '#a5b4fc', padding: '4px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, marginBottom: 24, border: '1px solid #312e81' },
  heroTitle: { fontSize: 54, fontWeight: 800, lineHeight: 1.15, color: '#e0e7ff', margin: '0 0 24px' },
  heroSub: { fontSize: 18, color: '#94a3b8', margin: '0 0 40px', lineHeight: 1.7 },

  ctaPrimary: { padding: '16px 36px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 17, display: 'inline-block', textDecoration: 'none' },

  modalWrapper: { marginTop: 32, textAlign: 'left', animation: 'fadeIn 0.2s ease' },
  modalCard: { background: '#16162a', border: '1px solid #2d2b55', borderRadius: 16, padding: '32px', maxWidth: 700, margin: '0 auto' },
  modalTitle: { fontSize: 22, fontWeight: 700, color: '#e0e7ff', margin: '0 0 24px' },

  roleRow: { display: 'flex', gap: 20, flexWrap: 'wrap' },
  roleCard: { flex: '1 1 200px', background: '#1e1e3a', border: '2px solid #312e81', borderRadius: 12, padding: '24px', cursor: 'pointer', textAlign: 'left', color: '#f1f5f9', transition: 'border-color 0.15s' },
  roleIcon: { fontSize: 36, display: 'block', marginBottom: 12 },
  roleCardTitle: { fontSize: 17, fontWeight: 700, color: '#e0e7ff', margin: '0 0 8px' },
  roleCardDesc: { fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.6 },

  closeBtn: { marginTop: 20, background: 'transparent', border: '1px solid #374151', color: '#9ca3af', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  backBtn: { marginTop: 20, background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 14, padding: 0 },

  stepsListInline: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 },
  stepItem: { display: 'flex', alignItems: 'center', gap: 12, color: '#cbd5e1' },
  stepNum: { width: 28, height: 28, borderRadius: '50%', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  pwaTip: { marginTop: 20, fontSize: 13, color: '#64748b', lineHeight: 1.6, fontStyle: 'italic' },

  platformPanel: { marginTop: 8 },
  panelTitle: { fontSize: 18, fontWeight: 700, color: '#e0e7ff', margin: '0 0 12px' },
  panelText: { fontSize: 14, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.6 },

  codeBlock: { background: '#0d0d1a', border: '1px solid #2d2b55', borderRadius: 8, padding: '12px 16px', marginBottom: 12, overflowX: 'auto' },
  code: { fontFamily: 'monospace', fontSize: 13, color: '#a5b4fc', whiteSpace: 'nowrap' },
  inlineCode: { fontFamily: 'monospace', fontSize: 12, background: '#1e1e3a', color: '#a5b4fc', padding: '2px 6px', borderRadius: 4 },

  copyBtn: { padding: '8px 16px', background: '#312e81', color: '#a5b4fc', border: '1px solid #4f46e5', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },

  details: { marginTop: 16 },
  summary: { color: '#6366f1', cursor: 'pointer', fontSize: 14, marginBottom: 8 },
  stepsList: { color: '#94a3b8', fontSize: 14, lineHeight: 2, paddingLeft: 20, margin: 0 },

  emailInput: { padding: '10px 14px', background: '#1e1e3a', border: '1px solid #312e81', borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none', flex: '1 1 200px' },

  section: { padding: '80px 48px', maxWidth: 1100, margin: '0 auto' },
  sectionTitle: { textAlign: 'center', fontSize: 30, fontWeight: 700, color: '#e0e7ff', margin: '0 0 48px' },
  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 },
  featureCard: { background: '#16162a', borderRadius: 12, padding: 28, border: '1px solid #2d2b55' },
  featureIcon: { fontSize: 32, display: 'block', marginBottom: 12 },
  featureTitle: { fontSize: 17, fontWeight: 700, color: '#e0e7ff', margin: '0 0 8px' },
  featureDesc: { fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.6 },

  platformSection: { padding: '60px 48px', background: '#0a0a1a', textAlign: 'center' },
  platformRow: { display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' },
  platformCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  platformLabel: { fontSize: 14, fontWeight: 600, color: '#cbd5e1' },

  footer: { textAlign: 'center', padding: '32px 24px', borderTop: '1px solid #1e1e3a' },
  footerLink: { background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 14, fontWeight: 500 },
};
