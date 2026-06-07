// Builds an Apple configuration profile (.mobileconfig) from a content policy.
//
// Works across iOS, iPadOS and macOS (installed via Safari on iOS/iPadOS, or by
// double-clicking on macOS). Filtering comes from:
//   • a managed DNS-over-HTTPS payload pointing at a family-safe resolver
//     (works on iOS 14+/macOS 11+, even unsupervised), and
//   • Apple's BuiltIn web content filter (iOS/iPadOS only) for explicit sites,
//     plus the parent's custom block/allow lists.
// On iOS/iPadOS a profile-removal password keeps a child from deleting it.
import crypto from 'node:crypto';
import { SOCIAL_MEDIA_DOMAINS, SAFE_DNS } from './util.js';

const uuid = () => crypto.randomUUID().toUpperCase();

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function plistValue(v, indent) {
  const inner = indent + '\t';
  if (Array.isArray(v)) {
    if (v.length === 0) return '<array/>';
    return '<array>\n' + v.map((x) => inner + plistValue(x, inner)).join('\n') + '\n' + indent + '</array>';
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 0) return '<dict/>';
    return (
      '<dict>\n' +
      keys.map((k) => inner + '<key>' + esc(k) + '</key>\n' + inner + plistValue(v[k], inner)).join('\n') +
      '\n' + indent + '</dict>'
    );
  }
  if (typeof v === 'boolean') return v ? '<true/>' : '<false/>';
  if (typeof v === 'number') return Number.isInteger(v) ? `<integer>${v}</integer>` : `<real>${v}</real>`;
  return `<string>${esc(v)}</string>`;
}

function urlForms(domain) {
  const d = domain.replace(/^www\./, '');
  return [`https://${d}`, `http://${d}`, `https://www.${d}`, `http://www.${d}`];
}

function dnsPayload(suffix) {
  return {
    PayloadType: 'com.apple.dnsSettings.managed',
    PayloadVersion: 1,
    PayloadIdentifier: `com.oversight.dns.${suffix}`,
    PayloadUUID: uuid(),
    PayloadDisplayName: 'Oversight Safe DNS',
    PayloadDescription: 'Routes DNS through a family-safe resolver that blocks adult content.',
    DNSSettings: {
      DNSProtocol: 'HTTPS',
      ServerURL: SAFE_DNS.doh,
      ServerAddresses: [...SAFE_DNS.v4, ...SAFE_DNS.v6],
    },
  };
}

function webFilterPayload(suffix, policy) {
  const blocked = new Set(policy.blockedDomains || []);
  if (policy.blockSocialMedia) for (const d of SOCIAL_MEDIA_DOMAINS) blocked.add(d);
  const allowed = policy.allowedDomains || [];

  const wf = {
    PayloadType: 'com.apple.webcontent-filter',
    PayloadVersion: 1,
    PayloadIdentifier: `com.oversight.webfilter.${suffix}`,
    PayloadUUID: uuid(),
    PayloadDisplayName: 'Oversight Web Content Filter',
    FilterType: 'BuiltIn',
    AutoFilterEnabled: !!policy.filterAdultContent,
  };
  if (policy.mode === 'allowlist') {
    wf.WhitelistedBookmarks = allowed.map((d) => ({ URL: `https://${d}`, Title: d }));
  } else {
    const blacklist = [];
    for (const d of blocked) blacklist.push(...urlForms(d));
    const permitted = [];
    for (const d of allowed) permitted.push(...urlForms(d));
    if (blacklist.length) wf.BlacklistedURLs = blacklist;
    if (permitted.length) wf.PermittedURLs = permitted;
  }
  return wf;
}

export function buildProfile({ org = 'Oversight', suffix, removalPassword, policy, platform = 'ios' }) {
  const isMac = platform === 'macos';
  const content = [];

  // DNS filtering works on every Apple platform.
  if (policy.safeDns !== false) content.push(dnsPayload(suffix));

  if (!isMac) {
    // iOS / iPadOS: built-in web filter + restrictions + removal password.
    content.push(webFilterPayload(suffix, policy));
    content.push({
      PayloadType: 'com.apple.applicationaccess',
      PayloadVersion: 1,
      PayloadIdentifier: `com.oversight.restrictions.${suffix}`,
      PayloadUUID: uuid(),
      PayloadDisplayName: 'Oversight Restrictions',
      allowExplicitContent: false,
      forceAssistantProfanityFilter: true,
      ...(policy.blockAppStore ? { allowAppInstallation: false, allowUIAppInstallation: false } : {}),
    });
    if (removalPassword) {
      content.push({
        PayloadType: 'com.apple.profileRemovalPassword',
        PayloadVersion: 1,
        PayloadIdentifier: `com.oversight.removal.${suffix}`,
        PayloadUUID: uuid(),
        PayloadDisplayName: 'Profile Removal Password',
        RemovalPassword: removalPassword,
      });
    }
  }

  const root = {
    PayloadContent: content,
    PayloadDisplayName: 'Oversight Protection',
    PayloadDescription: isMac
      ? 'Family-safe DNS filtering managed by a parent through Oversight.'
      : 'Web content filtering and device protection managed by a parent through Oversight. Removing this profile requires the parent password.',
    PayloadIdentifier: `com.oversight.profile.${suffix}`,
    PayloadOrganization: org,
    PayloadRemovalDisallowed: false,
    PayloadType: 'Configuration',
    PayloadUUID: uuid(),
    PayloadVersion: 1,
    PayloadScope: 'System',
    ConsentText: {
      default: 'Oversight protects this device with family-safe filtering. It is managed by a parent.',
    },
  };

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    '<plist version="1.0">\n' +
    plistValue(root, '') +
    '\n</plist>\n'
  );
}
