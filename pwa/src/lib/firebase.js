import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';

// Paste your Firebase project config here.
// Go to: Firebase Console → Project Settings → Your apps → Web app → SDK setup
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app, auth;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export { auth, onAuthStateChanged };

export async function firebaseRegister(email, password, name) {
  if (!isFirebaseConfigured) throw new Error('Firebase not configured');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  const token = await cred.user.getIdToken();
  return {
    token,
    parent: { id: cred.user.uid, email: cred.user.email, name },
  };
}

export async function firebaseLogin(email, password) {
  if (!isFirebaseConfigured) throw new Error('Firebase not configured');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const token = await cred.user.getIdToken();
  return {
    token,
    parent: {
      id: cred.user.uid,
      email: cred.user.email,
      name: cred.user.displayName || email.split('@')[0],
    },
  };
}

export async function firebaseLogout() {
  if (auth) await signOut(auth);
}
