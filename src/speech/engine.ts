import { useSyncExternalStore } from 'react';

import SpeechEngine from '../../modules/speech-engine/src/SpeechEngineModule';
import type { SpeechStatus, SpeechVoice } from '../../modules/speech-engine/src/SpeechEngine.types';

/**
 * A thin shell over the native engine. All the hard parts — chunking, offset
 * rebasing, cancellation races, the audio session — live in Swift
 * (`SpeechReader.swift`, vendored from the original app).
 *
 * Word events do not appear here at all: they go native→native to the embedded
 * reader view, so a busy JS thread cannot stutter the highlight (§13b).
 */

export type PlayerState = {
  readingId: number | null;
  title: string;
  status: SpeechStatus;
  /** Updated ~1/s from the engine — enough for the mini player, not the highlight. */
  offset: number;
  charCount: number;
};

export type Prefs = {
  voice: string | null;
  /** AVFoundation's own 0…1 scale. */
  rate: number;
  pitch: number;
  fontSize: number;
};

export const RATE = {
  min: SpeechEngine.minRate,
  max: SpeechEngine.maxRate,
  default: SpeechEngine.defaultRate,
};

export const DEFAULT_PREFS: Prefs = {
  voice: null,
  rate: RATE.default,
  pitch: 1.0,
  fontSize: 19,
};

type Listener = () => void;

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(next: T) {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

const playerStore = createStore<PlayerState>({
  readingId: null,
  title: '',
  status: 'idle',
  offset: 0,
  charCount: 0,
});
const prefsStore = createStore<Prefs>(DEFAULT_PREFS);

let persist: (id: number, offset: number) => void = () => {};
let onFinished: (id: number) => void = () => {};

function patch(next: Partial<PlayerState>) {
  playerStore.set({ ...playerStore.get(), ...next });
}

SpeechEngine.addListener('onState', ({ status, offset, readingId }) => {
  patch({ status, offset });
  // Pausing and stopping are exactly when progress must be on disk (§17.8).
  if (status !== 'speaking' && readingId != null) persist(readingId, offset);
});

SpeechEngine.addListener('onProgress', ({ offset, totalLength, readingId }) => {
  patch({ offset, charCount: totalLength });
  if (readingId != null) persist(readingId, offset);
});

SpeechEngine.addListener('onFinish', ({ readingId }) => {
  if (readingId != null) onFinished(readingId);
});

export function configurePlayer(handlers: {
  persist: (id: number, offset: number) => void;
  onFinished?: (id: number) => void;
}) {
  persist = handlers.persist;
  if (handlers.onFinished) onFinished = handlers.onFinished;
}

export const player = {
  subscribe: playerStore.subscribe,
  getState: playerStore.get,

  play(reading: { id: number; title: string; text: string }, offset = 0) {
    const start = offset >= reading.text.length ? 0 : Math.max(0, offset);
    playerStore.set({
      readingId: reading.id,
      title: reading.title,
      status: 'speaking',
      offset: start,
      charCount: reading.text.length,
    });
    SpeechEngine.play(reading.id, reading.text, start);
  },

  pause: () => SpeechEngine.pause(),
  resume: () => SpeechEngine.resume(),
  seek: (offset: number) => SpeechEngine.seek(Math.max(0, offset)),

  toggle() {
    const { status } = playerStore.get();
    if (status === 'speaking') SpeechEngine.pause();
    else if (status === 'paused') SpeechEngine.resume();
    else {
      const native = SpeechEngine.getState();
      if (native.hasText) SpeechEngine.seek(native.offset);
    }
  },

  stop() {
    SpeechEngine.stop();
    const { readingId, offset } = playerStore.get();
    if (readingId != null) persist(readingId, offset);
    playerStore.set({ readingId: null, title: '', status: 'idle', offset: 0, charCount: 0 });
  },

  /** ±15s. TTS has no timeline, so seconds become characters: ~18 units/sec (§19.1). */
  skip(seconds: number) {
    const native = SpeechEngine.getState();
    SpeechEngine.seek(Math.max(0, native.offset + seconds * 18));
  },

  /** The flush that must not be missed when the app is backgrounded or killed. */
  flushProgress() {
    const native = SpeechEngine.getState();
    if (native.readingId != null) persist(native.readingId, native.offset);
  },

  isLoaded(id: number) {
    return SpeechEngine.getState().readingId === id;
  },

  /** Live position, read imperatively so no render is triggered. */
  currentOffset: () => SpeechEngine.getState().offset,
};

export const prefs = {
  subscribe: prefsStore.subscribe,
  get: prefsStore.get,
  set(next: Partial<Prefs>) {
    prefsStore.set({ ...prefsStore.get(), ...next });
    // Rate, pitch and voice are locked into an utterance when it starts, so the
    // engine restarts the current chunk — about a page, so it feels instant (§17.4).
    if (next.rate !== undefined) SpeechEngine.setRate(next.rate);
    if (next.pitch !== undefined) SpeechEngine.setPitch(next.pitch);
    if (next.voice !== undefined) SpeechEngine.setVoice(next.voice);
  },
};

export function usePlayer(): PlayerState {
  return useSyncExternalStore(playerStore.subscribe, playerStore.get, playerStore.get);
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(prefsStore.subscribe, prefsStore.get, prefsStore.get);
}

export function listVoices(): Promise<SpeechVoice[]> {
  return SpeechEngine.getVoices();
}

export function previewVoice(voice: string | null, text: string) {
  const { rate, pitch } = prefsStore.get();
  return SpeechEngine.previewVoice(voice, rate, pitch, text);
}
