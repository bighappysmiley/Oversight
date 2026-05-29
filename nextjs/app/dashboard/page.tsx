'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '@/lib/api';
import { useDevice } from '@/components/DeviceProvider';
import DevicePicker from '@/components/DevicePicker';
import Icon from '@/components/Icon';

const COLORS = ['#4f46e5', '#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777'];

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function DashboardPage() {
  const { selected } = useDevice();
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.getUsage(selected.id)
      .then(setUsage)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selected]);

  if (!selected) {
    return (
      <div>
        <h2 style={styles.pageTitle}>Dashboard</h2>
        <div style={styles.empty}>
          <p>No devices added yet. <a href="/dashboard/add-device">Add a device</a> to get started.</p>
        </div>
      </div>
    );
  }

  const appTotals: Record<string, number> = {};
  for (const row of (usage?.app_usage || [])) {
    appTotals[row.app_name] = (appTotals[row.app_name] || 0) + row.total_seconds;
  }
  const topApps = Object.entries(appTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, secs]) => ({ name, seconds: secs, label: formatTime(secs) }));

  const dailyTotals: Record<string, number> = {};
  for (const row of (usage?.app_usage || [])) {
    dailyTotals[row.date] = (dailyTotals[row.date] || 0) + row.total_seconds;
  }
  const dailyData = Object.entries(dailyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, secs]) => ({ date: date.slice(5), minutes: Math.round(secs / 60) }));

  const webTotals: Record<string, number> = {};
  for (const row of (usage?.web_usage || [])) {
    webTotals[row.domain] = (webTotals[row.domain] || 0) + row.total_visits;
  }
  const topSites = Object.entries(webTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([domain, visits]) => ({ domain, visits }));

  const totalScreenTime = Object.values(appTotals).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div style={styles.topBar}>
        <h2 style={styles.pageTitle}>Dashboard</h2>
        <DevicePicker />
      </div>

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading usage data...</p>
      ) : (
        <>
          <div style={styles.statRow}>
            <StatCard label="Total Screen Time (7d)" value={formatTime(totalScreenTime)} icon="smartphone" />
            <StatCard label="Apps Used" value={String(Object.keys(appTotals).length)} icon="monitor" />
            <StatCard label="Sites Visited" value={String(Object.keys(webTotals).length)} icon="globe" />
            <StatCard label="Days Tracked" value={String(dailyData.length)} icon="barChart" />
          </div>

          <div style={styles.chartRow}>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>Daily Screen Time (minutes)</h3>
              {dailyData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => [`${v} min`, 'Screen time']} />
                    <Bar dataKey="minutes" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>Top Apps</h3>
              {topApps.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={topApps} dataKey="seconds" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }: any) => name.slice(0, 10)}>
                      {topApps.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatTime(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>App Usage Breakdown</h3>
            {topApps.length === 0 ? <EmptyChart /> : (
              <div style={styles.appList}>
                {topApps.map((app, i) => (
                  <div key={app.name} style={styles.appRow}>
                    <span style={{ ...styles.dot, background: COLORS[i % COLORS.length] }} />
                    <span style={styles.appName}>{app.name}</span>
                    <div style={styles.barWrap}>
                      <div style={{ ...styles.bar, width: `${(app.seconds / topApps[0].seconds) * 100}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                    <span style={styles.appTime}>{app.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {topSites.length > 0 && (
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>Top Websites</h3>
              <div style={styles.appList}>
                {topSites.map((site, i) => (
                  <div key={site.domain} style={styles.appRow}>
                    <span style={{ ...styles.dot, background: COLORS[i % COLORS.length] }} />
                    <span style={styles.appName}>{site.domain}</span>
                    <span style={styles.appTime}>{site.visits} visits</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div style={styles.statCard}>
      <Icon name={icon} size={28} color="#4f46e5" />
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No data yet — install the agent to start tracking.</p>;
}

const styles: Record<string, React.CSSProperties> = {
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  pageTitle: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  statCard: { background: '#fff', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  statValue: { fontSize: 24, fontWeight: 700, color: '#1e1b4b' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  chartRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  chartCard: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 },
  chartTitle: { margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#374151' },
  appList: { display: 'flex', flexDirection: 'column', gap: 10 },
  appRow: { display: 'flex', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  appName: { width: 160, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barWrap: { flex: 1, background: '#f3f4f6', borderRadius: 4, height: 8, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  appTime: { width: 60, textAlign: 'right', fontSize: 13, color: '#6b7280' },
  empty: { background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#6b7280' },
};
