/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NoteEvent {
  note: string;
  keyIndex: number;
  time: number; // relative start time in ms
  duration?: number; // duration in ms
}

export interface Recording {
  id: string;
  title: string;
  artist: string;
  studentNim: string;
  duration: number; // total duration in seconds
  notesCount: number;
  createdAt: string;
  notes: NoteEvent[];
}

export interface StudentProfile {
  name: string;
  nim: string;
  institution: string;
  classCode: string;
}

export interface PianoKey {
  index: number;
  note: string;
  isBlack: boolean;
  label: string;
  frequency: number;
}

export interface InferenceFrame {
  timestamp: number;
  latency: number;
  confidence: number;
  success: boolean;
}

export interface TrackingStats {
  totalFramesTested: number;
  averageInferenceTime: number; // ms
  modelAccuracy: number; // represented as tracking success rate / avg confidence percentage
  totalActiveKeysPlayed: number;
}
