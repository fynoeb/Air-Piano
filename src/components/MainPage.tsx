/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Music, Play, BarChart2, Disc, User, Info, Keyboard, Award, LogOut, LogIn } from 'lucide-react';
import { StudentProfile } from '../types';

export function AirPianoLogo({ className = "w-20 h-20 text-white" }: { className?: string }) {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <img
        src="/logo.png"
        alt="Air Piano Logo"
        onError={() => setImgError(true)}
        className={`${className} brightness-0 invert [filter:drop-shadow(0_0_12px_rgba(255,255,255,0.45))] object-contain`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <svg 
      viewBox="0 0 320 320" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <g filter="url(#glow)">
        {/* Stylized Block Text "AIR" */}
        {/* A */}
        <path d="M30,130 L65,20 L105,20 L140,130 L110,130 L104,103 L66,103 L60,130 Z M72,80 L98,80 L85,45 Z" fill="currentColor" />
        {/* I */}
        <path d="M156,40 L156,15 L186,15 L186,40 Z M156,130 L156,50 L186,50 L186,130 Z" fill="currentColor" />
        {/* R */}
        <path d="M202,130 L202,20 L262,20 C297,20 297,65 262,65 L232,65 L234,65 L272,130 L237,130 L202,130 Z M232,38 L232,52 L257,52 C267,52 267,38 257,38 Z" fill="currentColor" />
        
        {/* Detailed Grand Piano Silhouette */}
        {/* Lid open and support stick */}
        <path d="M40,165 L160,125 Q180,120 200,110 L205,115 L110,175 Z" fill="currentColor" opacity="0.9" />
        <path d="M155,128 L155,150" stroke="currentColor" strokeWidth="2.5" />
        
        {/* Main Body of Piano */}
        <path d="M35,180 C28,180 28,186 42,186 L210,186 Q235,186 242,203 Q248,220 270,220 Q292,220 292,242 C292,254 275,266 245,272 L42,272 C28,272 28,260 28,248 Q28,230 42,224 L42,192 Z" fill="currentColor" />
        
        {/* Keyboard Area contrast */}
        <rect x="42" y="258" width="180" height="8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        
        {/* Solid Legs */}
        <rect x="52" y="272" width="8" height="34" rx="2.5" fill="currentColor" />
        <rect x="220" y="272" width="8" height="34" rx="2.5" fill="currentColor" />
        <rect x="265" y="255" width="8" height="42" rx="2.5" fill="currentColor" />
        <path d="M142,272 L136,298 H154 L148,272 Z" fill="currentColor" />
        <circle cx="138" cy="301" r="2.5" fill="currentColor" />
        <circle cx="152" cy="301" r="2.5" fill="currentColor" />
      </g>
      <defs>
        <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ffffff" floodOpacity="0.45" />
        </filter>
      </defs>
    </svg>
  );
}

interface MainPageProps {
  onNavigate: (view: 'main' | 'piano' | 'stats' | 'recordings') => void;
  profile: StudentProfile;
  onUpdateProfile: (profile: StudentProfile) => void;
  currentUser?: any | null;
  onLogout?: () => void;
  onLoginClick?: () => void;
}

export default function MainPage({ onNavigate, profile, onUpdateProfile, currentUser, onLogout, onLoginClick }: MainPageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(profile.name);
  const [editedNim, setEditedNim] = useState(profile.nim);
  const [editedClass, setEditedClass] = useState(profile.classCode);

  useEffect(() => {
    setEditedName(profile.name);
    setEditedNim(profile.nim);
    setEditedClass(profile.classCode);
  }, [profile]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: editedName || 'Fayi Amatullah Azhara',
      nim: editedNim || '2311537001',
      institution: 'Universitas Andalas',
      classCode: editedClass || 'UAS - Image Processing'
    });
    setIsEditing(false);
  };


  return (
    <div className="min-h-screen text-neutral-100 font-sans px-6 py-12 md:px-16 max-w-6xl mx-auto flex flex-col justify-between relative z-10 animate-fade-in">
      
      {/* Sleek Modern Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/[0.04] pb-8 mb-12 gap-6 animate-slide-down" id="header-orchestra">
        <div className="flex items-center gap-4">
          <AirPianoLogo className="w-20 h-20 text-white flex-shrink-0" />
          <div>
            <h1 className="text-4xl font-display font-light tracking-[0.08em] text-white">
              AIR PIANO
            </h1>
            <p className="text-xs text-neutral-400 tracking-wide font-light mt-1">Virtual Piano Hand Gesture Recognizer</p>
          </div>
        </div>

        {/* Dynamic Profile Badge with clean typography */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <h4 className="text-xs tracking-wider uppercase text-neutral-200 font-medium">{profile.name}</h4>
            <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
              {currentUser 
                ? (profile.nim && profile.nim !== '-' && profile.nim !== 'Umum' ? `Username: @${profile.nim}` : 'Pengguna Umum') 
                : 'Mode Tamu (Guest)'}
            </p>
          </div>
          <button 
            type="button"
            id="btn-edit-profile"
            onClick={() => {
              setEditedName(profile.name);
              setEditedNim(profile.nim);
              setEditedClass(profile.classCode);
              setIsEditing(true);
            }} 
            className="p-2 border border-white/5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Edit Identity Info"
          >
            <User className="w-4 h-4" />
          </button>
          {!currentUser && onLoginClick && (
            <button
              type="button"
              id="btn-login-header"
              onClick={onLoginClick}
              className="p-2 border border-white/5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shadow-[0_0_10px_rgba(255,255,255,0.05)]"
              title="Masuk / Daftar"
            >
              <LogIn className="w-4 h-4" />
            </button>
          )}
          {currentUser && onLogout && (
            <button
              type="button"
              id="btn-logout-header"
              onClick={onLogout}
              className="p-2 border border-red-500/15 rounded-xl text-red-500 hover:text-red-450 hover:bg-red-950/20 transition-colors cursor-pointer"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area with generous whitespace */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start flex-grow mb-16">
        
        {/* Left column: Core description & Actions */}
        <div className="lg:col-span-7 space-y-8 animate-fade-in-delay">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-light text-white leading-tight tracking-wide">
            Mainkan Nada Piano <br />
            <span className="italic text-neutral-400 font-normal">
              Tanpa Sentuhan Fisik
            </span>
          </h2>
          
          <p className="text-neutral-400 leading-relaxed font-light text-sm max-w-lg">
            Air piano adalah instrumen virtual berbasis <strong>Computer Vision</strong> yang melacak 21 titik sendi tangan. Cukup posisikan jari Anda di atas kamera dan tekuk jari untuk membunyikan visualisator 24 tuts piano hand-free secara instan.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
            <div className="space-y-2">
              <h4 className="text-xs tracking-wider text-neutral-200 uppercase font-medium">24 Tuts Nada Utama</h4>
              <p className="text-xs text-neutral-400 leading-relaxed font-light">Dua oktav lengkap (C4 - B5) dengan output synthesizer berkecepatan tinggi.</p>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-xs tracking-wider text-neutral-200 uppercase font-medium">Arsip Komposisi Lokal</h4>
              <p className="text-xs text-neutral-400 leading-relaxed font-light">Simpan hasil uji latihan orkes Anda secara offline di database lokal browser.</p>
            </div>
          </div>

          {/* Trigger Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <button
              type="button"
              id="btn-play-now"
              onClick={() => onNavigate('piano')}
              className="px-8 py-3.5 bg-white text-black hover:bg-neutral-200 text-xs font-semibold uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg"
            >
              Mulai Mainkan
            </button>
            
            <button
              type="button"
              id="btn-stats"
              onClick={() => onNavigate('stats')}
              className="px-6 py-3.5 bg-transparent hover:bg-white/5 border border-white/10 rounded-xl text-neutral-300 hover:text-white transition-all text-xs uppercase tracking-widest cursor-pointer"
            >
              Statistik Model
            </button>
          </div>
        </div>

        {/* Right column: Beautiful Minimalist calibration rules */}
        <div className="lg:col-span-5 space-y-8">
          <div className="border border-white/[0.04] bg-[#0c0c10]/40 rounded-3xl p-8 space-y-6">
            <h3 className="text-xs tracking-[0.2em] uppercase text-neutral-300 font-bold">
              Instruksi Kalibrasi
            </h3>

            <div className="space-y-6 text-xs leading-relaxed font-light text-neutral-400">
              <div className="flex gap-4">
                <span className="font-mono text-neutral-500">01</span>
                <p>Posisikan tangan dalam jangkauan kamera dengan pencahayaan ruangan yang cukup.</p>
              </div>

              <div className="flex gap-4">
                <span className="font-mono text-neutral-500">02</span>
                <p>Jari Anda akan dideteksi di atas virtual keybed. Tekuk jari ke bawah untuk memicu ketukan piano.</p>
              </div>

              <div className="flex gap-4">
                <span className="font-mono text-neutral-500">03</span>
                <p>Setiap melodi yang terpicu dapat langsung disimpan dan didengarkan kembali di menu riwayat.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs">
              <span className="text-neutral-500">Sesi Praktik</span>
              <button
                type="button"
                id="btn-recordings"
                onClick={() => onNavigate('recordings')}
                className="text-white hover:underline uppercase tracking-widest text-[9px] cursor-pointer"
              >
                Lihat Rekaman &rarr;
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Profile Editor Modal Overlay with glassmorphism */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#121217] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-xl font-display font-bold text-white mb-2 pb-2 border-b border-white/10">
              Edit Identitas Profil
            </h3>
            <p className="text-xs text-neutral-400 mb-4">
              Informasi profil pengguna untuk menyesuaikan nama tampilan utama Anda.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-red-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition-all"
                  placeholder="Masukkan nama Anda"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Kategori / Keterangan
                </label>
                <input
                  type="text"
                  required
                  value={editedClass}
                  onChange={(e) => setEditedClass(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-red-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition-all"
                  placeholder="Contoh: Umum, Pelajar, Orkes, dll."
                />
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-200 hover:bg-white text-black rounded-xl text-xs font-bold"
                >
                  Simpan Profil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Professional Footer Info */}
      <footer className="border-t border-white/[0.04] pt-6 text-center">
        <p className="text-[10px] text-neutral-500 font-mono tracking-wider">
          © 2026 Fayi Amatullah Azhara - Air Piano Virtual - Universitas Andalas
        </p>
      </footer>
    </div>
  );
}
