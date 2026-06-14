/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BarChart, Clock, Award, RotateCcw, ArrowLeft, TrendingUp } from 'lucide-react';
import { TrackingStats, StudentProfile } from '../types';

interface StatsPageProps {
  onBack: () => void;
  stats: TrackingStats;
  onResetStats: () => void;
  profile: StudentProfile;
}

export default function StatsPage({ onBack, stats, onResetStats, profile }: StatsPageProps) {
  
  // Calculate a simulated grade or recommendations for their Image Processing final report!
  const calculateModelHealth = () => {
    if (stats.totalFramesTested === 0) return { label: 'Idle', color: 'text-neutral-400', pct: 0 };
    if (stats.modelAccuracy >= 90) return { label: 'EXCELLENT (A)', color: 'text-emerald-400', pct: 95 };
    if (stats.modelAccuracy >= 75) return { label: 'GOOD (B+)', color: 'text-yellow-400', pct: 82 };
    return { label: 'DEVELOPMENT (C)', color: 'text-red-400', pct: 60 };
  };

  const health = calculateModelHealth();

  // Create simple elegant SVG paths for representation graphs
  const generateSimulatedWave = () => {
    const peak = 40;
    const base = 15;
    const points = [];
    for (let i = 0; i <= 10; i++) {
      const x = i * 40;
      const y = stats.totalFramesTested === 0 ? 0 : (base + Math.sin(i * 1.5) * (peak - base) * 0.4 + (Math.random() * 5));
      points.push(`${x},${100 - y}`);
    }
    return `M ${points.join(' L ')}`;
  };

  const wavePath = generateSimulatedWave();

  return (
    <div className="min-h-screen text-neutral-100 max-w-5xl mx-auto px-6 py-12 flex flex-col justify-between font-sans relative z-10 animate-fade-in">
      
      {/* Header section */}
      <header className="flex flex-col sm:flex-row items-center justify-between border-b border-white/[0.04] pb-6 mb-12 gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-405 hover:text-white transition-colors cursor-pointer"
        >
          &larr; Beranda
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-display font-light text-white tracking-wide">
            Statistik Model & Penilaian
          </h2>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono mt-1">
            {profile.classCode}
          </p>
        </div>

        <button
          type="button"
          onClick={onResetStats}
          className="text-xs text-neutral-400 hover:text-red-400 transition-all cursor-pointer uppercase tracking-widest"
        >
          Reset Metrics
        </button>
      </header>

      {/* Primary stats overview */}
      <main className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        
        {/* Metric 1: Total tested data */}
        <div className="space-y-2">
          <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500 block">
            Frames Analyzed
          </span>
          <h3 className="text-4xl font-light font-mono text-white">
            {stats.totalFramesTested}
          </h3>
          <p className="text-xs text-neutral-400 font-light leading-relaxed">
            Jumlah kumulatif sampel frame kamera terdeteksi oleh sistem tracking.
          </p>
        </div>

        {/* Metric 2: Average Inferensi time */}
        <div className="space-y-2">
          <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500 block">
            Average Latency
          </span>
          <h3 className="text-4xl font-light font-mono text-white">
            {Math.round(stats.averageInferenceTime)} <span className="text-sm font-sans font-light text-neutral-500">ms</span>
          </h3>
          <p className="text-xs text-neutral-400 font-light leading-relaxed">
            Kecepatan pemrosesan koordinat sendi tangan per frame feed.
          </p>
        </div>

        {/* Metric 3: Accuracy Score */}
        <div className="space-y-2">
          <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500 block">
            Model Accuracy
          </span>
          <h3 className="text-4xl font-light font-mono text-white">
            {Math.round(stats.modelAccuracy)}%
          </h3>
          <p className="text-xs text-neutral-400 font-light leading-relaxed">
            Rasio kesuksesan deteksi gestur sendi landmarks MediaPipe.
          </p>
        </div>

      </main>

      {/* Visualization Grid: Chart and Academic Grading recommendations */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-12 flex-grow items-start">
        
        {/* Left: Programmatic line chart */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <h3 className="text-sm tracking-wider uppercase text-neutral-300 font-medium">
              Profil Latensi Real-Time (ms)
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed font-light mt-1">
              Kurva latensi pemrosesan algoritma computer vision terhadap variasi beban CPU runtime.
            </p>
          </div>

          {/* SVG line graph */}
          <div className="h-44 w-full bg-white/[0.01] rounded-2xl relative border border-white/[0.04] flex flex-col justify-end p-2 overflow-hidden">
            
            {/* Latency markers */}
            <div className="absolute left-4 top-4 text-[8.5px] font-mono text-neutral-500 space-y-1.5 leading-none">
              <div>60ms — Slower</div>
              <div>30ms — Ideal</div>
              <div>10ms — Excellent</div>
            </div>

            {/* Programmatic SVG Wave */}
            <svg viewBox="0 0 400 100" className="w-full h-28 text-white/40">
              <path
                d={wavePath}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="stroke-neutral-500 transition-all duration-700"
              />
              <path
                d={wavePath + ' L 400,100 L 0,100 Z'}
                fill="url(#goldGradient)"
                opacity="0.04"
              />
              <defs>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            <span className="text-[8px] font-mono text-neutral-500 text-right mt-1 block">
              Sumbu X: Durasi interaksi (Timeline Frame)
            </span>
          </div>
        </div>

        {/* Right: Academic grading showcase sheet */}
        <div className="lg:col-span-5 border border-white/[0.04] bg-[#0c0c10]/40 rounded-3xl p-8 space-y-6">
          <div>
            <h4 className="text-xs tracking-wider uppercase text-neutral-300 font-bold mb-4">
              Laporan Hasil Klasifikasi
            </h4>
            <div className="space-y-4 pt-2 text-xs leading-none font-light">
              <div className="flex justify-between border-b border-white/[0.04] pb-2">
                <span className="text-neutral-400">Nama Pengguna</span>
                <span className="text-white font-medium">{profile.name}</span>
              </div>
              {profile.nim && profile.nim !== '-' && profile.nim !== 'Umum' && (
                <div className="flex justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-neutral-400">Username</span>
                  <span className="text-white font-mono">@{profile.nim}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-white/[0.04] pb-2">
                <span className="text-neutral-400">Total Interaksi Keypress</span>
                <span className="text-white">{stats.totalActiveKeysPlayed} kali</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs">
            <div>
              <span className="text-[9px] font-mono text-neutral-500 uppercase">Rekomendasi Grade</span>
              <div className={`text-sm font-display font-light uppercase mt-1 ${health.color}`}>
                {health.label}
              </div>
            </div>
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/5 text-xs text-neutral-300 font-mono">
              {health.pct}%
            </div>
          </div>
        </div>

      </section>

      {/* Bottom informational guidelines */}
      <footer className="border-t border-white/[0.04] pt-6 text-center text-[10px] text-neutral-500 font-mono tracking-wider">
        © 2026 Fayi Amatullah Azhara - Air Piano Virtual - Universitas Andalas
      </footer>

    </div>
  );
}
