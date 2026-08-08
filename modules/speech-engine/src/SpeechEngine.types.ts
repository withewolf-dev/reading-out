export type SpeechStatus = 'idle' | 'speaking' | 'paused';

export type SpeechState = {
  status: SpeechStatus;
  /** UTF-16 offset into the document. JS string indices are UTF-16, so this slices directly. */
  offset: number;
  totalLength: number;
  readingId: number | null;
  hasText: boolean;
};

export type SpeechVoice = {
  identifier: string;
  name: string;
  language: string;
  displayName: string;
  quality: 'default' | 'enhanced';
};

export type SpeechEngineEvents = {
  onState: (event: { status: SpeechStatus; offset: number; readingId: number | null }) => void;
  /** ~1/s, for the mini player. Word events never come this way. */
  onProgress: (event: { offset: number; totalLength: number; readingId: number | null }) => void;
  onFinish: (event: { readingId: number | null }) => void;
};

export type ReaderViewProps = {
  text: string;
  fontSize: number;
  /** True when the engine is playing this reading; gates the highlight. */
  active: boolean;
  /** Where to park the scroll on first load. */
  startOffset: number;
  /** Cover hue in degrees — the page is washed with the artwork's colour. */
  hue: number;
  /** Real artwork, if the reading has one. Its dominant colour wins over `hue`. */
  coverPath?: string | null;
  onSeek?: (event: { nativeEvent: { offset: number } }) => void;
  /** The tint the view settled on, so surrounding chrome can match it. */
  onTint?: (event: { nativeEvent: { hue: number; saturation: number } }) => void;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
};
