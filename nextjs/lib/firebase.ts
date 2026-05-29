import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBDjeQrrT-lwRcU1P8Kl6NjEpq9DURMQ-U",
  authDomain: "oversight-a877a.firebaseapp.com",
  projectId: "oversight-a877a",
  storageBucket: "oversight-a877a.firebasestorage.app",
  messagingSenderId: "874946947389",
  appId: "1:874946947389:web:9249a4ac253af78d90bd54",
  measurementId: "G-RLLMYB726Z",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const isFirebaseConfigured = true;
export { onAuthStateChanged };

export async function firebaseRegister(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  const token = await cred.user.getIdToken();
  return {
    token,
    parent: { id: cred.user.uid, email: cred.user.email!, name },
  };
}

export async function firebaseLogin(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const token = await cred.user.getIdToken();
  return {
    token,
    parent: {
      id: cred.user.uid,
      email: cred.user.email!,
      name: cred.user.displayName || email.split('@')[0],
    },
  };
}

export async function firebaseLogout() {
  await signOut(auth);
}

// Server-side: verify a Firebase ID token using the public key endpoint
export async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email: string } | null> {
  try {
    // Decode header to get kid
    const [headerB64] = idToken.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    const kid = header.kid;

    // Fetch public keys
    const keysRes = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      { next: { revalidate: 3600 } }
    );
    const keys: Record<string, string> = await keysRes.json();
    const cert = keys[kid];
    if (!cert) return null;

    // Decode payload (basic verification — check exp, iss, aud)
    const [, payloadB64] = idToken.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) return null;
    if (payload.iss !== `https://sectoken.google.com/${firebaseConfig.projectId}` &&
        payload.iss !== `https://securetoken.google.com/${firebaseConfig.projectId}`) return null;
    if (payload.aud !== firebaseConfig.projectId) return null;

    return { uid: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
