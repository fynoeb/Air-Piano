/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PianoKey } from '../types';

// Hardcoded Frequencies and labels for 24 keys (C4 to B5)
export const PIANO_KEYS: PianoKey[] = [
  { index: 0, note: 'C4', isBlack: false, label: 'C4', frequency: 261.63 },
  { index: 1, note: 'C#4', isBlack: true, label: 'C#4', frequency: 277.18 },
  { index: 2, note: 'D4', isBlack: false, label: 'D4', frequency: 293.66 },
  { index: 3, note: 'D#4', isBlack: true, label: 'D#4', frequency: 311.13 },
  { index: 4, note: 'E4', isBlack: false, label: 'E4', frequency: 329.63 },
  { index: 5, note: 'F4', isBlack: false, label: 'F4', frequency: 349.23 },
  { index: 6, note: 'F#4', isBlack: true, label: 'F#4', frequency: 369.99 },
  { index: 7, note: 'G4', isBlack: false, label: 'G4', frequency: 392.00 },
  { index: 8, note: 'G#4', isBlack: true, label: 'G#4', frequency: 415.30 },
  { index: 9, note: 'A4', isBlack: false, label: 'A4', frequency: 440.00 },
  { index: 10, note: 'A#4', isBlack: true, label: 'A#4', frequency: 466.16 },
  { index: 11, note: 'B4', isBlack: false, label: 'B4', frequency: 493.88 },
  
  { index: 12, note: 'C5', isBlack: false, label: 'C5', frequency: 523.25 },
  { index: 13, note: 'C#5', isBlack: true, label: 'C#5', frequency: 554.37 },
  { index: 14, note: 'D5', isBlack: false, label: 'D5', frequency: 587.33 },
  { index: 15, note: 'D#5', isBlack: true, label: 'D#5', frequency: 622.25 },
  { index: 16, note: 'E5', isBlack: false, label: 'E5', frequency: 659.25 },
  { index: 17, note: 'F5', isBlack: false, label: 'F5', frequency: 698.46 },
  { index: 18, note: 'F#5', isBlack: true, label: 'F#5', frequency: 739.99 },
  { index: 19, note: 'G5', isBlack: false, label: 'G5', frequency: 783.99 },
  { index: 20, note: 'G#5', isBlack: true, label: 'G#5', frequency: 830.61 },
  { index: 21, note: 'A5', isBlack: false, label: 'A5', frequency: 880.00 },
  { index: 22, note: 'A#5', isBlack: true, label: 'A#5', frequency: 932.33 },
  { index: 23, note: 'B5', isBlack: false, label: 'B5', frequency: 987.77 },
];

let audioCtx: AudioContext | null = null;
let reverbNode: ConvolverNode | null = null;
let masterGain: GainNode | null = null;

// Initialize Audio Context and master nodes (including concert hall reverb)
export function initAudio(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();

    // Create a reverb processor programmatically
    reverbNode = createReverb(audioCtx, 1.8); // 1.8 seconds decay for deep orchestral vibe
    
    // Create master volume
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.7, audioCtx.currentTime);

    // Patch reverb and master
    reverbNode.connect(masterGain);
    masterGain.connect(audioCtx.destination);
  }
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  return audioCtx;
}

// Generate an algorithmic impulse response for beautiful orchestra reverb
function createReverb(ctx: AudioContext, seconds: number): ConvolverNode {
  const rate = ctx.sampleRate;
  const len = rate * seconds;
  const impulse = ctx.createBuffer(2, len, rate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < len; i++) {
    // Exponential decay of random white noise
    const decay = Math.pow(1 - i / len, 2.5);
    left[i] = (Math.random() * 2 - 1) * decay;
    right[i] = (Math.random() * 2 - 1) * decay;
  }

  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

// Play a synthesized piano key
export function playPianoNote(keyIndex: number, velocity: number = 0.8) {
  try {
    const ctx = initAudio();
    const key = PIANO_KEYS[keyIndex];
    if (!key) return;

    const fundamental = key.frequency;
    const now = ctx.currentTime;

    // Create oscillators for fundamental + harmonics simulating real piano strings
    const oscs: OscillatorNode[] = [];
    const masterGainForNote = ctx.createGain();

    // Tone shaping: Harmonic ratios and amplitudes
    const harmonics = [
      { ratio: 1, gain: 0.6, type: 'triangle' as OscillatorType },
      { ratio: 2, gain: 0.25, type: 'triangle' as OscillatorType },
      { ratio: 3, gain: 0.1, type: 'sine' as OscillatorType },
      { ratio: 4, gain: 0.05, type: 'sine' as OscillatorType }
    ];

    harmonics.forEach(harmonic => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      
      osc.type = harmonic.type;
      osc.frequency.setValueAtTime(fundamental * harmonic.ratio, now);
      
      // Slight de-tuning for higher harmonics adds warmth & physical resonance
      if (harmonic.ratio > 1) {
        osc.detune.setValueAtTime((Math.random() * 10 - 5) * (harmonic.ratio - 1), now);
      }

      oscGain.gain.setValueAtTime(harmonic.gain * velocity, now);

      osc.connect(oscGain);
      oscGain.connect(masterGainForNote);
      oscs.push(osc);
    });

    // Generate hammer strike pop (high frequency noise pluck)
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.015, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseData.length, 2);
    }
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15 * velocity, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    noiseNode.connect(noiseGain);
    noiseGain.connect(masterGainForNote);

    // Master Note Envelope
    const gainEnv = ctx.createGain();
    // Piano key trigger envelope: Instant trigger, decay, long gentle sustain/release
    gainEnv.gain.setValueAtTime(0.001, now);
    gainEnv.gain.linearRampToValueAtTime(1.0, now + 0.005); // Rapid piano hammer strike attack
    gainEnv.gain.exponentialRampToValueAtTime(0.3, now + 0.35); // Key bounce/decay
    gainEnv.gain.exponentialRampToValueAtTime(0.001, now + 1.8); // Ring out / decay release

    // Route connections: oscillators -> MasterNote -> NoteEnvelope -> Wet Reverb & Dry mix
    masterGainForNote.connect(gainEnv);

    // Standard dry output signal
    if (masterGain) {
      gainEnv.connect(masterGain);
    }
    
    // Wet Reverb mix
    if (reverbNode) {
      const wetGain = ctx.createGain();
      wetGain.gain.setValueAtTime(0.45 * velocity, now); // Sweet balance between spatial depth & crispness
      gainEnv.connect(wetGain);
      wetGain.connect(reverbNode);
    }

    // Start oscillators and noise burst
    oscs.forEach(osc => {
      osc.start(now);
      osc.stop(now + 1.95);
    });
    noiseNode.start(now);

  } catch (err) {
    console.warn('Could not produce audio note:', err);
  }
}

// Convert floating-point AudioBuffer into 16-bit PCM WAV Binary Blob (MIME audio/mp3)
function bufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };

  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // Write WAV RIFF header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // File size - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // Subchunk1Size = 16 (for PCM)
  setUint16(1);                                  // AudioFormat = 1 (linear PCM)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);  // ByteRate = SampleRate * NumChannels * BitsPerSample/8
  setUint16(numOfChan * 2);                      // BlockAlign = NumChannels * BitsPerSample/8
  setUint16(16);                                 // BitsPerSample = 16

  setUint32(0x61746164);                         // "data" chunk
  setUint32(length - pos - 4);                   // Chunk size

  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length && offset < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArr], { type: 'audio/mp3' });
}

// Full client-side synthesis compiling the note sequence to audio
export async function synthesizeRecordingToWav(notes: any[], durationSecs: number): Promise<Blob> {
  const sampleRate = 44100;
  // Pad the duration slightly for visual ring out decay
  const totalDuration = Math.max(1.5, durationSecs + 2.0);
  const totalSamples = Math.floor(sampleRate * totalDuration);
  
  const OfflineContextClass = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offCtx = new OfflineContextClass(2, totalSamples, sampleRate);

  // Generate beautiful algorithmic orchestral reverb impulse response offline
  const offReverb = offCtx.createConvolver();
  const reverbDecaySecs = 1.6;
  const revLen = Math.floor(sampleRate * reverbDecaySecs);
  const impulse = offCtx.createBuffer(2, revLen, sampleRate);
  const leftChannel = impulse.getChannelData(0);
  const rightChannel = impulse.getChannelData(1);
  for (let i = 0; i < revLen; i++) {
    const decay = Math.pow(1 - i / revLen, 2.5);
    leftChannel[i] = (Math.random() * 2 - 1) * decay;
    rightChannel[i] = (Math.random() * 2 - 1) * decay;
  }
  offReverb.buffer = impulse;

  // Master offline mix chain
  const masterGainNode = offCtx.createGain();
  masterGainNode.gain.setValueAtTime(0.7, 0);

  offReverb.connect(masterGainNode);
  masterGainNode.connect(offCtx.destination);

  notes.forEach(evt => {
    const key = PIANO_KEYS[evt.keyIndex];
    if (!key) return;

    // Time offset parameter conversion to physical seconds
    const noteStartTime = Math.max(0, evt.time / 1000);
    const fundamental = key.frequency;
    const velocity = 0.85;

    const masterGainForNote = offCtx.createGain();

    const harmonics = [
      { ratio: 1, gain: 0.6, type: 'triangle' as OscillatorType },
      { ratio: 2, gain: 0.25, type: 'triangle' as OscillatorType },
      { ratio: 3, gain: 0.1, type: 'sine' as OscillatorType },
      { ratio: 4, gain: 0.05, type: 'sine' as OscillatorType }
    ];

    const oscs: OscillatorNode[] = [];
    harmonics.forEach(harmonic => {
      const osc = offCtx.createOscillator();
      const oscGain = offCtx.createGain();
      
      osc.type = harmonic.type;
      osc.frequency.setValueAtTime(fundamental * harmonic.ratio, noteStartTime);
      
      if (harmonic.ratio > 1) {
        osc.detune.setValueAtTime((Math.random() * 10 - 5) * (harmonic.ratio - 1), noteStartTime);
      }

      oscGain.gain.setValueAtTime(harmonic.gain * velocity, noteStartTime);
      osc.connect(oscGain);
      oscGain.connect(masterGainForNote);
      oscs.push(osc);
    });

    const gainEnv = offCtx.createGain();
    gainEnv.gain.setValueAtTime(0.001, noteStartTime);
    gainEnv.gain.linearRampToValueAtTime(1.0, noteStartTime + 0.005);
    gainEnv.gain.exponentialRampToValueAtTime(0.3, noteStartTime + 0.35);
    gainEnv.gain.exponentialRampToValueAtTime(0.001, noteStartTime + 1.8);

    masterGainForNote.connect(gainEnv);
    gainEnv.connect(masterGainNode);

    const wetGain = offCtx.createGain();
    wetGain.gain.setValueAtTime(0.40 * velocity, noteStartTime);
    gainEnv.connect(wetGain);
    wetGain.connect(offReverb);

    oscs.forEach(osc => {
      osc.start(noteStartTime);
      osc.stop(noteStartTime + 1.95);
    });
  });

  const renderedBuffer = await offCtx.startRendering();
  return bufferToWavBlob(renderedBuffer);
}
