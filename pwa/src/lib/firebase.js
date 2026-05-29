import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
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

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const isFirebaseConfigured = true;
export { onAuthStateChanged };

export async function firebaseRegister(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  const token = await cred.user.getIdToken();
  return {
    token,
    parent: { id: cred.user.uid, email: cred.user.email, name },
  };
}

export async function firebaseLogin(email, password) {
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
  await signOut(auth);
}
