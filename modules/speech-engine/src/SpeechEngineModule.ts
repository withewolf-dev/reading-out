import { NativeModule, requireNativeModule } from 'expo';

import type { SpeechEngineEvents, SpeechState, SpeechVoice } from './SpeechEngine.types';

declare class SpeechEngineModule extends NativeModule<SpeechEngineEvents> {
  /** AVFoundation's own 0…1 rate scale — no mapping layer to get wrong. */
  readonly minRate: number;
  readonly maxRate: number;
  readonly defaultRate: number;

  play(readingId: number, text: string, offset: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seek(offset: number): Promise<void>;
  setRate(rate: number): Promise<void>;
  setPitch(pitch: number): Promise<void>;
  setVoice(identifier: string | null): Promise<void>;
  previewVoice(
    identifier: string | null,
    rate: number,
    pitch: number,
    text: string
  ): Promise<void>;
  getVoices(): Promise<SpeechVoice[]>;
  getState(): SpeechState;
}

export default requireNativeModule<SpeechEngineModule>('SpeechEngine');
