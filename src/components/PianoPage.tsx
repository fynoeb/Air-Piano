/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera as CameraIcon, Upload, ArrowLeft, Play, Square, Disc, Sparkles, Volume2, ShieldAlert, CheckCircle2, RotateCcw } from 'lucide-react';
import { PIANO_KEYS, playPianoNote } from '../utils/audio';
import { NoteEvent, Recording, TrackingStats, StudentProfile } from '../types';

interface PianoPageProps {
  onBack: () => void;
  profile: StudentProfile;
  onSaveRecording: (recording: Omit<Recording, 'id' | 'createdAt'>) => void;
  stats: TrackingStats;
  onUpdateStats: (newFrame: { latency: number; confidence: number; keysPlayed: number }) => void;
  onResetStats: () => void;
}

// Bounding box mapping details
interface KeyBoundingBox {
  index: number;
  note: string;
  isBlack: boolean;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
}

export default function PianoPage({
  onBack,
  profile,
  onSaveRecording,
  stats,
  onUpdateStats,
  onResetStats
}: PianoPageProps) {
  // Mode selection: webcam or image upload
  const [activeMode, setActiveMode] = useState<'webcam' | 'upload'>('webcam');
  
  // Media states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  
  // Hand tracking states
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [inferenceTime, setInferenceTime] = useState(0); // in ms
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordStartTime, setRecordStartTime] = useState<number | null>(null);
  const [recordedNotes, setRecordedNotes] = useState<NoteEvent[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0); // in seconds
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedTitle, setSavedTitle] = useState('');

  const isRecordingRef = useRef(false);
  const recordStartTimeRef = useRef<number | null>(null);
  const recordedNotesRef = useRef<NoteEvent[]>([]);
  
  // Canvas & refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const handsModelRef = useRef<any>(null);
  const cameraHelperRef = useRef<any>(null);
  const cameraActiveRef = useRef<boolean>(false);
  const latestResultsRef = useRef<any>(null);
  const isInferenceBusyRef = useRef<boolean>(false);

  // Keep track of held keys for each finger to prevent machine-gun trigger sounds
  const fingersStateRef = useRef<{ [fingerId: string]: number | null }>({
    'thumb': null,
    'index': null,
    'middle': null,
    'ring': null,
    'pinky': null
  });

  // Accumulate tracking stats to throttle re-renders (anti-stutter / smooth performance)
  const statsBufferRef = useRef<{ total: number; sumLatency: number; sumConfidence: number; activeKeysCount: number }>({
    total: 0,
    sumLatency: 0,
    sumConfidence: 0,
    activeKeysCount: 0
  });

  // Periodically flush tracking statistics to the parent application (every 3 seconds) instead of 30 frames-per-second to prevent lag/re-rendering freezes
  useEffect(() => {
    const handle = setInterval(() => {
      if (statsBufferRef.current.total > 0) {
        const { total, sumLatency, sumConfidence, activeKeysCount } = statsBufferRef.current;
        onUpdateStats({
          latency: Math.round(sumLatency / total),
          confidence: sumConfidence / total,
          keysPlayed: activeKeysCount
        });
        // reset buffer
        statsBufferRef.current = { total: 0, sumLatency: 0, sumConfidence: 0, activeKeysCount: 0 };
      }
    }, 3000);
    return () => clearInterval(handle);
  }, [onUpdateStats]);

  // Calculate piano layout keys normalized coordinate boxes
  const keyBoxes = useRef<KeyBoundingBox[]>([]);

  // Initialize the bounding boxes once
  useEffect(() => {
    const whiteKeys = PIANO_KEYS.filter(k => !k.isBlack);
    const totalWhite = whiteKeys.length; // 14 white keys
    const wWidth = 1.0 / totalWhite; // normalized white key width (approx 0.0714)

    const boxes: KeyBoundingBox[] = [];

    // Map white keys
    whiteKeys.forEach((wKey, idx) => {
      boxes.push({
        index: wKey.index,
        note: wKey.note,
        isBlack: false,
        xStart: idx * wWidth,
        xEnd: (idx + 1) * wWidth,
        yStart: 0.35, // centered horizontally/vertically in active middle area
        yEnd: 0.65
      });
    });

    // Map black keys (drawn over white key boundaries)
    // Black keys are placed at junctions: C#4, D#4, (gap), F#4, G#4, A#4, (gap)...
    const blackKeyPlacements = [
      { keyIdx: 1, boundaryIdx: 1 },  // C#4 between col 0 & 1
      { keyIdx: 3, boundaryIdx: 2 },  // D#4 between col 1 & 2
      { keyIdx: 6, boundaryIdx: 4 },  // F#4 between col 3 & 4
      { keyIdx: 8, boundaryIdx: 5 },  // G#4 between col 4 & 5
      { keyIdx: 10, boundaryIdx: 6 }, // A#4 between col 5 & 6
      { keyIdx: 13, boundaryIdx: 8 }, // C#5 between col 7 & 8
      { keyIdx: 15, boundaryIdx: 9 }, // D#5 between col 8 & 9
      { keyIdx: 18, boundaryIdx: 11 },// F#5 between col 10 & 11
      { keyIdx: 20, boundaryIdx: 12 },// G#5 between col 11 & 12
      { keyIdx: 22, boundaryIdx: 13 } // A#5 between col 12 & 13
    ];

    const blackWidth = wWidth * 0.58; // a bit narrower than white

    blackKeyPlacements.forEach(b => {
      const parentKey = PIANO_KEYS[b.keyIdx];
      const centerX = b.boundaryIdx * wWidth;
      boxes.push({
        index: b.keyIdx,
        note: parentKey.note,
        isBlack: true,
        xStart: centerX - (blackWidth / 2),
        xEnd: centerX + (blackWidth / 2),
        yStart: 0.35,
        yEnd: 0.53 // black keys are shorter
      });
    });

    keyBoxes.current = boxes;
  }, []);

  // Set up the MediaPipe Model loading
  useEffect(() => {
    let active = true;

    async function loadMediaPipe() {
      if (!(window as any).Hands) {
        console.warn("MediaPipe is not loaded yet. Retrying in 1s...");
        setTimeout(loadMediaPipe, 1000);
        return;
      }

      try {
        const hands = new (window as any).Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1, // fast and reliable
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55
        });

        hands.onResults((results: any) => {
          if (active) {
            handleTrackingResults(results);
          }
        });

        handsModelRef.current = hands;
        setIsModelLoading(false);
      } catch (err) {
        console.error("Failed to load MediaPipe Hands:", err);
        setCameraError("Gagal mempersiapkan algoritma computer vision. Silakan refresh halaman.");
      }
    }

    loadMediaPipe();

    return () => {
      active = false;
      stopCamera();
    };
  }, []);

  // Auto-launch camera when model is fully prepared
  useEffect(() => {
    if (!isModelLoading && handsModelRef.current && !cameraActive && !cameraError) {
      startCamera();
    }
  }, [isModelLoading]);

  // Timer for recording (No limit)
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        if (recordStartTime) {
          const elapsed = (Date.now() - recordStartTime) / 1000;
          setRecordingDuration(elapsed);
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isRecording, recordStartTime]);

  // Clean stop the camera stream
  const stopCamera = () => {
    cameraActiveRef.current = false;
    isInferenceBusyRef.current = false;
    latestResultsRef.current = null;
    if (cameraHelperRef.current) {
      try {
        cameraHelperRef.current.stop();
      } catch (e) {}
      cameraHelperRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
    setCameraActive(false);
  };

  // Start the live Camera stream
  const startCamera = async () => {
    setCameraError(null);
    stopCamera();

    if (isModelLoading || !handsModelRef.current) {
      setCameraError("Keamanan model belum siap dialokasikan.");
      return;
    }

    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        const initializePlayback = () => {
          if (cameraActiveRef.current) return;
          videoRef.current?.play().catch(e => console.log("Playback failed:", e));
          setCameraActive(true);
          cameraActiveRef.current = true;
          startStreamingInference();
        };

        videoRef.current.onloadedmetadata = initializePlayback;
        videoRef.current.onloadeddata = initializePlayback;
        videoRef.current.oncanplay = initializePlayback;

        setTimeout(() => {
          if (!cameraActiveRef.current && videoRef.current) {
            initializePlayback();
          }
        }, 350);
      }
    } catch (err: any) {
      console.error("Camera connection failed:", err);
      setCameraError("Kamera perangkat tidak diizinkan atau sedang digunakan aplikasi lain.");
    }
  };

  // Run real-time frames loop directly via requestAnimationFrame for max responsiveness & decoupled camera rendering
  const startStreamingInference = () => {
    const processFrame = async () => {
      if (!cameraActiveRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video && canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx && (video.readyState >= 2 || video.videoWidth > 0)) {
          const videoWidth = video.videoWidth || 640;
          const videoHeight = video.videoHeight || 480;
          
          if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
            canvas.width = videoWidth;
            canvas.height = videoHeight;
          }
          const width = canvas.width;
          const height = canvas.height;

          // Clear previous canvas frames
          ctx.clearRect(0, 0, width, height);

          // Draw webcam feed mirrored immediately at 60fps for seamless visual feedback
          ctx.save();
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, width, height);
          ctx.restore();

          // Draw the static piano overlay keyboard
          drawPianoOverlay(ctx, width, height);

          // Draw the tracking skeletons and feedback points from the latest results if available
          const results = latestResultsRef.current;
          if (results && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            results.multiHandLandmarks.forEach((landmarks: any[]) => {
              drawSkeleton(ctx, landmarks, width, height);

              const fingertipIds = [
                { name: 'thumb', id: 4 },
                { name: 'index', id: 8 },
                { name: 'middle', id: 12 },
                { name: 'ring', id: 16 },
                { name: 'pinky', id: 20 }
              ];

              fingertipIds.forEach(finger => {
                const tip = landmarks[finger.id];
                if (!tip) return;

                let pressedKeyIdx: number | null = null;
                let isHoveringKey = false;

                for (const key of keyBoxes.current) {
                  const normalizedX = 1.0 - tip.x;
                  const inX = normalizedX >= key.xStart && normalizedX <= key.xEnd;
                  const inY = tip.y >= key.yStart && tip.y <= key.yEnd;

                  if (inX && inY) {
                    isHoveringKey = true;
                    if (isFingerPressingKey(landmarks, finger.id, key)) {
                      pressedKeyIdx = key.index;
                      break;
                    }
                  }
                }

                const drawX = (1.0 - tip.x) * width;
                const drawY = tip.y * height;
                ctx.beginPath();
                ctx.arc(drawX, drawY, 8, 0, 2 * Math.PI);
                
                if (pressedKeyIdx !== null) {
                  ctx.fillStyle = '#FFC107'; // Active yellow note trigger
                } else if (isHoveringKey) {
                  ctx.fillStyle = '#10B981'; // Green hover over key ready to strike
                } else {
                  ctx.fillStyle = '#EF4444'; // Red float idle state outside zones
                }
                
                ctx.fill();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.5;
                ctx.stroke();
              });
            });
          }

          // Trigger next inference asynchronously without blocking the smooth 60fps rendering thread
          if (handsModelRef.current && !isInferenceBusyRef.current) {
            isInferenceBusyRef.current = true;
            const t0 = performance.now();
            handsModelRef.current.send({ image: video })
              .then(() => {
                const dt = performance.now() - t0;
                setInferenceTime(Math.round(dt));
              })
              .catch((err: any) => {
                console.warn("Inference send error:", err);
              })
              .finally(() => {
                isInferenceBusyRef.current = false;
              });
          }
        }
      }

      if (cameraActiveRef.current) {
        frameIdRef.current = requestAnimationFrame(processFrame);
      }
    };
    frameIdRef.current = requestAnimationFrame(processFrame);
  };

  // Helper to determine if a specific fingertip matches key bounds and triggers a 'bending/strike' action
  const isFingerPressingKey = (landmarks: any[], fingerId: number, key: KeyBoundingBox): boolean => {
    const tip = landmarks[fingerId];
    if (!tip) return false;

    const normalizedX = 1.0 - tip.x;
    const inX = normalizedX >= key.xStart && normalizedX <= key.xEnd;
    const inY = tip.y >= key.yStart && tip.y <= key.yEnd;

    if (!inX || !inY) return false;

    if (fingerId === 4) {
      const mcp = landmarks[2];
      const ip = landmarks[3];
      return tip.y > ip.y - 0.005 || Math.abs(tip.x - mcp.x) < 0.04;
    } else {
      const dip = landmarks[fingerId - 1];
      const pip = landmarks[fingerId - 2];
      const mcp = landmarks[fingerId - 3];
      const isCurled = tip.y > (pip.y - 0.005) || (mcp.y - tip.y < 0.045);
      return isCurled;
    }
  };

  // Translate detected MediaPipe hand tracking coordinates to visual overlay and piano note triggers
  const handleTrackingResults = (results: any) => {
    // Save the latest tracking results reference for high performance drawing loop
    latestResultsRef.current = results;

    let averageConfidence = 0;
    const activeKeysThisFrame = new Set<number>();

    if (results && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const handScores = results.multiHandedness.map((h: any) => h.score);
      averageConfidence = handScores.reduce((a: number, b: number) => a + b, 0) / handScores.length;
      setCurrentConfidence(averageConfidence);

      results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
        const fingertipIds = [
          { name: 'thumb', id: 4 },
          { name: 'index', id: 8 },
          { name: 'middle', id: 12 },
          { name: 'ring', id: 16 },
          { name: 'pinky', id: 20 }
        ];

        fingertipIds.forEach(finger => {
          const tip = landmarks[finger.id];
          if (!tip) return;
          
          let pressedKeyIdx: number | null = null;

          for (const key of keyBoxes.current) {
            const normalizedX = 1.0 - tip.x;
            const inX = normalizedX >= key.xStart && normalizedX <= key.xEnd;
            const inY = tip.y >= key.yStart && tip.y <= key.yEnd;

            if (inX && inY) {
              if (isFingerPressingKey(landmarks, finger.id, key)) {
                pressedKeyIdx = key.index;
                break;
              }
            }
          }

          const fingerUniqueKey = `hand${handIndex}_${finger.name}`;
          const previouslyHeldKey = fingersStateRef.current[fingerUniqueKey] ?? null;

          if (pressedKeyIdx !== null) {
            activeKeysThisFrame.add(pressedKeyIdx);

            if (previouslyHeldKey !== pressedKeyIdx) {
              triggerPianoPress(pressedKeyIdx);
              fingersStateRef.current[fingerUniqueKey] = pressedKeyIdx;
            }
          } else {
            fingersStateRef.current[fingerUniqueKey] = null;
          }
        });
      });
    } else {
      setCurrentConfidence(0);
      Object.keys(fingersStateRef.current).forEach(k => {
        fingersStateRef.current[k] = null;
      });
    }

    setActiveKeys(activeKeysThisFrame);

    statsBufferRef.current.total += 1;
    statsBufferRef.current.sumLatency += (inferenceTime || 12);
    statsBufferRef.current.sumConfidence += averageConfidence;
    if (activeKeysThisFrame.size > 0) {
      statsBufferRef.current.activeKeysCount += activeKeysThisFrame.size;
    }
  };

  // Draw elegant classical piano overlay on the video feeds
  const drawPianoOverlay = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Draw active key collision bounding feedback rectangles with clean translucent colors
    keyBoxes.current.forEach(key => {
      const isCurrentlyPressed = activeKeys.has(key.index);
      
      const xS = key.xStart * w;
      const xE = key.xEnd * w;
      const kw = xE - xS;
      const yS = key.yStart * h;
      const yE = key.yEnd * h;
      const kh = yE - yS;

      if (key.isBlack) {
        ctx.fillStyle = isCurrentlyPressed ? 'rgba(239, 68, 68, 0.90)' : 'rgba(20, 20, 25, 0.90)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.fillRect(xS, yS, kw, kh);
        ctx.strokeRect(xS, yS, kw, kh);
      } else {
        // Highly visible keys with clean, higher contrast borders and premium opacity
        ctx.fillStyle = isCurrentlyPressed ? 'rgba(239, 68, 68, 0.85)' : 'rgba(255, 255, 255, 0.75)';
        ctx.strokeStyle = 'rgba(15, 15, 20, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.fillRect(xS, yS, kw, kh);
        ctx.strokeRect(xS, yS, kw, kh);
      }

      // Draw Key text indicators with high-contrast text colors
      if (!key.isBlack) {
        ctx.fillStyle = isCurrentlyPressed ? '#ffffff' : '#111111';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(key.note, xS + kw / 2, yE - 8);
      }
    });
  };

  // Draw joint mapping skeleton from MediaPipe Hands data
  const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[], w: number, h: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;

    // MediaPipe Hand connectors indices
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [9, 10], [10, 11], [11, 12],     // Middle (joint 0-9 is skipped but handled bottom)
      [13, 14], [14, 15], [15, 16],    // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17] // Palm connections
    ];

    // Connect joints
    connections.forEach(([p1, p2]) => {
      const pt1 = landmarks[p1];
      const pt2 = landmarks[p2];

      const x1 = (1.0 - pt1.x) * w;
      const y1 = pt1.y * h;
      const x2 = (1.0 - pt2.x) * w;
      const y2 = pt2.y * h;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.stroke();
    });

    // Draw small landmark dots represent points in mathematical coordinate space
    landmarks.forEach((pt) => {
      const x = (1.0 - pt.x) * w;
      const y = pt.y * h;

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    });
  };

  // Triggers the note synthesis and updates recording records if activated
  const triggerPianoPress = (keyIdx: number) => {
    // Play synthesizer sound
    playPianoNote(keyIdx, 0.85);

    // If recording, log the note event (use refs to prevent stale closure)
    if (isRecordingRef.current && recordStartTimeRef.current !== null) {
      const relTime = Date.now() - recordStartTimeRef.current;
      const keyObj = PIANO_KEYS[keyIdx];
      const newEvent: NoteEvent = {
        note: keyObj.note,
        keyIndex: keyIdx,
        time: relTime
      };
      recordedNotesRef.current = [...recordedNotesRef.current, newEvent];
      setRecordedNotes(recordedNotesRef.current);
    }
  };

  // Handle image uploads for offline evaluation of image processing pipeline
  const handleImageUploaded = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActiveMode('upload');
    stopCamera();

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      // Draw uploaded image to Canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width = img.width;
      const height = canvas.height = img.height;

      ctx.drawImage(img, 0, 0, width, height);

      if (handsModelRef.current) {
        setIsModelLoading(true);
        try {
          // Pass static image node to MediaPipe Hands analyzer
          await handsModelRef.current.send({ image: img });
        } catch (error) {
          console.error("Static image analysis failed", error);
        } finally {
          setIsModelLoading(false);
        }
      }
    };
  };

  // Manage Recording flows
  const handleStartRecording = () => {
    setRecordedNotes([]);
    recordedNotesRef.current = [];
    setRecordStartTime(Date.now());
    recordStartTimeRef.current = Date.now();
    setRecordingDuration(0);
    setIsRecording(true);
    isRecordingRef.current = true;
  };

  const handleStopRecording = () => {
    if (!isRecordingRef.current) return;
    setIsRecording(false);
    isRecordingRef.current = false;
    if (recordedNotesRef.current.length > 0) {
      setShowSaveModal(true);
    } else {
      alert("Tidak ada melodi terdeteksi dalam durasi rekaman.");
    }
  };

  const handleSaveRecordedMelody = (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedTitle.trim()) return;

    onSaveRecording({
      title: savedTitle,
      artist: profile.name,
      studentNim: profile.nim,
      duration: Math.max(1, Math.round(recordingDuration)),
      notesCount: recordedNotesRef.current.length,
      notes: recordedNotesRef.current
    });

    setSavedTitle('');
    setShowSaveModal(false);
    setRecordedNotes([]);
    recordedNotesRef.current = [];
    setRecordStartTime(null);
    recordStartTimeRef.current = null;
    setRecordingDuration(0);
  };

  // Virtual key highlights from physical clicks (providing alternative access)
  const handleManualKeyClick = (idx: number) => {
    triggerPianoPress(idx);
    setActiveKeys(prev => {
      const next = new Set(prev);
      next.add(idx);
      // Automatically remove click indicator after 250ms visual ring
      setTimeout(() => {
        setActiveKeys(prevActive => {
          const updatedActive = new Set(prevActive);
          updatedActive.delete(idx);
          return updatedActive;
        });
      }, 250);
      return next;
    });
  };

  return (
    <div className="min-h-screen text-neutral-100 flex flex-col justify-between w-full max-w-full px-4 sm:px-8 py-6 relative z-10">
      
      {/* Back Button and Header */}
      <header className="flex items-center justify-between border-b border-white/[0.04] pb-6 mb-8">
        <button
          type="button"
          id="btn-back-home"
          onClick={onBack}
          className="text-xs uppercase tracking-widest text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          &larr; Beranda
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-display font-light text-white tracking-wide">
            Air Piano
          </h2>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono mt-1">
            {profile.classCode}
          </p>
        </div>

        {/* Display live model indicator without Sistem Aktif */}
        <div className="flex items-center gap-2">
          {isModelLoading && (
            <span className="text-amber-500 text-[10px] uppercase tracking-wider font-mono">
              Loading Model...
            </span>
          )}
        </div>
      </header>

      {/* Main content area spanning edge-to-edge */}
      <main className="space-y-6 flex-grow">
        
        {/* Camera/Canvas Stage: NOW FULL WIDTH from left to right */}
        <div className="w-full flex flex-col justify-between bg-[#0e0e12]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative">
          
          {/* Header indicator panels */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 bg-neutral-900 border border-white/5 rounded-xl text-xs font-semibold text-neutral-300 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <CameraIcon className="w-3.5 h-3.5 text-neutral-400" /> Deteksi Kamera
              </span>
              {cameraActive ? (
                <button
                  type="button"
                  id="btn-stop-camera-inline"
                  onClick={stopCamera}
                  className="px-3.5 py-1.5 bg-red-950/20 hover:bg-red-900/35 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white rounded-xl text-[10px] font-bold font-mono uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.05)]"
                >
                  Matikan Kamera
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-start-camera-inline"
                  onClick={startCamera}
                  disabled={isModelLoading}
                  className="px-3.5 py-1.5 bg-emerald-950/20 hover:bg-emerald-900/35 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-white rounded-xl text-[10px] font-bold font-mono uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.05)]"
                >
                  Aktifkan Kamera
                </button>
              )}
            </div>

            {/* Micro Latency readout */}
            <div className="flex gap-4 text-xs font-mono bg-black/40 px-3.5 py-1.5 rounded-xl border border-white/5">
              <span className="text-neutral-400">
                Inference Speed: <strong className="text-white">{inferenceTime}ms</strong>
              </span>
              <span className="text-neutral-400">
                Tracking Confidence: <strong className="text-emerald-400">{Math.round(currentConfidence * 100)}%</strong>
              </span>
            </div>
          </div>

          {/* Majestic Full-Width Interactive Stage */}
          <div className="relative flex-grow flex items-center justify-center bg-black/60 rounded-2xl overflow-hidden border border-white/5 min-h-[360px] w-full">
            
            {/* Native Video Node (hidden but active for MediaPipe) */}
            <video
              ref={videoRef}
              className="absolute pointer-events-none opacity-0 w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Direct Processing Canvas Frame: stretched gracefully */}
            <canvas
              ref={canvasRef}
              className="w-full max-h-[550px] md:max-h-[620px] h-auto block rounded-2xl shadow-2xl object-contain transition-all"
            />

            {/* Overlay instruction alerts if camera not started */}
            {activeMode === 'webcam' && !cameraActive && (
              <div className="absolute inset-0 bg-[#08080a]/95 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <Volume2 className="w-12 h-12 text-red-500 animate-bounce" />
                <h4 className="text-base font-display font-bold text-white">Mulai Deteksi Tangan Webcam</h4>
                <p className="text-xs text-neutral-400 max-w-sm">
                  Aktifkan kamera laptop Anda untuk menyejajarkan tangan Anda di panggung instrumen virtual pameran.
                </p>
                <button
                  type="button"
                  id="btn-start-camera"
                  onClick={startCamera}
                  disabled={isModelLoading}
                  className="px-6 py-3 bg-red-700 disabled:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-md hover:bg-red-650 active:scale-95 transition-all cursor-pointer"
                >
                  Izinkan & Aktifkan Kamera
                </button>
                {cameraError && (
                  <div className="flex gap-1.5 items-center bg-red-950/20 p-2.5 rounded-xl border border-red-900/30 text-[11px] text-red-400 mt-2">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Under-canvas controls split row for Recording studio and Live stats indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Recording interface widget */}
          <div className="bg-[#0e0e12]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-display font-medium text-white border-b border-white/5 pb-2 flex items-center gap-2">
                Studio Rekaman
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Gunakan fitur ini untuk merekam melodi Anda ke database. Anda dapat mendengarkannya kembali di menu riwayat audio.
              </p>
            </div>

            {isRecording ? (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-red-500 font-mono font-bold animate-pulse">
                    REKAMAN AKTIF
                  </span>
                  <span className="font-mono text-neutral-300">
                    Durasi: {Math.floor(recordingDuration / 60)}:{(Math.floor(recordingDuration % 60)).toString().padStart(2, '0')}
                  </span>
                </div>
                {/* Infinite pulsing aesthetic bar indicator with no limits */}
                <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden border border-white/5">
                  <div className="bg-red-600 h-full w-full animate-pulse" />
                </div>
                <div className="text-center text-[11px] font-mono text-neutral-300">
                  Total Terdeteksi: <strong className="text-red-500">{recordedNotes.length} Nada</strong>
                </div>

                <button
                  type="button"
                  id="btn-stop-rec"
                  onClick={handleStopRecording}
                  className="w-full py-2.5 bg-red-900 text-white hover:bg-red-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <Square className="w-4 h-4 text-white fill-white" /> Hentikan Rekaman
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-neutral-400">
                  Aransemen Anda akan disinkronisasi ke identitas profil {profile.nim && profile.nim !== '-' && profile.nim !== 'Umum' ? `@${profile.nim}` : 'Anda'}.
                </p>
                <button
                  type="button"
                  id="btn-start-rec"
                  onClick={handleStartRecording}
                  disabled={isModelLoading}
                  className="w-full py-2.5 bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-650 active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                  <Disc className="w-4 h-4 text-white" /> Mulai Rekam
                </button>
              </div>
            )}
          </div>

          {/* Model Statistics Metrics Box in glassmorphism */}
          <div className="bg-[#0e0e12]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-3">
                <h3 className="text-xs font-mono uppercase text-neutral-300 tracking-wider font-bold">
                  Hasil & Real-time Statistik
                </h3>
                <button
                  type="button"
                  id="btn-reset-stats"
                  onClick={onResetStats}
                  className="p-1 hover:bg-white/10 text-neutral-400 hover:text-white rounded-lg cursor-pointer"
                  title="Reset Real-time Metrics"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Grid elements to show academic scores */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex justify-between items-center p-2.5 bg-white/[0.02] rounded-xl border border-white/5">
                  <div className="text-[10px] text-neutral-400 font-mono">Total Frames</div>
                  <div className="font-mono text-xs font-bold text-white">
                    {stats.totalFramesTested}
                  </div>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-white/[0.02] rounded-xl border border-white/5">
                  <div className="text-[10px] text-neutral-400 font-mono">Inference Avg</div>
                  <div className="font-mono text-xs font-bold text-amber-500">
                    {Math.round(stats.averageInferenceTime)} ms
                  </div>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-white/[0.02] rounded-xl border border-white/5">
                  <div className="text-[10px] text-neutral-400 font-mono">Accuracy</div>
                  <div className="font-mono text-xs font-bold text-emerald-400">
                    {Math.round(stats.modelAccuracy)}%
                  </div>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-white/[0.02] rounded-xl border border-white/5">
                  <div className="text-[10px] text-neutral-400 font-mono">Active Key</div>
                  <div className="font-mono text-[10px] bg-red-950/20 border border-red-900/40 px-2 py-0.5 rounded-lg text-red-400 font-bold">
                    {activeKeys.size} nada
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] rounded-xl p-3 text-[10.5px] text-neutral-400 font-normal leading-normal">
              Sejajarkan jari di kotak tuts lalu tekuk jari Anda ke bawah untuk membunyikannya secara instan.
            </div>
          </div>

        </div>
      </main>

      {/* Dynamic Visual HTML Keybed showing full 24 Keys C4-B5 - SPANNING FULL WIDTH */}
      <section className="mt-8 bg-[#0e0e12]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative" id="layout-pianotuts">
        <h3 className="text-xs font-mono uppercase text-red-400 tracking-wider mb-3 text-center flex items-center justify-center gap-1.5 font-bold">
          Visual Keyboard Real-Time (24 Tuts • C4 - B5)
        </h3>

        {/* Piano Layout wrapper */}
        <div className="relative h-44 border-t-2 border-red-700/80 flex select-none overflow-x-auto rounded-b-xl">
          {PIANO_KEYS.map((k) => {
            const isPressed = activeKeys.has(k.index);
            
            if (k.isBlack) return null; // black keys are handled absolutely overlaying

            // find corresponding black keys sitting to the right of this white key (except for E and B)
            const hasRightBlack = [0, 2, 5, 7, 9, 12, 14, 17, 19, 21].includes(k.index);
            const blackIndex = k.index + 1;

            return (
              <div 
                key={k.index} 
                className="relative flex-grow flex-shrink-0 min-w-[34px] sm:min-w-[44px] h-full"
              >
                {/* White Key */}
                <button
                  type="button"
                  id={`key-white-${k.index}`}
                  onMouseDown={() => handleManualKeyClick(k.index)}
                  className={`w-full h-full border-r border-b border-black/20 rounded-b-xl flex flex-col justify-end pb-3 items-center cursor-pointer transition-all ${
                    isPressed 
                      ? 'bg-gradient-to-t from-red-800 via-rose-600 to-red-500 text-white shadow-[0_4px_16px_rgba(239,68,68,0.4)]' 
                      : 'bg-white/90 hover:bg-white text-neutral-900 font-bold'
                  }`}
                >
                  <span className="text-[11px] font-mono leading-none">{k.note}</span>
                </button>

                {/* Accompanying Absolute Black Key overlays */}
                {hasRightBlack && (
                  <button
                    type="button"
                    id={`key-black-${blackIndex}`}
                    onMouseDown={() => handleManualKeyClick(blackIndex)}
                    className={`absolute top-0 right-0 z-10 w-6 h-28 rounded-b-lg bg-[#0e0e11] border-x border-b border-white/10 flex flex-col justify-end pb-2 items-center cursor-pointer transition-all translate-x-1/2 ${
                      activeKeys.has(blackIndex)
                        ? 'bg-gradient-to-t from-red-950 to-red-650 text-white shadow-[0_2px_10px_rgba(220,38,38,0.5)]'
                        : 'bg-[#151518] hover:bg-black text-neutral-400'
                    }`}
                  >
                    <span className="text-[8.5px] font-mono">{PIANO_KEYS[blackIndex].note}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Save Recording Dialogue Modal with extreme glass effects */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#121217] border border-white/15 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-display font-bold text-white pb-2 border-b border-white/10">
                Masukkan Judul Rekaman
              </h3>
              <p className="text-xs text-neutral-400 leading-normal">
                Silakan isi judul untuk menyimpan hasil rekaman Anda ke database.
              </p>

              <form onSubmit={handleSaveRecordedMelody} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 tracking-wider mb-1 font-bold">
                    Judul Rekaman
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={savedTitle}
                    onChange={(e) => setSavedTitle(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-red-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition-all font-mono"
                    placeholder="Masukkan judul rekaman"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-neutral-400 px-1 pt-1 border-t border-white/5">
                  <span>
                    {profile.nim && profile.nim !== '-' && profile.nim !== 'Umum' ? (
                      <>Username: <strong className="text-white">@{profile.nim}</strong></>
                    ) : (
                      <>Nama: <strong className="text-white">{profile.name}</strong></>
                    )}
                  </span>
                  <span>Nada: <strong className="text-white">{recordedNotes.length} notes</strong></span>
                  <span>Durasi: <strong className="text-white">{Math.round(recordingDuration)}s</strong></span>
                </div>

                <div className="flex gap-2 justify-end pt-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveModal(false);
                      setRecordedNotes([]);
                      recordedNotesRef.current = [];
                      setRecordingDuration(0);
                      setRecordStartTime(null);
                      recordStartTimeRef.current = null;
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl cursor-pointer font-medium"
                  >
                    Buang
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-700 hover:bg-red-650 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
