import { getApps, initializeApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = 'oversight-a877a';

let app: App;

if (getApps().length === 0) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const serviceAccount = JSON.parse(raw);
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  } else {
    console.warn(
      '[firestore] FIREBASE_SERVICE_ACCOUNT is not set. Falling back to applicationDefault() credentials. ' +
        'Set FIREBASE_SERVICE_ACCOUNT (the service account JSON as a single-line string) in production.'
    );
    app = initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
    });
  }
} else {
  app = getApps()[0];
}

export const db = getFirestore(app);
export const auth = getAuth(app);

// Default settings document shape used when a device has no settings yet.
export const DEFAULT_SETTINGS = {
  app_limits: [] as any[],
  downtime: { enabled: false, start: '22:00', end: '07:00', allowed_apps: [] as string[] },
  website_restrictions: { mode: 'blocklist', domains: [] as string[] },
};

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// Fetch a device by id, verifying it belongs to parentId. Returns null if not.
export async function getOwnedDevice(deviceId: string, parentId: string) {
  const snap = await db.collection('devices').doc(deviceId).get();
  if (!snap.exists || snap.data()?.parent_id !== parentId) return null;
  return { id: snap.id, ...snap.data() } as any;
}

// Fetch a device by its agent token. Returns null if unknown.
export async function getDeviceByToken(token: string) {
  const snap = await db.collection('devices').where('token', '==', token).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as any;
}

// Delete every document in `collection` matching device_id == deviceId.
export async function deleteByDevice(collection: string, deviceId: string): Promise<void> {
  const snap = await db.collection(collection).where('device_id', '==', deviceId).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (!snap.empty) await batch.commit();
}
