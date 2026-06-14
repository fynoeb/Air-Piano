/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, ShieldAlert, X, Key } from 'lucide-react';
import { StudentProfile, Recording, TrackingStats } from './types';
import MainPage from './components/MainPage';
import PianoPage from './components/PianoPage';
import StatsPage from './components/StatsPage';
import RecordingsPage from './components/RecordingsPage';
import {
  registerUserAccount,
  loginUserAccount,
  saveDbComposition,
  fetchDbCompositions,
  deleteDbComposition,
  logOutSession,
  auth,
  db,
  loginWithGoogle,
  checkUsernameExists
} from './utils/firebase';
import { doc, setDoc } from 'firebase/firestore';

// Simple pre-populated beautiful classical Arpeggio recording
const DEMO_PRELUDE: Recording = {
  id: 'demo_uas_prelude',
  title: 'Kompilasi UAS Citra Digital',
  artist: 'Fayi Amatullah Azhara',
  studentNim: '2311537001',
  duration: 8,
  notesCount: 16,
  createdAt: '2026-06-13 10:00',
  notes: [
    { note: 'C4', keyIndex: 0, time: 0, duration: 350 },
    { note: 'E4', keyIndex: 4, time: 300, duration: 350 },
    { note: 'G4', keyIndex: 7, time: 600, duration: 350 },
    { note: 'C5', keyIndex: 12, time: 900, duration: 350 },
    { note: 'E5', keyIndex: 16, time: 1200, duration: 350 },
    { note: 'G5', keyIndex: 19, time: 1500, duration: 350 },
    { note: 'C5', keyIndex: 12, time: 1800, duration: 350 },
    { note: 'E5', keyIndex: 16, time: 2100, duration: 350 },
    
    { note: 'C4', keyIndex: 0, time: 2600, duration: 350 },
    { note: 'E4', keyIndex: 4, time: 2900, duration: 350 },
    { note: 'G4', keyIndex: 7, time: 3200, duration: 350 },
    { note: 'C5', keyIndex: 12, time: 3500, duration: 350 },
    { note: 'E5', keyIndex: 16, time: 3800, duration: 350 },
    { note: 'G5', keyIndex: 19, time: 4100, duration: 350 },
    { note: 'C5', keyIndex: 12, time: 4400, duration: 350 },
    { note: 'E5', keyIndex: 16, time: 4700, duration: 350 },
  ]
};

// Simple persistent user utility helpers
export default function App() {
  // Navigation: 'main' | 'piano' | 'stats' | 'recordings'
  const [activeView, setActiveView] = useState<'main' | 'piano' | 'stats' | 'recordings'>('main');

  // Simple registration & login states
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('airpiano_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  const [authLoading, setAuthLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUsernameTakenModal, setShowUsernameTakenModal] = useState(false);
  const [authMessage, setAuthMessage] = useState('Daftar dan login untuk membuka fitur');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authNim, setAuthNim] = useState('');
  const [authError, setAuthError] = useState('');

  // Firebase session listener for cross-refresh login restoration
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        if (!currentUser) {
          try {
            const email = user.email || '';
            const username = email.split('@')[0];
            const { doc, getDoc } = await import('firebase/firestore');
            const { db } = await import('./utils/firebase');
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) {
              const d = snap.data();
              const oldNim = d.nim || '';
              let cleanNim = oldNim;
              if (!oldNim || oldNim.toLowerCase() === 'google-auth' || oldNim.toLowerCase() === 'apple-auth' || oldNim === 'Umum') {
                cleanNim = username;
              }
              setCurrentUser({
                username: username,
                name: d.name,
                nim: cleanNim,
                institution: d.institution,
                classCode: d.classCode
              });
              if (cleanNim !== oldNim) {
                try {
                  const { setDoc } = await import('firebase/firestore');
                  await setDoc(doc(db, 'users', user.uid), {
                    name: d.name,
                    nim: cleanNim,
                    institution: d.institution,
                    classCode: d.classCode,
                    createdAt: d.createdAt
                  });
                } catch (updateErr) {
                  console.warn("Could not auto-correct legacy user profile representation in Firestore:", updateErr);
                }
              }
            }
          } catch (e) {
            console.warn("Restoring auth session error:", e);
          }
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Academic profile setting (Defaulted to the Indonesian student Name & NIM or Logged-In User)
  const [profile, setProfile] = useState<StudentProfile>(() => {
    return {
      name: 'Tamu (Guest)',
      nim: '-',
      institution: 'Universitas Andalas',
      classCode: 'UAS - Image Processing'
    };
  });

  // Track profile changes and sync with active current user
  useEffect(() => {
    if (currentUser) {
      setProfile({
        name: currentUser.name,
        nim: currentUser.nim,
        institution: currentUser.institution || 'Universitas Andalas',
        classCode: currentUser.classCode || 'UAS - Image Processing'
      });
      localStorage.setItem('airpiano_current_user', JSON.stringify(currentUser));
    } else {
      setProfile({
        name: 'Tamu (Guest)',
        nim: '-',
        institution: 'Universitas Andalas',
        classCode: 'UAS - Image Processing'
      });
      localStorage.removeItem('airpiano_current_user');
    }
  }, [currentUser]);

  // Cumulative tracking metrics stats
  const [stats, setStats] = useState<TrackingStats>(() => {
    const saved = localStorage.getItem('airpiano_analytics_stats');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      totalFramesTested: 0,
      averageInferenceTime: 0,
      modelAccuracy: 0,
      totalActiveKeysPlayed: 0
    };
  });

  // Recordings lists databases locally, sandboxed by user to ensure privacy
  const [recordings, setRecordings] = useState<Recording[]>([]);

  useEffect(() => {
    if (currentUser) {
      fetchDbCompositions()
        .then(docs => {
          setRecordings(docs);
        })
        .catch(err => {
          console.error("Error loading composition scores:", err);
          setRecordings([]);
        });
    } else {
      setRecordings([DEMO_PRELUDE]);
    }
  }, [currentUser]);

  // Persist recordings on update for current logged-in user
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`airpiano_compositions_${currentUser.username}`, JSON.stringify(recordings));
    }
  }, [recordings, currentUser]);

  // Persist statistics
  useEffect(() => {
    localStorage.setItem('airpiano_analytics_stats', JSON.stringify(stats));
  }, [stats]);

  // Accumulate tracking inference frames statistics dynamically in floating roll average
  const handleUpdateStats = (newFrame: { latency: number; confidence: number; keysPlayed: number }) => {
    setStats(prev => {
      // If first-frame initialisation, start fresh to prevent divided by zero bugs
      if (prev.totalFramesTested === 0) {
        return {
          totalFramesTested: 1,
          averageInferenceTime: newFrame.latency,
          modelAccuracy: newFrame.confidence * 100, // multiply to display pct
          totalActiveKeysPlayed: newFrame.keysPlayed > 0 ? 1 : 0
        };
      }

      const total = prev.totalFramesTested + 1;
      
      // Calculate real floating average metrics
      const avgLatency = (prev.averageInferenceTime * prev.totalFramesTested + newFrame.latency) / total;
      const avgAccuracy = (prev.modelAccuracy * prev.totalFramesTested + (newFrame.confidence * 100)) / total;
      const keysCounter = prev.totalActiveKeysPlayed + (newFrame.keysPlayed > 0 ? 1 : 0);

      return {
        totalFramesTested: total,
        averageInferenceTime: avgLatency,
        modelAccuracy: avgAccuracy,
        totalActiveKeysPlayed: keysCounter
      };
    });
  };

  // Reset metrics
  const handleResetStats = () => {
    const freshStats: TrackingStats = {
      totalFramesTested: 0,
      averageInferenceTime: 0,
      modelAccuracy: 0,
      totalActiveKeysPlayed: 0
    };
    setStats(freshStats);
    localStorage.setItem('airpiano_analytics_stats', JSON.stringify(freshStats));
  };

  // Persistent save of compositions to database
  const handleSaveRecording = (newRec: Omit<Recording, 'id' | 'createdAt'>) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const completedRecording: Recording = {
      ...newRec,
      id: `rec_${Date.now()}`,
      createdAt: timestamp
    };

    if (currentUser) {
      saveDbComposition(newRec)
        .then(() => fetchDbCompositions())
        .then(docs => {
          setRecordings(docs);
        })
        .catch(err => {
          console.error("Gagal menyimpan rekaman ke Firestore:", err);
          setRecordings(prev => [completedRecording, ...prev]);
        });
    } else {
      setRecordings(prev => [completedRecording, ...prev]);
    }
  };

  // Delete composition from database
  const handleDeleteRecording = (id: string) => {
    if (currentUser) {
      deleteDbComposition(id)
        .then(() => fetchDbCompositions())
        .then(docs => {
          setRecordings(docs);
        })
        .catch(err => {
          console.error("Gagal menghapus rekaman dari Firestore:", err);
          setRecordings(prev => prev.filter(rec => rec.id !== id));
        });
    } else {
      setRecordings(prev => prev.filter(rec => rec.id !== id));
    }
  };

  // Switch navigation helper
  const handleNavigate = (view: 'main' | 'piano' | 'stats' | 'recordings') => {
    if (view === 'recordings' && !currentUser) {
      setAuthMessage('Daftar dan login untuk membuka fitur');
      setAuthMode('login');
      setAuthError('');
      setShowAuthModal(true);
      return;
    }
    setActiveView(view);
  };

  // Custom Authentication operations with Firebase integrations
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const cleanUsername = authUsername.trim();

    if (!cleanUsername || !authPassword) {
      setAuthError('Harap isi semua kolom');
      return;
    }

    if (authPassword.length < 6) {
      setAuthError('Sandi kurang (minimal 6 karakter).');
      return;
    }

    setAuthLoading(true);

    if (authMode === 'register') {
      if (!authFullName) {
        setAuthError('Harap lengkapi Nama Lengkap');
        setAuthLoading(false);
        return;
      }

      checkUsernameExists(cleanUsername)
        .then((exists) => {
          if (exists) {
            setShowUsernameTakenModal(true);
            setAuthError('Username sudah digunakan saat daftar.');
            setAuthLoading(false);
            return;
          }

          registerUserAccount({
            username: cleanUsername,
            password: authPassword,
            fullName: authFullName,
            nim: cleanUsername,
            institution: 'Umum',
            classCode: 'Umum'
          })
            .then((userProfile) => {
              setCurrentUser({
                username: cleanUsername,
                name: userProfile.name,
                nim: userProfile.nim,
                institution: userProfile.institution,
                classCode: userProfile.classCode
              });
              setShowAuthModal(false);
              
              // Clean form inputs
              setAuthUsername('');
              setAuthPassword('');
              setAuthFullName('');
              setAuthNim('');

              // Auto-navigate to original recordings view
              setActiveView('recordings');
            })
            .catch((err: any) => {
              if (err.code === 'auth/email-already-in-use') {
                setShowUsernameTakenModal(true);
                setAuthError('Username sudah digunakan saat daftar.');
              } else if (err.code === 'auth/weak-password') {
                setAuthError('Sandi kurang (minimal 6 karakter).');
              } else {
                setAuthError(err.message || 'Gagal mendaftar akun ke Firebase');
              }
            })
            .finally(() => {
              setAuthLoading(false);
            });
        })
        .catch((err) => {
          console.error("Gagal memeriksa nama pengguna:", err);
          setAuthError('Gagal memproses pendaftaran.');
          setAuthLoading(false);
        });
    } else {
      loginUserAccount(cleanUsername, authPassword)
        .then((userProfile) => {
          setCurrentUser({
            username: cleanUsername,
            name: userProfile.name,
            nim: userProfile.nim,
            institution: userProfile.institution,
            classCode: userProfile.classCode
          });
          setShowAuthModal(false);

          // Clean Form inputs
          setAuthUsername('');
          setAuthPassword('');

          // Auto-navigate to original recordings view
          setActiveView('recordings');
        })
        .catch((err: any) => {
          setAuthError('Username atau sandi salah.');
        })
        .finally(() => {
          setAuthLoading(false);
        });
    }
  };

  const handleGoogleLogin = () => {
    setAuthError('');
    setAuthLoading(true);
    loginWithGoogle()
      .then((userProfile) => {
        setCurrentUser({
          username: userProfile.username,
          name: userProfile.name,
          nim: userProfile.nim,
          institution: userProfile.institution,
          classCode: userProfile.classCode
        });
        setShowAuthModal(false);
        setActiveView('recordings');
      })
      .catch((err: any) => {
        setAuthError(err.message || 'Gagal login menggunakan Google.');
      })
      .finally(() => {
        setAuthLoading(false);
      });
  };

  const handleLogout = () => {
    logOutSession()
      .then(() => {
        setCurrentUser(null);
        setActiveView('main');
      })
      .catch(err => {
        console.error("Gagal melakukan sign out:", err);
        setCurrentUser(null);
        setActiveView('main');
      });
  };

  const handleUpdateProfile = (updated: StudentProfile) => {
    if (currentUser) {
      const nextUser = {
        ...currentUser,
        name: updated.name,
        nim: updated.nim,
        institution: updated.institution,
        classCode: updated.classCode
      };
      
      const currentUserFirebase = auth.currentUser;
      if (currentUserFirebase) {
        setDoc(doc(db, 'users', currentUserFirebase.uid), {
          name: updated.name,
          nim: updated.nim,
          institution: updated.institution,
          classCode: updated.classCode
        }, { merge: true })
          .then(() => {
            setCurrentUser(nextUser);
          })
          .catch(dbErr => {
            console.error("Gagal memperbarui profil di Firestore:", dbErr);
          });
      }
    } else {
      setProfile(updated);
    }
  };

  // Helpers to determine conditional styles and borders for auth form fields
  const isUsernameValid = authUsername.trim().length >= 3;
  const isPasswordValid = authPassword.length >= 6;
  const isFullNameValid = authFullName.trim().length >= 3;

  const usernameInputClass = `w-full bg-white/[0.03] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 transition-all font-mono border ${
    authUsername === ''
      ? 'border-white/10 focus:border-white/30 focus:ring-white/20'
      : isUsernameValid
        ? 'border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
        : 'border-red-500/50 focus:border-red-400 focus:ring-red-500/30'
  }`;

  const passwordInputClass = `w-full bg-white/[0.03] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 transition-all font-mono border ${
    authPassword === ''
      ? 'border-white/10 focus:border-white/30 focus:ring-white/20'
      : isPasswordValid
        ? 'border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
        : 'border-red-500/50 focus:border-red-400 focus:ring-red-500/30'
  }`;

  const fullNameInputClass = `w-full bg-white/[0.03] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 transition-all border ${
    authFullName === ''
      ? 'border-white/10 focus:border-white/30 focus:ring-white/20'
      : isFullNameValid
        ? 'border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
        : 'border-red-500/50 focus:border-red-400 focus:ring-red-500/30'
  }`;


  return (
    <div className="min-h-screen bg-[#070709] text-neutral-100 relative overflow-hidden">
      {/* Decorative ambient background blur objects */}
      <div className="absolute top-[10%] left-[20%] w-[350px] h-[350px] bg-red-950/20 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-[15%] right-[10%] w-[450px] h-[450px] bg-neutral-900/40 rounded-full blur-[150px] pointer-events-none -z-10" />
      
      <AnimatePresence mode="wait">
        {activeView === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
          >
            <MainPage 
              onNavigate={handleNavigate} 
              profile={profile} 
              onUpdateProfile={handleUpdateProfile} 
              currentUser={currentUser}
              onLogout={() => setShowLogoutConfirm(true)}
              onLoginClick={() => {
                setAuthMessage('Daftar dan login untuk membuka fitur');
                setAuthMode('login');
                setAuthError('');
                setShowAuthModal(true);
              }}
            />
          </motion.div>
        )}

        {activeView === 'piano' && (
          <motion.div
            key="piano"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35 }}
          >
            <PianoPage 
              onBack={() => handleNavigate('main')} 
              profile={profile}
              onSaveRecording={handleSaveRecording}
              stats={stats}
              onUpdateStats={handleUpdateStats}
              onResetStats={handleResetStats}
            />
          </motion.div>
        )}

        {activeView === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -25 }}
            transition={{ duration: 0.35 }}
          >
            <StatsPage 
              onBack={() => handleNavigate('main')} 
              stats={stats}
              onResetStats={handleResetStats}
              profile={profile}
            />
          </motion.div>
        )}

        {activeView === 'recordings' && (
          <motion.div
            key="recordings"
            initial={{ opacity: 0, x: -25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 25 }}
            transition={{ duration: 0.35 }}
          >
            <RecordingsPage 
              onBack={() => handleNavigate('main')} 
              recordings={recordings}
              onDeleteRecording={handleDeleteRecording}
              profile={profile}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elegant, high-contrast, glow-styled AuthModal for simple Login/Register */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0e0e12]/95 border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-[0_0_25px_rgba(239,68,68,0.15)] relative space-y-4"
              id="modal-authorization"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1 text-center">
                <div className="mx-auto w-10 h-10 bg-red-950/20 border border-red-500/15 rounded-xl flex items-center justify-center text-red-500">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-display text-white font-medium pt-2">
                  {authMessage}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Akses instrumen orkes Anda di mana saja secara privat.
                </p>
              </div>

              {/* Tabs selector */}
              <div className="grid grid-cols-2 p-1 bg-white/[0.03] border border-white/5 rounded-xl text-xs font-mono">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className={`py-2 rounded-lg transition-colors cursor-pointer text-center ${authMode === 'login' ? 'bg-white/10 text-white font-medium' : 'text-neutral-400 hover:text-neutral-250'}`}
                >
                  Masuk (Login)
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setAuthError(''); }}
                  className={`py-2 rounded-lg transition-colors cursor-pointer text-center ${authMode === 'register' ? 'bg-white/10 text-white font-medium' : 'text-neutral-400 hover:text-neutral-250'}`}
                >
                  Daftar (Register)
                </button>
              </div>

              {/* Error messages if exists */}
              {authError && (
                <div className="flex gap-1.5 items-center bg-red-950/20 px-3 py-2 rounded-xl border border-red-900/30 text-[10.5px] text-red-400 font-mono">
                  <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

               <form onSubmit={handleAuthSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 tracking-wider mb-1 font-bold">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    className={usernameInputClass}
                    placeholder="Contoh: fayiamatullah"
                  />
                  {authUsername !== '' && authUsername.trim().length < 3 && (
                    <p className="text-[10px] text-red-400 font-mono mt-1">
                      Username minimal 3 karakter.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-450 tracking-wider mb-1 font-bold">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className={passwordInputClass}
                    placeholder="Masukkan sandi Anda"
                  />
                  {authPassword !== '' && authPassword.length < 6 && (
                    <p className="text-[10px] text-red-400 font-mono mt-1">
                      Sandi kurang panjang (minimal 6 karakter).
                    </p>
                  )}
                </div>

                {authMode === 'register' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-neutral-400 tracking-wider mb-1 font-bold">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        required
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        className={fullNameInputClass}
                        placeholder="Fayi Amatullah Azhara"
                      />
                      {authFullName !== '' && authFullName.trim().length < 3 && (
                        <p className="text-[10px] text-red-400 font-mono mt-1">
                          Nama minimal 3 karakter.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 mt-2 bg-white text-black hover:bg-neutral-200 text-xs font-semibold uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {authLoading ? (
                    <span className="animate-pulse">Memproses...</span>
                  ) : (
                    authMode === 'register' ? 'Buat Akun & Masuk' : 'Autentikasi Sandi'
                  )}
                </button>

                {/* Divider separation */}
                <div id="auth-divider" className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-x-0 h-px bg-white/10" />
                  <span className="relative bg-[#0d0d12] px-3.5 text-[10px] uppercase font-mono tracking-widest text-neutral-450 z-10">atau login dengan</span>
                </div>

                {/* Social Sign In Option buttons */}
                <div id="social-auth-container" className="grid grid-cols-1 mt-2">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={authLoading}
                    className="flex items-center justify-center gap-2 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/10 hover:border-white/20 text-[10px] font-bold text-white uppercase tracking-widest font-mono rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 2.152 15.39 1 12.24 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.985 0-.74-.078-1.303-.174-1.865l-10.619-.355z"/>
                    </svg>
                    Google
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Logout Modal overlay */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowLogoutConfirm(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm bg-neutral-950 border border-white/[0.08] rounded-2xl p-6 shadow-2xl overflow-hidden space-y-6"
            >
              <div className="space-y-2">
                <h4 className="text-white text-base font-medium tracking-wide">
                  Yakin keluar dari akun anda?
                </h4>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Anda perlu masuk kembali untuk mengakses fitur penyimpanan cloud dan history rekaman Anda.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 text-xs uppercase tracking-widest text-neutral-400 hover:text-white transition-colors cursor-pointer bg-white/5 hover:bg-white/10 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setShowLogoutConfirm(false);
                  }}
                  className="px-4 py-2 text-xs uppercase tracking-widest text-red-200 hover:text-red-300 transition-colors cursor-pointer bg-red-950/30 hover:bg-red-950/50 border border-red-900/30 rounded-xl font-medium"
                >
                  Yakin
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Username Taken Modal overlay */}
      <AnimatePresence>
        {showUsernameTakenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              onClick={() => setShowUsernameTakenModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm bg-[#0e0e12] border border-red-500/20 rounded-2xl p-6 shadow-[0_0_30px_rgba(239,68,68,0.15)] overflow-hidden space-y-6 text-center"
            >
              <div className="space-y-2">
                <div className="mx-auto w-10 h-10 bg-red-950/30 border border-red-500/20 rounded-xl flex items-center justify-center text-red-500 mb-2">
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                </div>
                <h4 className="text-white text-base font-medium tracking-wide font-sans">
                  Username Sudah Digunakan!
                </h4>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Username <span className="text-red-400 font-mono font-bold">@{authUsername}</span> ini sudah terdaftar di sistem. Silakan pakai username lain atau beralih ke menu Masuk (Login).
                </p>
              </div>

              <div className="flex flex-col gap-2 font-sans pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUsernameTakenModal(false);
                    setAuthMode('login');
                    setAuthError('');
                  }}
                  className="w-full py-2.5 text-xs text-black bg-white hover:bg-neutral-200 transition-colors cursor-pointer rounded-xl font-bold tracking-wider"
                >
                  Beralih ke Login
                </button>
                <button
                  type="button"
                  onClick={() => setShowUsernameTakenModal(false)}
                  className="w-full py-2 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer bg-white/5 hover:bg-white/10 rounded-xl"
                >
                  Gunakan Username Lain
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
