'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useDevice } from '@/components/DeviceProvider';
import DevicePicker from '@/components/DevicePicker';

const PRESET_CATEGORIES = [
  { id: 'social', label: 'Social Media', domains: ['facebook.com', 'instagram.com', 'tiktok.com', 'snapchat.com', 'twitter.com', 'x.com'] },
  { id: 'gaming', label: 'Gaming Sites', domains: ['roblox.com', 'minecraft.net', 'fortnite.com', 'steampowered.com'] },
  { id: 'video', label: 'Video Streaming', domains: ['youtube.com', 'netflix.com', 'twitch.tv', 'disneyplus.com'] },
];

export default function RestrictionsPage() {
  const { selected } = useDevice();
  const [restrictions, setRestrictions] = useState<any>({ mode: 'blocklist', domains: [] });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.getSettings(selected.id)
      .then((s) => setRestrictions(s.website_restrictions))
      .finally(() => setLoading(false));
  }, [selected]);

  async function save(updated: any) {
    try {
      await api.updateSettings(selected!.id, { website_restrictions: updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }

  function addDomain() {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!d || restrictions.domains.includes(d)) return;
    const updated = { ...restrictions, domains: [...restrictions.domains, d] };
    setRestrictions(updated); save(updated); setNewDomain('');
  }

  function removeDomain(domain: string) {
    const updated = { ...restrictions, domains: restrictions.domains.filter((d: string) => d !== domain) };
    setRestrictions(updated); save(updated);
  }

  function addPreset(preset: typeof PRESET_CATEGORIES[0]) {
    const newDomains = preset.domains.filter((d) => !restrictions.domains.includes(d));
    if (newDomains.length === 0) return;
    const updated = { ...restrictions, domains: [...restrictions.domains, ...newDomains] };
    setRestrictions(updated); save(updated);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(''); setImportError('');
    try {
      const result = await api.importDomains(selected!.id, file);
      setImportMsg(`Added ${result.added} domains (${result.total} total)`);
      const s = await api.getSettings(selected!.id);
      setRestrictions(s.website_restrictions);
    } catch (err: any) {
      setImportError(err.message);
    }
    e.target.value = '';
  }

  function setMode(mode: string) {
    const updated = { ...restrictions, mode };
    setRestrictions(updated); save(updated);
  }

  if (!selected) return <p style={{ color: '#6b7280' }}>Select a device first.</p>;

  return (
    <div>
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.title}>Website Filter</h2>
          <p style={styles.subtitle}>Block or allow specific websites. Changes apply within 60 seconds on the child's device.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && <span style={styles.savedBadge}>Saved</span>}
          <DevicePicker />
        </div>
      </div>

      {loading ? <p>Loading...</p> : (
        <>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Filter Mode</h3>
            <div style={styles.modeRow}>
              <ModeCard active={restrictions.mode === 'blocklist'} title="Blocklist" desc="All sites allowed except those on the list below." onClick={() => setMode('blocklist')} />
              <ModeCard active={restrictions.mode === 'allowlist'} title="Allowlist" desc="All sites blocked except those on the list below." onClick={() => setMode('allowlist')} />
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Import from File</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
              Upload a spreadsheet with one domain per row (first column). First row is treated as a header and skipped.
              Accepted: <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>.
            </p>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} style={{ fontSize: 14 }} />
            {importMsg && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#166534', background: '#dcfce7', padding: '8px 12px', borderRadius: 6 }}>{importMsg}</p>}
            {importError && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>{importError}</p>}
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Quick Presets</h3>
            <div style={styles.presetRow}>
              {PRESET_CATEGORIES.map((preset) => (
                <button key={preset.id} onClick={() => addPreset(preset)} style={styles.presetBtn}>
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>
              {restrictions.mode === 'blocklist' ? 'Blocked Domains' : 'Allowed Domains'}
            </h3>
            <div style={styles.addRow}>
              <input style={styles.input} placeholder="e.g. youtube.com" value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDomain()} />
              <button onClick={addDomain} style={styles.btn}>Add</button>
            </div>
            {restrictions.domains.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 14 }}>No domains in the list.</p>
            ) : (
              <div style={styles.domainList}>
                {restrictions.domains.map((domain: string) => (
                  <div key={domain} style={styles.domainRow}>
                    <span style={styles.domain}>{domain}</span>
                    <button onClick={() => removeDomain(domain)} style={styles.removeBtn}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ModeCard({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ ...styles.modeCard, border: active ? '2px solid #4f46e5' : '2px solid #e5e7eb', background: active ? '#f5f3ff' : '#fff', cursor: 'pointer' }}>
      <div>
        <div style={{ fontWeight: 600, color: active ? '#4f46e5' : '#111827', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{desc}</div>
      </div>
      {active && <span style={styles.check}>✓</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { margin: '0 0 4px', fontSize: 24, fontWeight: 700 },
  subtitle: { margin: 0, color: '#6b7280', fontSize: 14 },
  savedBadge: { background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 99, fontSize: 13, fontWeight: 500 },
  card: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  sectionTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#1e1b4b' },
  modeRow: { display: 'flex', gap: 16 },
  modeCard: { flex: 1, display: 'flex', alignItems: 'flex-start', gap: 14, padding: 16, borderRadius: 10, position: 'relative' },
  check: { position: 'absolute', top: 12, right: 14, color: '#4f46e5', fontWeight: 700, fontSize: 16 },
  presetRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  presetBtn: { padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 99, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' },
  addRow: { display: 'flex', gap: 12, marginBottom: 16 },
  input: { flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 },
  btn: { padding: '9px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  domainList: { display: 'flex', flexDirection: 'column', gap: 4 },
  domainRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 8 },
  domain: { flex: 1, fontSize: 14, color: '#374151', fontFamily: 'monospace' },
  removeBtn: { background: 'none', border: '1px solid #fca5a5', color: '#ef4444', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
};
