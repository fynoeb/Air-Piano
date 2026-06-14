import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { Recording, StudentProfile } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// Connectivity validation helper as requested by the skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Custom high-fidelity Firestore Error Handling conforming to Attribute-Based Rules
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Convert input username to a robust email format for custom auth ease of use
export const convertUsernameToEmail = (username: string): string => {
  const sanitized = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${sanitized}@airpiano.com`;
};

// Check if a username registration already exists in our registries
export const checkUsernameExists = async (username: string): Promise<boolean> => {
  const sanitized = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!sanitized) return false;
  try {
    const docSnap = await getDoc(doc(db, 'usernames', sanitized));
    return docSnap.exists() && docSnap.data()?.registered === true;
  } catch (err) {
    console.error("Gagal memeriksa eksistensi nama pengguna:", err);
    return false;
  }
};

// Custom account creation logic - creates User Auth, Firestore user profile doc and registered username doc
export const registerUserAccount = async (form: {
  username: string;
  password?: string;
  fullName: string;
  nim: string;
  institution: string;
  classCode: string;
}): Promise<StudentProfile> => {
  const email = convertUsernameToEmail(form.username);
  const sanitizedUsername = form.username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  // Enforce password size for Firebase Auth or use a fallback
  const finalPassword = (form.password && form.password.length >= 6) 
    ? form.password 
    : `keyBoard_${form.nim}_Secret`;

  try {
    const response = await createUserWithEmailAndPassword(auth, email, finalPassword);
    const userId = response.user.uid;

    const userProfile: StudentProfile = {
      name: form.fullName,
      nim: form.nim,
      institution: form.institution,
      classCode: form.classCode,
    };

    const path = `users/${userId}`;
    try {
      await setDoc(doc(db, 'users', userId), {
        ...userProfile,
        createdAt: serverTimestamp()
      });
    } catch (dbErr) {
      handleFirestoreError(dbErr, OperationType.WRITE, path);
    }

    try {
      await setDoc(doc(db, 'usernames', sanitizedUsername), {
        uid: userId,
        registered: true,
        createdAt: serverTimestamp()
      });
    } catch (usernameErr) {
      console.error("Gagal mendaftarkan registry nama pengguna:", usernameErr);
    }

    return userProfile;
  } catch (authErr: any) {
    if (authErr.code === 'auth/email-already-in-use') {
      throw new Error("Username sudah terdaftar. Silahkan login.");
    }
    if (authErr.code === 'auth/weak-password') {
      throw new Error("Password terlalu lemah. Minimal sandi adalah 6 karakter.");
    }
    throw authErr;
  }
};

// Authenticate and fetch registered user profile from database
export const loginUserAccount = async (username: string, password?: string, fallbackNim?: string): Promise<StudentProfile> => {
  const email = convertUsernameToEmail(username);
  const finalPassword = (password && password.length >= 6) 
    ? password 
    : `keyBoard_${fallbackNim || '123'}_Secret`;

  const response = await signInWithEmailAndPassword(auth, email, finalPassword);
  const userId = response.user.uid;

  // Proactive backward-compatibility registry migration sync
  const sanitized = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (sanitized) {
    try {
      const usernameDocRef = doc(db, 'usernames', sanitized);
      const usernameDocSnap = await getDoc(usernameDocRef);
      if (!usernameDocSnap.exists()) {
        await setDoc(usernameDocRef, {
          uid: userId,
          registered: true,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.warn("Sinkronisasi nama pengguna tidak dilakukan atau gagal:", e);
    }
  }

  const path = `users/${userId}`;
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        name: data.name || 'Symphonia Artist',
        nim: data.nim || fallbackNim || '-',
        institution: data.institution || 'Universitas Andalas',
        classCode: data.classCode || 'UAS - Image Processing'
      };
    }
    throw new Error("Profil pengguna tidak ditemukan.");
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    throw err;
  }
};

// Save a music score/recording compositional details
export const saveDbComposition = async (recording: Omit<Recording, 'id' | 'createdAt'>) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Silahkan login untuk menyimpan rekaman.");

  const path = `users/${currentUser.uid}/compositions`;
  try {
    await addDoc(collection(db, 'users', currentUser.uid, 'compositions'), {
      title: recording.title,
      notes: recording.notes.map(n => ({
        note: n.note,
        keyIndex: n.keyIndex,
        time: n.time,
        ...(n.duration !== undefined ? { duration: n.duration } : {})
      })),
      duration: recording.duration,
      artist: recording.artist,
      studentNim: recording.studentNim, // this contains user's username
      tempo: 120, // default placeholder
      createdAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
};

// Fetch user scores
export const fetchDbCompositions = async (): Promise<Recording[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];

  const path = `users/${currentUser.uid}/compositions`;
  try {
    const ref = collection(db, 'users', currentUser.uid, 'compositions');
    const qSnapshot = await getDocs(query(ref, orderBy('createdAt', 'desc')));
    
    const results: Recording[] = [];
    qSnapshot.forEach(docSnap => {
      const d = docSnap.data();
      let createdStr = new Date().toISOString();
      if (d.createdAt && typeof d.createdAt.toDate === 'function') {
        createdStr = d.createdAt.toDate().toISOString();
      }
      
      let defaultArtist = 'Symphonia Artist';
      let defaultNim = '';
      const cached = localStorage.getItem('airpiano_current_user');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          defaultArtist = parsed.name || defaultArtist;
          defaultNim = parsed.nim || defaultNim;
        } catch (e) {}
      }

      results.push({
        id: docSnap.id,
        title: d.title || 'Tanpa Judul',
        notes: d.notes || [],
        duration: d.duration || 0,
        artist: d.artist || defaultArtist,
        studentNim: d.studentNim || defaultNim,
        notesCount: d.notes?.length || 0,
        createdAt: createdStr
      });
    });
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
};

// Remove a compositional score
export const deleteDbComposition = async (id: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const path = `users/${currentUser.uid}/compositions/${id}`;
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'compositions', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
};

// Sign in with Google provider
export const loginWithGoogle = async (): Promise<StudentProfile & { username: string }> => {
  const provider = new GoogleAuthProvider();
  const response = await signInWithPopup(auth, provider);
  const user = response.user;
  const userId = user.uid;

  const path = `users/${userId}`;
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const username = user.email ? user.email.split('@')[0] : 'google_user';
    const defaultProfile = {
      name: user.displayName || 'Google User',
      nim: username,
      institution: 'Universitas Andalas',
      classCode: 'UAS - Image Processing',
    };

    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        username: username,
        name: data.name || defaultProfile.name,
        nim: data.nim && data.nim !== 'Google-Auth' ? data.nim : username,
        institution: data.institution || defaultProfile.institution,
        classCode: data.classCode || defaultProfile.classCode
      };
    } else {
      // Create a default profile document for new social sign-in users
      await setDoc(doc(db, 'users', userId), {
        ...defaultProfile,
        createdAt: serverTimestamp()
      });
      return {
        username: username,
        ...defaultProfile
      };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    throw err;
  }
};

// Sign in with Apple provider
export const loginWithApple = async (): Promise<StudentProfile & { username: string }> => {
  const provider = new OAuthProvider('apple.com');
  const response = await signInWithPopup(auth, provider);
  const user = response.user;
  const userId = user.uid;

  const path = `users/${userId}`;
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const username = user.email ? user.email.split('@')[0] : 'apple_user';
    const defaultProfile = {
      name: user.displayName || 'Apple User',
      nim: username,
      institution: 'Universitas Andalas',
      classCode: 'UAS - Image Processing',
    };

    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        username: username,
        name: data.name || defaultProfile.name,
        nim: data.nim && data.nim !== 'Apple-Auth' ? data.nim : username,
        institution: data.institution || defaultProfile.institution,
        classCode: data.classCode || defaultProfile.classCode
      };
    } else {
      // Create a default profile document for new social sign-in users
      await setDoc(doc(db, 'users', userId), {
        ...defaultProfile,
        createdAt: serverTimestamp()
      });
      return {
        username: username,
        ...defaultProfile
      };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    throw err;
  }
};

// Sign out trigger
export const logOutSession = async () => {
  await signOut(auth);
};
