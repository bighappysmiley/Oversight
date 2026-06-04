// Builds an Apple configuration profile (.mobileconfig) from a content policy.
//
// The profile uses Apple's BuiltIn web content filter (which works on
// unsupervised devices installed via Safari) plus a profile removal password
// so a child cannot remove the protection without the parent's password.
import crypto from 'node:crypto';
import { SOCIAL_MEDIA_DOMAINS } from './util.js';

const uuid = () => crypto.randomUUID().toUpperCase();

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Minimal Apple plist serializer (dict / array / string / bool / integer).
function plistValue(v, indent) {
  const pad = indent;
  const inner = indent + '\t';
  if (Array.isArray(v)) {
    if (v.length === 0) return '<array/>';
    return (
      '<array>\n' +
      v.map((x) => inner + plistValue(x, inner)).join('\n') +
      '\n' + pad + '</array>'
    );
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 0) return '<dict/>';
    return (
      '<dict>\n' +
      keys
        .map(
          (k) =>
            inner + '<key>' + esc(k) + '</key>\n' + inner + plistValue(v[k], inner)
        )
        .join('\n') +
      '\n' + pad + '</dict>'
    );
  }
  if (typeof v === 'boolean') return v ? '<true/>' : '<false/>';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? `<integer>${v}</integer>` : `<real>${v}</real>`;
  }
  return `<string>${esc(v)}</string>`;
}

// Expand a bare domain into the URL forms Apple's filter matches against.
function urlForms(domain) {
  const d = domain.replace(/^www\./, '');
  return [
    `https://${d}`,
    `http://${d}`,
    `https://www.${d}`,
    `http://www.${d}`,
  ];
}

export function buildProfile({ org = 'Oversight', suffix, removalPassword, policy }) {
  const blocked = new Set(policy.blockedDomains || []);
  if (policy.blockSocialMedia) {
    for (const d of SOCIAL_MEDIA_DOMAINS) blocked.add(d);
  }
  const allowed = policy.allowedDomains || [];

  const webFilter = {
    PayloadType: 'com.apple.webcontent-filter',
    PayloadVersion: 1,
    PayloadIdentifier: `com.oversight.webfilter.${suffix}`,
    PayloadUUID: uuid(),
    PayloadDisplayName: 'Oversight Web Content Filter',
    PayloadDescription: 'Filters web content on this device.',
    FilterType: 'BuiltIn',
    AutoFilterEnabled: !!policy.filterAdultContent,
  };

  if (policy.mode === 'allowlist') {
    // Allowlist mode: only these sites are reachable.
    webFilter.WhitelistedBookmarks = allowed.map((d) => ({
      URL: `https://${d}`,
      Title: d,
    }));
  } else {
    // Blocklist mode: auto-filter plus explicit blocks and allowances.
    const blacklist = [];
    for (const d of blocked) blacklist.push(...urlForms(d));
    const permitted = [];
    for (const d of allowed) permitted.push(...urlForms(d));
    if (blacklist.length) webFilter.BlacklistedURLs = blacklist;
    if (permitted.length) webFilter.PermittedURLs = permitted;
  }

  const restrictions = {
    PayloadType: 'com.apple.applicationaccess',
    PayloadVersion: 1,
    PayloadIdentifier: `com.oversight.restrictions.${suffix}`,
    PayloadUUID: uuid(),
    PayloadDisplayName: 'Oversight Restrictions',
    allowExplicitContent: false,
    forceAssistantProfanityFilter: true,
  };

  const removal = {
    PayloadType: 'com.apple.profileRemovalPassword',
    PayloadVersion: 1,
    PayloadIdentifier: `com.oversight.removal.${suffix}`,
    PayloadUUID: uuid(),
    PayloadDisplayName: 'Profile Removal Password',
    RemovalPassword: removalPassword,
  };

  const root = {
    PayloadContent: [webFilter, restrictions, removal],
    PayloadDisplayName: 'Oversight Protection',
    PayloadDescription:
      'Web content filtering and device protection managed by a parent through Oversight. Removing this profile requires the parent password.',
    PayloadIdentifier: `com.oversight.profile.${suffix}`,
    PayloadOrganization: org,
    PayloadRemovalDisallowed: false,
    PayloadType: 'Configuration',
    PayloadUUID: uuid(),
    PayloadVersion: 1,
    PayloadScope: 'System',
    ConsentText: {
      default:
        'Oversight protects this device with web content filtering. This profile is managed by a parent and can only be removed with the parent password.',
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
