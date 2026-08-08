import AVFoundation
import ExpoModulesCore

/// Commands down, low-frequency state up. Word ranges are NOT emitted here —
/// they go native→native to the reader view (§13b).
public class SpeechEngineModule: Module {
    /// The mini player needs a moving position, not every word.
    private static let progressInterval: TimeInterval = 1.0
    private var progressTimer: Timer?

    public func definition() -> ModuleDefinition {
        Name("SpeechEngine")

        Events("onState", "onProgress", "onFinish")

        OnCreate {
            let reader = SpeechReader.shared
            reader.onStateChange = { [weak self] state in
                self?.sendEvent("onState", [
                    "status": state.rawValue,
                    "offset": reader.offset,
                    "readingId": reader.readingId as Any,
                ])
                self?.updateTimer(running: state == .speaking)
            }
            reader.onFinish = { [weak self] in
                self?.sendEvent("onFinish", ["readingId": reader.readingId as Any])
            }
        }

        OnDestroy {
            self.progressTimer?.invalidate()
            self.progressTimer = nil
        }

        AsyncFunction("play") { (readingId: Int, text: String, offset: Int) in
            SpeechReader.shared.play(readingId: readingId, text: text, from: offset)
        }.runOnQueue(.main)

        AsyncFunction("pause") { SpeechReader.shared.pause() }.runOnQueue(.main)
        AsyncFunction("resume") { SpeechReader.shared.resume() }.runOnQueue(.main)
        AsyncFunction("stop") { SpeechReader.shared.stop() }.runOnQueue(.main)

        AsyncFunction("seek") { (offset: Int) in
            SpeechReader.shared.seek(to: offset)
        }.runOnQueue(.main)

        /// Current position, read on demand so JS never polls the word stream.
        Function("getState") { () -> [String: Any] in
            let reader = SpeechReader.shared
            return [
                "status": reader.state.rawValue,
                "offset": reader.offset,
                "totalLength": reader.totalLength,
                "readingId": reader.readingId as Any,
                "hasText": reader.hasText,
            ]
        }

        AsyncFunction("setRate") { (rate: Float) in
            SpeechReader.shared.rate = rate
            SpeechReader.shared.restartForSettingsChange()
        }.runOnQueue(.main)

        AsyncFunction("setPitch") { (pitch: Float) in
            SpeechReader.shared.pitch = pitch
            SpeechReader.shared.restartForSettingsChange()
        }.runOnQueue(.main)

        AsyncFunction("setVoice") { (identifier: String?) in
            SpeechReader.shared.voiceIdentifier = identifier
            SpeechReader.shared.restartForSettingsChange()
        }.runOnQueue(.main)

        /// Speaks a one-off line without disturbing playback state — the settings preview.
        AsyncFunction("previewVoice") { (identifier: String?, rate: Float, pitch: Float, text: String) in
            let utterance = AVSpeechUtterance(string: text)
            utterance.rate = rate
            utterance.pitchMultiplier = pitch
            if let identifier, let voice = AVSpeechSynthesisVoice(identifier: identifier) {
                utterance.voice = voice
            }
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
            try? AVAudioSession.sharedInstance().setActive(true)
            AVSpeechSynthesizer.preview.speak(utterance)
        }.runOnQueue(.main)

        AsyncFunction("getVoices") { () -> [[String: Any]] in
            AVSpeechSynthesisVoice.speechVoices()
                .filter { $0.language.hasPrefix("en") }
                .map { voice in
                    [
                        "identifier": voice.identifier,
                        "name": voice.name,
                        "language": voice.language,
                        "displayName": voice.displayName,
                        // Enhanced/Premium are the downloadable ones worth telling
                        // users about — the default ones are the compact voices
                        // people mistake for the app sounding bad (§POC critique 10).
                        "quality": {
                            switch voice.quality {
                            case .premium: return "premium"
                            case .enhanced: return "enhanced"
                            default: return "default"
                            }
                        }(),
                        // voiceTraits is iOS 17+, and the app targets 16.4.
                        "isPersonalVoice": {
                            if #available(iOS 17.0, *) {
                                return voice.voiceTraits.contains(.isPersonalVoice)
                            }
                            return false
                        }(),
                        // The novelty voices — Bells, Boing, Bubbles — are the ones
                        // with no gender. It is the only signal iOS gives that
                        // separates them from voices meant for reading prose.
                        "isNovelty": voice.gender == .unspecified,
                    ]
                }
        }

        /// AVFoundation's own 0…1 rate scale — no mapping layer to get wrong (§13b).
        Constant("minRate") { AVSpeechUtteranceMinimumSpeechRate }
        Constant("maxRate") { AVSpeechUtteranceMaximumSpeechRate }
        Constant("defaultRate") { AVSpeechUtteranceDefaultSpeechRate }
    }

    private func updateTimer(running: Bool) {
        progressTimer?.invalidate()
        progressTimer = nil
        guard running else { return }
        progressTimer = Timer.scheduledTimer(withTimeInterval: Self.progressInterval,
                                             repeats: true) { [weak self] _ in
            let reader = SpeechReader.shared
            self?.sendEvent("onProgress", [
                "offset": reader.offset,
                "totalLength": reader.totalLength,
                "readingId": reader.readingId as Any,
            ])
        }
    }
}

private extension AVSpeechSynthesizer {
    /// Separate synthesizer so previewing a voice can't cancel the book.
    static let preview = AVSpeechSynthesizer()
}
