import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';

const ua = navigator.userAgent;
const platform = navigator.platform || '';
const isMac = /Mac/.test(platform) || /Macintosh/.test(ua);
const isWindows = /Win/.test(platform) || /Windows/.test(ua);
const isLinux = /Linux/.test(platform) && !/Android/.test(ua);
const isAndroid = /Android/.test(ua);
const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
const isMobile = isAndroid || isIOS;

const FEATURES = [
  { icon: 'lock', title: 'Website Blocking', desc: 'Block distracting or harmful sites with a blocklist or strict allowlist.' },
  { icon: 'clock', title: 'App Limits', desc: 'Set daily time limits for any app. Oversight enforces them automatically.' },
  { icon: 'moon', title: 'Downtime Schedules', desc: 'Schedule screen-free hours so kids can sleep and focus.' },
  { icon: 'barChart', title: 'Usage Reports', desc: 'See exactly which apps and sites your child uses every day.' },
  { icon: 'monitor', title: 'Live Screen View', desc: "View a real-time screenshot of your child's device from anywhere." },
  { icon: 'upload', title: 'Import from Excel', desc: 'Paste or import entire domain blocklists from a spreadsheet.' },
];

function ChildPanel() {
  if (isIOS) {
    return (
      <div style={s.platformPanel}>
        <h3 style={s.panelTitle}>Install on iPhone / iPad</h3>
        <p style={s.panelText}>
          Download the Oversight profile — it sets up DNS filtering to block websites across every browser on this device.
        </p>
        <a href="/api/install/ios-profile" download="oversight-ios.mobileconfig" style={s.bigDownloadBtn}>
          <Icon name="download" size={18} color="#fff" />
          <span>Download iOS Profile</span>
        </a>
        <p style={{ ...s.noteText, marginTop: 16 }}>
          App monitoring for iOS requires the App Store app (coming soon). DNS blocking works immediately.
        </p>
        <p style={s.noteText}>
          After pairing, your iOS profile will be personalized with your filtering settings. You can re-download it any time from the parent dashboard.
        </p>
      </div>
    );
  }

  if (isAndroid) {
    return (
      <div style={s.platformPanel}>
        <h3 style={s.panelTitle}>Install on Android</h3>
        <p style={s.panelText}>
          Download the Oversight app and install it to monitor and control this device.
        </p>
        <a href="/download/oversight.apk" download="oversight.apk" style={s.bigDownloadBtn}>
          <Icon name="download" size={18} color="#fff" />
          <span>Download Android APK</span>
        </a>
        <p style={{ ...s.noteText, marginTop: 12 }}>
          You may need to enable "Install from unknown sources" in Settings → Security.
        </p>
        <ol style={s.stepsList}>
          <li>Tap "Download APK" above</li>
          <li>Open the downloaded file</li>
          <li>Tap "Install"</li>
          <li>Open Oversight and enter the pairing code shown on your parent's device</li>
        </ol>
      </div>
    );
  }

  if (isWindows) {
    return (
      <div style={s.platformPanel}>
        <h3 style={s.panelTitle}>Install on Windows</h3>
        <p style={s.panelText}>
          Download the Oversight installer and run it to set up monitoring on this device.
        </p>
        <a href="/download/oversight-windows.bat" download="oversight-windows.bat" style={s.bigDownloadBtn}>
          <Icon name="download" size={18} color="#fff" />
          <span>Download Windows Installer</span>
        </a>
        <ol style={s.stepsList}>
          <li>Open your Downloads folder</li>
          <li>Right-click <code style={s.inlineCode}>oversight-windows.bat</code> → "Run as administrator"</li>
          <li>Enter the pairing code shown on your parent's device</li>
        </ol>
      </div>
    );
  }

  if (isLinux) {
    return (
      <div style={s.platformPanel}>
        <h3 style={s.panelTitle}>Install on Linux</h3>
        <p style={s.panelText}>
          Download the Linux agent and run it to set up monitoring on this device.
        </p>
        <a href="/download/oversight-linux.sh" download="oversight-linux.sh" style={s.bigDownloadBtn}>
          <Icon name="download" size={18} color="#fff" />
          <span>Download Linux Installer</span>
        </a>
        <ol style={s.stepsList}>
          <li>Open your Downloads folder</li>
          <li>Run: <code style={s.inlineCode}>bash oversight-linux.sh</code></li>
          <li>Enter the pairing code shown on your parent's device</li>
        </ol>
      </div>
    );
  }

  // Default: Mac
  return (
    <div style={s.platformPanel}>
      <h3 style={s.panelTitle}>Install on Mac</h3>
      <p style={s.panelText}>
        Download the Oversight installer and double-click it to set up monitoring on this Mac.
      </p>
      <a href="/download/oversight-mac.command" download="oversight-mac.command" style={s.bigDownloadBtn}>
        <Icon name="download" size={18} color="#fff" />
        <span>Download Mac Installer</span>
      </a>
      <ol style={s.stepsList}>
        <li>Open your Downloads folder</li>
        <li>Double-click <code style={s.inlineCode}>oversight-mac.command</code></li>
        <li>Click "Open" if macOS asks for permission</li>
        <li>Enter the pairing code shown on your parent's device</li>
      </ol>
    </div>
  );
}

function ParentPanel() {
  const navigate = useNavigate();

  let homeScreenTip = 'On iPhone/Android tap Share → Add to Home Screen for an app-like experience.';
  if (isMac || isWindows || isLinux) {
    homeScreenTip = 'In Chrome, click the install icon in the address bar to add Oversight as a desktop app.';
  } else if (isIOS) {
    homeScreenTip = 'Tap the Share button, then "Add to Home Screen" to install Oversight as an app.';
  } else if (isAndroid) {
    homeScreenTip = 'Tap the browser menu, then "Add to Home Screen" to install Oversight as an app.';
  }

  return (
    <div style={s.platformPanel}>
      <h3 style={s.panelTitle}>Welcome, Parent</h3>
      <p style={s.panelText}>The Oversight Dashboard is a web app — no download needed. Works on any device.</p>
      <div style={s.stepsListInline}>
        <div style={s.stepItem}><span style={s.stepNum}>1</span> Create an account</div>
        <div style={s.stepItem}><span style={s.stepNum}>2</span> Add your child's device</div>
        <div style={s.stepItem}><span style={s.stepNum}>3</span> Set controls &amp; relax</div>
      </div>
      <button onClick={() => navigate('/login')} style={{ ...s.bigDownloadBtnBtn, marginTop: 24 }}>
        Open Dashboard →
      </button>
      <p style={s.pwaTip}>
        {homeScreenTip}
      </p>
    </div>
  );
}

function RoleModal({ onClose }) {
  const [view, setView] = useState('choose'); // 'choose' | 'parent' | 'child'

  return (
    <div style={s.modalCard}>
      {view === 'choose' && (
        <>
          <h2 style={s.modalTitle}>Who are you?</h2>
          <div style={s.roleRow}>
            <button style={s.roleCard} onClick={() => setView('parent')}>
              <span style={s.roleIconWrap}><Icon name="users" size={36} color="#818cf8" /></span>
              <h3 style={s.roleCardTitle}>I'm a Parent</h3>
              <p style={s.roleCardDesc}>Manage your child's device from the web dashboard — works on any device</p>
            </button>
            <button style={s.roleCard} onClick={() => setView('child')}>
              <span style={s.roleIconWrap}><Icon name="smartphone" size={36} color="#818cf8" /></span>
              <h3 style={s.roleCardTitle}>I'm a Child</h3>
              <p style={s.roleCardDesc}>This is the device to monitor — install the agent here</p>
            </button>
          </div>
          <button style={s.closeBtn} onClick={onClose}>
            <Icon name="x" size={14} color="#9ca3af" /> Close
          </button>
        </>
      )}

      {view === 'parent' && (
        <>
          <h2 style={s.modalTitle}>Install the Dashboard</h2>
          <ParentPanel />
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
          <Icon name="eye" size={28} color="#818cf8" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={s.navLogoText}>Oversight</span>
            <span style={{ fontSize: 9, color: '#6366f1', letterSpacing: 1 }}>BY BIGHAPPYSMILEY</span>
          </div>
        </div>
        <div style={s.navLinks}>
          <button onClick={() => navigate('/login')} style={s.navBtn}>Sign In</button>
          <button onClick={() => navigate('/login')} style={s.navBtnOutline}>Create Account</button>
        </div>
      </header>

      {/* Hero */}
      <section style={s.hero}>
        <div style={{ marginBottom: 16 }}>
          <Icon name="eye" size={56} color="#818cf8" />
        </div>
        <h1 style={s.heroTitle}>Oversight</h1>
        <p style={{ margin: '2px 0 16px', fontSize: 12, color: '#6366f1', letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase' }}>BY BIGHAPPYSMILEY</p>
        <span style={s.badge}>Complete parental controls for every device</span>
        <p style={s.heroSub}>
          Monitor usage, block sites, set time limits, and view live screenshots — all from one dashboard. Works on Mac, Windows, Linux, iOS &amp; Android.
        </p>

        <button onClick={() => setShowModal(!showModal)} style={{ ...s.ctaPrimary, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <Icon name="download" size={18} color="#fff" />
          <span>Download Oversight</span>
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
              <span style={s.featureIconWrap}><Icon name={f.icon} size={32} color="#818cf8" /></span>
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
            { icon: 'apple', label: 'Mac', status: 'Available' },
            { icon: 'windows', label: 'Windows', status: 'Available' },
            { icon: 'linux', label: 'Linux', status: 'Available' },
            { icon: 'ios', label: 'iOS', status: 'DNS Filter' },
            { icon: 'android', label: 'Android', status: 'Available' },
          ].map(p => (
            <div key={p.label} style={s.platformCard}>
              <Icon name={p.icon} size={32} color="#a5b4fc" />
              <span style={s.platformLabel}>{p.label}</span>
              <span style={{ fontSize: 13, color: '#4ade80' }}>{p.status}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={s.footer}>
        <button onClick={() => navigate('/login')} style={s.footerLink}>Sign In</button>
        <span style={{ color: '#4b5563' }}> · </span>
        <button onClick={() => navigate('/login')} style={s.footerLink}>Create Account</button>
        <span style={{ display: 'block', marginTop: 12, color: '#4b5563', fontSize: 12 }}>© 2025 Oversight by BigHappySmiley. Built for families.</span>
      </footer>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#0f0f23', fontFamily: 'system-ui, sans-serif', color: '#f1f5f9' },

  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid #1e1e3a', position: 'sticky', top: 0, background: '#0f0f23', zIndex: 20 },
  navLogo: { display: 'flex', alignItems: 'center', gap: 10 },
  navLogoText: { fontSize: 20, fontWeight: 700, color: '#e0e7ff', lineHeight: 1 },
  navLinks: { display: 'flex', gap: 12, alignItems: 'center' },
  navBtn: { padding: '8px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  navBtnOutline: { padding: '8px 20px', background: 'transparent', color: '#a5b4fc', border: '1px solid #4f46e5', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },

  hero: { textAlign: 'center', padding: '80px 24px 60px', maxWidth: 760, margin: '0 auto' },
  badge: { display: 'inline-block', background: '#1e1b4b', color: '#a5b4fc', padding: '4px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, marginBottom: 24, border: '1px solid #312e81' },
  heroTitle: { fontSize: 54, fontWeight: 800, lineHeight: 1.15, color: '#e0e7ff', margin: '0 0 4px' },
  heroSub: { fontSize: 18, color: '#94a3b8', margin: '16px 0 40px', lineHeight: 1.7 },

  ctaPrimary: { padding: '16px 36px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 17 },

  bigDownloadBtn: { display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 16, textDecoration: 'none', marginTop: 8 },
  bigDownloadBtnBtn: { display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 16 },

  modalWrapper: { marginTop: 32, textAlign: 'left', animation: 'fadeIn 0.2s ease' },
  modalCard: { background: '#16162a', border: '1px solid #2d2b55', borderRadius: 16, padding: '32px', maxWidth: 700, margin: '0 auto' },
  modalTitle: { fontSize: 22, fontWeight: 700, color: '#e0e7ff', margin: '0 0 24px' },

  roleRow: { display: 'flex', gap: 20, flexWrap: 'wrap' },
  roleCard: { flex: '1 1 200px', background: '#1e1e3a', border: '2px solid #312e81', borderRadius: 12, padding: '24px', cursor: 'pointer', textAlign: 'left', color: '#f1f5f9', transition: 'border-color 0.15s' },
  roleIconWrap: { display: 'block', marginBottom: 12 },
  roleCardTitle: { fontSize: 17, fontWeight: 700, color: '#e0e7ff', margin: '0 0 8px' },
  roleCardDesc: { fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.6 },

  closeBtn: { marginTop: 20, background: 'transparent', border: '1px solid #374151', color: '#9ca3af', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 },
  backBtn: { marginTop: 20, background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 14, padding: 0 },

  stepsListInline: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 },
  stepItem: { display: 'flex', alignItems: 'center', gap: 12, color: '#cbd5e1' },
  stepNum: { width: 28, height: 28, borderRadius: '50%', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  pwaTip: { marginTop: 20, fontSize: 13, color: '#64748b', lineHeight: 1.6, fontStyle: 'italic' },

  platformPanel: { marginTop: 8 },
  panelTitle: { fontSize: 18, fontWeight: 700, color: '#e0e7ff', margin: '0 0 12px' },
  panelText: { fontSize: 14, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.6 },
  noteText: { fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: '8px 0 0', fontStyle: 'italic' },

  inlineCode: { fontFamily: 'monospace', fontSize: 12, background: '#1e1e3a', color: '#a5b4fc', padding: '2px 6px', borderRadius: 4 },

  stepsList: { color: '#94a3b8', fontSize: 14, lineHeight: 2.2, paddingLeft: 20, margin: '16px 0 0' },

  section: { padding: '80px 48px', maxWidth: 1100, margin: '0 auto' },
  sectionTitle: { textAlign: 'center', fontSize: 30, fontWeight: 700, color: '#e0e7ff', margin: '0 0 48px' },
  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 },
  featureCard: { background: '#16162a', borderRadius: 12, padding: 28, border: '1px solid #2d2b55' },
  featureIconWrap: { display: 'block', marginBottom: 12 },
  featureTitle: { fontSize: 17, fontWeight: 700, color: '#e0e7ff', margin: '0 0 8px' },
  featureDesc: { fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.6 },

  platformSection: { padding: '60px 48px', background: '#0a0a1a', textAlign: 'center' },
  platformRow: { display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' },
  platformCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  platformLabel: { fontSize: 14, fontWeight: 600, color: '#cbd5e1' },

  footer: { textAlign: 'center', padding: '32px 24px', borderTop: '1px solid #1e1e3a' },
  footerLink: { background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 14, fontWeight: 500 },
};
