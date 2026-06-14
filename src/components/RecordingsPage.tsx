/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Trash2, ArrowLeft, Download, Music, AlertCircle, Database, ListMusic, Loader2 } from 'lucide-react';
import { Recording, StudentProfile } from '../types';
import { playPianoNote, PIANO_KEYS, synthesizeRecordingToWav } from '../utils/audio';

interface RecordingsPageProps {
  onBack: () => void;
  recordings: Recording[];
  onDeleteRecording: (id: string) => void;
  profile: StudentProfile;
}

export default function RecordingsPage({
  onBack,
  recordings,
  onDeleteRecording,
  profile
}: RecordingsPageProps) {
  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackTimeouts, setPlaybackTimeouts] = useState<any[]>([]);
  const [activePlaybackKeys, setActivePlaybackKeys] = useState<Set<number>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Clean timeouts on unmount
  useEffect(() => {
    return () => {
      playbackTimeouts.forEach(t => clearTimeout(t));
    };
  }, [playbackTimeouts]);

  // Start composition playback of synthesiser note sequence
  const startCompositionPlayback = (track: Recording) => {
    // Stop any active playbacks
    playbackTimeouts.forEach(t => clearTimeout(t));
    setPlaybackTimeouts([]);
    setActivePlaybackKeys(new Set());

    setPlayingId(track.id);

    const timeoutsList: any[] = [];

    // Schedule each note events in the JSON note timeline
    track.notes.forEach((evt) => {
      const tout = setTimeout(() => {
        // Trigger sound node
        playPianoNote(evt.keyIndex, 0.85);

        // Highlight active playback key visually
        setActivePlaybackKeys(prev => {
          const next = new Set(prev);
          next.add(evt.keyIndex);
          return next;
        });

        // Set duration cutoff highlight
        const duration = evt.duration || 300;
        const releaseTout = setTimeout(() => {
          setActivePlaybackKeys(prev => {
            const next = new Set(prev);
            next.delete(evt.keyIndex);
            return next;
          });
        }, duration);
        timeoutsList.push(releaseTout);

      }, evt.time);

      timeoutsList.push(tout);
    });

    // Handle track wrap up
    const finishTime = track.notes.length > 0 
      ? Math.max(...track.notes.map(n => n.time)) + 1200
      : 2000;

    const endTout = setTimeout(() => {
      setPlayingId(null);
      setActivePlaybackKeys(new Set());
    }, finishTime);

    timeoutsList.push(endTout);
    setPlaybackTimeouts(timeoutsList);
  };

  // Stop current active playing sequence
  const stopPlayback = () => {
    playbackTimeouts.forEach(t => clearTimeout(t));
    setPlaybackTimeouts([]);
    setPlayingId(null);
    setActivePlaybackKeys(new Set());
  };

  // Download recording composition as synthesized high-fidelity MP3 sound file
  const downloadCompositionBackup = async (track: Recording) => {
    if (downloadingId) return;
    try {
      setDownloadingId(track.id);
      const blob = await synthesizeRecordingToWav(track.notes, track.duration);
      const url = URL.createObjectURL(blob);
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", url);
      dlAnchorElem.setAttribute("download", `${track.title.toLowerCase().replace(/\s+/g, '_')}.mp3`);
      dlAnchorElem.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Gagal mendownload MP3:", e);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen text-neutral-100 max-w-5xl mx-auto px-6 py-12 flex flex-col justify-between font-sans relative z-10 animate-fade-in">
      
      {/* Header section */}
      <header className="flex flex-col sm:flex-row items-center justify-between border-b border-white/[0.04] pb-6 mb-12 gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          &larr; Beranda
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-display font-light text-white tracking-wide">
            Database Rekaman Komposisi
          </h2>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono mt-1">
            {profile.classCode}
          </p>
        </div>

        <div className="text-[10px] uppercase tracking-widest font-mono text-neutral-500 opacity-0 pointer-events-none select-none">
          Database
        </div>
      </header>

      {/* Primary content space */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start flex-grow mb-16">
        
        {/* Left Side: Recordings lists */}
        <div className="lg:col-span-8 space-y-6">
          <h3 className="text-xs tracking-wider uppercase text-neutral-300 font-medium">
            Arsip Rekaman ({recordings.length})
          </h3>

          <AnimatePresence mode="popLayout">
            {recordings.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border border-white/[0.04] bg-[#0c0c10]/40 rounded-3xl p-12 text-center space-y-4"
              >
                <div>
                  <h4 className="text-sm text-neutral-300 font-medium">Belum Ada Melodi Terdaftar</h4>
                  <p className="text-xs text-neutral-455 max-w-sm mx-auto mt-2 leading-relaxed font-light font-sans">
                    Silakan buka layar Piano Virtual, tekan tombol Mulai Rekam, lalu mainkan melodi piano di udara untuk menyimpan rekaman pengujian Anda.
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {recordings.map((recording) => {
                  const isThisPlaying = playingId === recording.id;
                  return (
                    <motion.div
                      key={recording.id}
                      layoutId={`item-${recording.id}`}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="border border-white/[0.04] bg-[#0c0c10]/40 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 transition-all"
                    >
                      {/* Melody parameters */}
                      <div className="flex-grow space-y-1">
                        <h4 className="font-display text-white text-lg tracking-wide">
                          {recording.title}
                        </h4>
                        <p className="text-xs text-neutral-400 font-light font-sans">
                          Oleh {recording.artist} {recording.studentNim && recording.studentNim !== '-' && recording.studentNim !== 'Umum' ? `(@${recording.studentNim})` : ''}
                        </p>
                        <div className="flex items-center gap-3 pt-2 text-[9px] font-mono text-neutral-500">
                          <span>Mulai: {recording.createdAt}</span>
                          <span>•</span>
                          <span>Durasi: {recording.duration}s</span>
                          <span>•</span>
                          <span>Total Nada: {recording.notesCount} hits</span>
                        </div>
                      </div>

                      {/* Controls tools */}
                      <div className="flex items-center gap-3 w-full sm:w-auto self-end sm:self-center">
                        {isThisPlaying ? (
                          <button
                            type="button"
                            onClick={stopPlayback}
                            className="text-xs font-mono uppercase tracking-wider text-amber-500 hover:text-amber-400 cursor-pointer animate-pulse"
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startCompositionPlayback(recording)}
                            className="px-4 py-2 bg-white text-black hover:bg-neutral-200 text-[10px] font-semibold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                          >
                            Putar
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => downloadCompositionBackup(recording)}
                          disabled={downloadingId !== null}
                          className="p-2 border border-white/5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                          title="Download sound file (.mp3)"
                        >
                          {downloadingId === recording.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(recording.id)}
                          className="p-2 border border-white/5 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
                          title="Hapus rekaman"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Virtual Playback Keybed Preview */}
        <div className="lg:col-span-4 border border-white/[0.04] bg-[#0c0c10]/40 rounded-3xl p-8 space-y-6">
          <h3 className="text-sm tracking-wider uppercase text-neutral-300 font-medium">
            Visualizer Musik Real-Time
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed font-light font-sans">
            Ketika melodi diputar dari database, visualizer interaktif di bawah ini akan menyala menyinkronkan nada apa saja yang berbunyi secara real-time!
          </p>

          <div className="pt-2 pb-2">
            {/* Live interactive block layout representing the 24 notes preview */}
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 24 }).map((_, idx) => {
                const noteName = PIANO_KEYS[idx].note;
                const isPressed = activePlaybackKeys.has(idx);
                return (
                  <div
                    key={idx}
                    className={`py-1.5 px-1 rounded-md font-mono text-center text-[8.5px] uppercase font-bold transition-all ${
                      isPressed
                        ? 'bg-neutral-100 text-black shadow-md'
                        : 'bg-white/[0.02] text-neutral-600'
                    }`}
                  >
                    {noteName}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </main>

      {/* Footer layout */}
      <footer className="border-t border-white/[0.04] pt-6 text-center text-[10px] text-neutral-500 font-mono tracking-wider">
        © 2026 Fayi Amatullah Azhara - Air Piano Virtual - Universitas Andalas
      </footer>

      {/* Confirmation Modal overlay */}
      <AnimatePresence>
        {deleteTargetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setDeleteTargetId(null)}
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
                  Yakin menghapus rekaman ini?
                </h4>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Tindakan ini bersifat permanen dan tidak dapat dibatalkan dari database cloud.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(null)}
                  className="px-4 py-2 text-xs uppercase tracking-widest text-neutral-400 hover:text-white transition-colors cursor-pointer bg-white/5 hover:bg-white/10 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteRecording(deleteTargetId);
                    setDeleteTargetId(null);
                  }}
                  className="px-4 py-2 text-xs uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors cursor-pointer bg-red-950/30 hover:bg-red-950/50 border border-red-900/30 rounded-xl font-medium"
                >
                  Yakin
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
