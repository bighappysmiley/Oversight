import { useNavigate } from 'react-router-dom';

const isMac = navigator.platform.includes('Mac') || navigator.userAgent.includes('Macintosh');
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const FEATURES = [
  { icon: '🔒', title: 'Website Blocking', desc: 'Block distracting or harmful sites with a blocklist or strict allowlist.' },
  { icon: '⏱️', title: 'App Limits', desc: 'Set daily time limits for any app. Oversight enforces them automatically.' },
  { icon: '🌙', title: 'Downtime', desc: 'Schedule screen-free hours so kids can sleep and focus.' },
  { icon: '📊', title: 'Usage Reports', desc: 'See exactly which apps and sites your child uses every day.' },
  { icon: '🖥️', title: 'Live Screen View', desc: 'View a real-time screenshot of your child\'s Mac from anywhere.' },
  { icon: '📋', title: 'Import from Excel', desc: 'Paste or import entire domain blocklists from a spreadsheet.' },
];

const STEPS = [
  { n: 1, title: 'Create your account', desc: 'Sign up for free and set up your parent profile.' },
  { n: 2, title: 'Pair your child\'s Mac', desc: 'Generate a pairing code and enter it on the Mac Agent — no tokens to copy.' },
  { n: 3, title: 'Set rules & relax', desc: 'Configure limits, blocks, and downtime. Oversight enforces them silently.' },
];

export default function Landing() {
  const navigate = useNavigate();

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
        </div>
      </header>

      {/* Hero */}
      <section style={s.hero}>
        <span style={s.badge}>Apple-first parental controls</span>
        <h1 style={s.heroTitle}>The most powerful parental controls<br />for Apple devices</h1>
        <p style={s.heroSub}>
          {isIOS
            ? 'iOS app coming soon — sign in to the web dashboard to manage your child\'s Mac from your iPhone or iPad.'
            : 'Monitor usage, block sites, set time limits, and view live screenshots — all from one dashboard.'}
        </p>

        {isMac && !isIOS && (
          <div style={s.heroCtas}>
            <a href="/download/mac" style={s.ctaPrimary}>Download for Mac</a>
            <button onClick={() => navigate('/login')} style={s.ctaSecondary}>or use the web dashboard →</button>
          </div>
        )}

        {isIOS && (
          <div style={s.heroCtas}>
            <button onClick={() => navigate('/login')} style={s.ctaPrimary}>Open Web Dashboard</button>
          </div>
        )}

        {!isMac && !isIOS && (
          <div style={s.heroCtas}>
            <button onClick={() => navigate('/login')} style={s.ctaPrimary}>Get Started Free</button>
            <a href="/download/mac" style={s.ctaSecondary}>Download Mac Agent</a>
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

      {/* Steps */}
      <section style={{ ...s.section, background: '#f5f3ff' }}>
        <h2 style={s.sectionTitle}>Get started in 3 steps</h2>
        <div style={s.stepsRow}>
          {STEPS.map((step) => (
            <div key={step.n} style={s.stepCard}>
              <div style={s.stepNumber}>{step.n}</div>
              <h3 style={s.stepTitle}>{step.title}</h3>
              <p style={s.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={s.bottomCta}>
        <h2 style={{ ...s.heroTitle, fontSize: 32 }}>Ready to get started?</h2>
        <p style={{ ...s.heroSub, marginBottom: 32 }}>Join families using Oversight to create healthier screen habits.</p>
        <div style={s.heroCtas}>
          <button onClick={() => navigate('/login')} style={s.ctaPrimary}>Sign In</button>
          <button onClick={() => navigate('/login')} style={{ ...s.ctaSecondary, border: '1px solid #c7d2fe', padding: '12px 28px' }}>Create Account</button>
        </div>
      </section>

      <footer style={s.footer}>
        <span>© 2025 Oversight. Built for families.</span>
      </footer>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#fff', fontFamily: 'system-ui, sans-serif', color: '#111827' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 0, background: '#fff', zIndex: 10 },
  navLogo: { display: 'flex', alignItems: 'center', gap: 10 },
  navLogoText: { fontSize: 20, fontWeight: 700, color: '#1e1b4b' },
  navLinks: { display: 'flex', gap: 12, alignItems: 'center' },
  navBtn: { padding: '8px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  hero: { textAlign: 'center', padding: '80px 24px 60px', maxWidth: 760, margin: '0 auto' },
  badge: { display: 'inline-block', background: '#ede9fe', color: '#6d28d9', padding: '4px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600, marginBottom: 20 },
  heroTitle: { fontSize: 48, fontWeight: 800, lineHeight: 1.15, color: '#1e1b4b', margin: '0 0 20px' },
  heroSub: { fontSize: 18, color: '#6b7280', margin: '0 0 36px', lineHeight: 1.6 },
  heroCtas: { display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' },
  ctaPrimary: { padding: '14px 32px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 16, textDecoration: 'none', display: 'inline-block' },
  ctaSecondary: { padding: '14px 24px', background: 'transparent', color: '#4f46e5', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 15, textDecoration: 'none' },
  section: { padding: '64px 48px', maxWidth: 1100, margin: '0 auto' },
  sectionTitle: { textAlign: 'center', fontSize: 30, fontWeight: 700, color: '#1e1b4b', margin: '0 0 40px' },
  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 },
  featureCard: { background: '#f9fafb', borderRadius: 12, padding: 28, border: '1px solid #f3f4f6' },
  featureIcon: { fontSize: 32, display: 'block', marginBottom: 12 },
  featureTitle: { fontSize: 17, fontWeight: 700, color: '#1e1b4b', margin: '0 0 8px' },
  featureDesc: { fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 },
  stepsRow: { display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' },
  stepCard: { flex: '1 1 220px', maxWidth: 300, textAlign: 'center', padding: '32px 24px', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  stepNumber: { width: 48, height: 48, borderRadius: '50%', background: '#4f46e5', color: '#fff', fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  stepTitle: { fontSize: 17, fontWeight: 700, color: '#1e1b4b', margin: '0 0 8px' },
  stepDesc: { fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 },
  bottomCta: { textAlign: 'center', padding: '80px 24px', background: '#1e1b4b' },
  footer: { textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: 13, borderTop: '1px solid #f3f4f6' },
};
