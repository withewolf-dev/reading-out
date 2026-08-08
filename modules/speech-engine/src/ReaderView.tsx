import { requireNativeView } from 'expo';

import type { ReaderViewProps } from './SpeechEngine.types';

/**
 * The reader, rendered by SwiftUI. Paragraph splitting, the word highlight and
 * follow-mode scrolling all happen natively — JS only hands it the text and
 * hears about taps.
 */
export const ReaderView = requireNativeView<ReaderViewProps>('ReaderView');
