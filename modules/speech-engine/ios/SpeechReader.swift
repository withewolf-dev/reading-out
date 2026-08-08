//
//  SpeechReader.swift
//  Vendored from the ReadingLoud Swift app — this is the implementation, not a port.
//
//  Two deliberate changes from the original:
//   1. The SwiftData `Reading` coupling is gone. Persistence lives in SQLite on
//      the JS side now, so this class owns offsets and *reports* them (§13b).
//   2. Word ranges are posted through NotificationCenter so the embedded reader
//      view can subscribe natively. Word events never cross the JS bridge.
//

import AVFoundation
import Foundation

extension Notification.Name {
    /// userInfo: ["start": Int, "end": Int] in full-text UTF-16 offsets.
    static let speechWordRange = Notification.Name("ReadingLoud.speechWordRange")
    /// userInfo: ["state": String]
    static let speechStateChanged = Notification.Name("ReadingLoud.speechStateChanged")
}

/// Wraps `AVSpeechSynthesizer` and publishes what is currently being spoken so the
/// UI can highlight along. Offsets are UTF-16 based, matching the ranges AVFoundation
/// hands back, and are always translated into the *full* text's coordinate space —
/// playback can start mid-document, but callers never have to think about that.
///
/// Long texts are spoken as a queue of chunks rather than one giant utterance:
/// a whole book in a single utterance takes seconds to start, and every speed
/// change restarts it. Chunking keeps startup flat regardless of length.
final class SpeechReader {

    static let shared = SpeechReader()

    enum State: String {
        case idle, speaking, paused
    }

    private(set) var state: State = .idle {
        didSet {
            guard state != oldValue else { return }
            NotificationCenter.default.post(name: .speechStateChanged,
                                            object: nil,
                                            userInfo: ["state": state.rawValue])
            onStateChange?(state)
        }
    }
    /// Range of the word being spoken, in the full text's UTF-16 offsets.
    private(set) var spokenRange: Range<Int>?
    /// Start of the word being spoken; survives pauses so it can be persisted as progress.
    private(set) var offset: Int = 0
    /// Total length of the text handed to `speak`, for progress reporting.
    private(set) var totalLength: Int = 0

    var rate: Float = AVSpeechUtteranceDefaultSpeechRate
    var pitch: Float = 1.0
    /// `AVSpeechSynthesisVoice` identifier, or nil for the system default.
    var voiceIdentifier: String?

    /// Identifier of the reading currently loaded, owned by JS.
    private(set) var readingId: Int?

    /// Called when the text runs to completion (not when stopped by the user).
    var onFinish: (() -> Void)?
    var onStateChange: ((State) -> Void)?

    /// Roughly a page of text. Small enough to start instantly, large enough
    /// that chunk seams are rare.
    private static let chunkTarget = 3_000
    /// How far past the target to look for a sentence break before cutting hard.
    private static let chunkOvershoot = 1_000
    /// Chunks queued ahead of the one playing, so seams are gapless.
    private static let lookahead = 2

    private struct Chunk {
        let base: Int
        let generation: Int
    }

    private let synthesizer = AVSpeechSynthesizer()
    private let coordinator = Coordinator()

    private var fullText = ""
    /// UTF-16 offset where the next chunk will be cut from.
    private var cursor = 0
    private var chunks: [ObjectIdentifier: Chunk] = [:]
    private var pending = 0
    /// Bumped on every new playback so callbacks from cancelled utterances are ignored.
    private var generation = 0

    private init() {
        coordinator.owner = self
        synthesizer.delegate = coordinator
    }

    var progress: Double {
        guard totalLength > 0 else { return 0 }
        return min(1, Double(offset) / Double(totalLength))
    }

    var hasText: Bool { !fullText.isEmpty }

    /// Starts a reading and remembers which one, so the JS side can attribute
    /// progress without shipping the text back and forth.
    func play(readingId: Int, text: String, from startOffset: Int) {
        self.readingId = readingId
        speak(text, from: startOffset)
    }

    /// Starts speaking `text` from `startOffset` (a UTF-16 offset into `text`).
    /// Any in-flight playback is replaced.
    func speak(_ text: String, from startOffset: Int = 0) {
        generation += 1
        synthesizer.stopSpeaking(at: .immediate)
        chunks.removeAll()
        pending = 0

        fullText = text
        totalLength = text.utf16.count
        cursor = max(0, min(startOffset, totalLength))
        offset = cursor
        spokenRange = nil
        postWord(nil)

        guard cursor < totalLength,
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            state = .idle
            return
        }

        activateAudioSession()
        state = .speaking
        for _ in 0..<Self.lookahead { enqueueNextChunk() }
    }

    func pause() {
        guard state == .speaking else { return }
        synthesizer.pauseSpeaking(at: .word)
    }

    func resume() {
        guard state == .paused else { return }
        synthesizer.continueSpeaking()
    }

    /// Restarts at the current word with freshly applied voice settings —
    /// AVFoundation locks rate/pitch/voice in per utterance. Because playback is
    /// chunked, this only re-synthesizes about a page, so it's effectively instant.
    func restartForSettingsChange() {
        guard state != .idle, !fullText.isEmpty else { return }
        speak(fullText, from: offset)
    }

    /// Jumps to a document offset, keeping whatever state we were in.
    func seek(to newOffset: Int) {
        guard !fullText.isEmpty else { return }
        let target = max(0, min(newOffset, totalLength))
        switch state {
        case .speaking, .paused:
            speak(fullText, from: target)
        case .idle:
            offset = target
            spokenRange = nil
            postWord(nil)
        }
    }

    func stop() {
        generation += 1
        synthesizer.stopSpeaking(at: .immediate)
        chunks.removeAll()
        pending = 0
        state = .idle
        spokenRange = nil
        postWord(nil)
        deactivateAudioSession()
    }

    // MARK: - Chunking

    private func enqueueNextChunk() {
        guard cursor < totalLength else { return }

        let start = cursor
        let end = chunkEnd(after: start)
        guard end > start else { return }

        let piece = String(fullText[stringIndex(at: start)..<stringIndex(at: end)])
        cursor = end

        guard !piece.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            // Nothing speakable in this slice; skip straight to the next.
            enqueueNextChunk()
            return
        }

        let utterance = AVSpeechUtterance(string: piece)
        utterance.rate = rate
        utterance.pitchMultiplier = pitch
        if let voiceIdentifier, let voice = AVSpeechSynthesisVoice(identifier: voiceIdentifier) {
            utterance.voice = voice
        }

        chunks[ObjectIdentifier(utterance)] = Chunk(base: start, generation: generation)
        pending += 1
        synthesizer.speak(utterance)
    }

    /// Cuts at the first sentence break past the target so chunk seams land
    /// between sentences rather than mid-phrase.
    private func chunkEnd(after start: Int) -> Int {
        let target = min(start + Self.chunkTarget, totalLength)
        if target >= totalLength { return totalLength }

        let limit = min(target + Self.chunkOvershoot, totalLength)
        let scanStart = stringIndex(at: target)
        let scanEnd = stringIndex(at: limit)

        var index = scanStart
        while index < scanEnd {
            let character = fullText[index]
            let next = fullText.index(after: index)
            if character == "\n" || ((character == "." || character == "?" || character == "!")
                                     && (next == scanEnd || fullText[next].isWhitespace)) {
                return utf16Offset(of: next)
            }
            index = next
        }
        return target
    }

    /// UTF-16 offsets from AVFoundation can land inside a multi-unit character;
    /// round to the nearest valid boundary rather than trapping.
    private func stringIndex(at utf16Offset: Int) -> String.Index {
        let clamped = max(0, min(utf16Offset, totalLength))
        let utf16 = fullText.utf16
        guard let raw = utf16.index(utf16.startIndex, offsetBy: clamped, limitedBy: utf16.endIndex) else {
            return fullText.endIndex
        }
        if let exact = raw.samePosition(in: fullText) { return exact }
        // Landed mid-character — step forward to the next boundary.
        var probe = clamped + 1
        while probe <= totalLength {
            if let candidate = utf16.index(utf16.startIndex, offsetBy: probe, limitedBy: utf16.endIndex),
               let exact = candidate.samePosition(in: fullText) {
                return exact
            }
            probe += 1
        }
        return fullText.endIndex
    }

    private func utf16Offset(of index: String.Index) -> Int {
        fullText.utf16.distance(from: fullText.utf16.startIndex, to: index)
    }

    private func activateAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? session.setActive(true)
    }

    private func deactivateAudioSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// The 10/s path. It goes to NotificationCenter and stops there — the reader
    /// view is a native subscriber, so a busy JS thread cannot stutter the highlight.
    private func postWord(_ range: Range<Int>?) {
        NotificationCenter.default.post(
            name: .speechWordRange,
            object: nil,
            userInfo: range.map { ["start": $0.lowerBound, "end": $0.upperBound] } ?? [:]
        )
    }

    // MARK: - Delegate callbacks

    fileprivate func handleWillSpeak(_ range: NSRange, for utterance: AVSpeechUtterance) {
        guard let chunk = chunks[ObjectIdentifier(utterance)], chunk.generation == generation else {
            return
        }
        let start = chunk.base + range.location
        let end = min(totalLength, start + range.length)
        guard start <= end else { return }
        offset = start
        spokenRange = start..<end
        postWord(start..<end)
    }

    fileprivate func handleFinish(_ utterance: AVSpeechUtterance) {
        let key = ObjectIdentifier(utterance)
        guard let chunk = chunks.removeValue(forKey: key), chunk.generation == generation else {
            return
        }
        pending -= 1

        if cursor < totalLength {
            enqueueNextChunk()
        } else if pending == 0 {
            offset = totalLength
            spokenRange = nil
            postWord(nil)
            state = .idle
            deactivateAudioSession()
            onFinish?()
        }
    }

    fileprivate func handlePause() {
        state = .paused
    }

    fileprivate func handleContinue() {
        state = .speaking
    }

    fileprivate func handleCancel(_ utterance: AVSpeechUtterance) {
        chunks.removeValue(forKey: ObjectIdentifier(utterance))
    }

    /// AVFoundation requires an `NSObject` delegate; keeping it separate lets
    /// `SpeechReader` stay a plain class.
    private final class Coordinator: NSObject, AVSpeechSynthesizerDelegate {
        weak var owner: SpeechReader?

        func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                               willSpeakRangeOfSpeechString characterRange: NSRange,
                               utterance: AVSpeechUtterance) {
            onMain { $0.handleWillSpeak(characterRange, for: utterance) }
        }

        func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                               didFinish utterance: AVSpeechUtterance) {
            onMain { $0.handleFinish(utterance) }
        }

        func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                               didPause utterance: AVSpeechUtterance) {
            onMain { $0.handlePause() }
        }

        func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                               didContinue utterance: AVSpeechUtterance) {
            onMain { $0.handleContinue() }
        }

        func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                               didCancel utterance: AVSpeechUtterance) {
            onMain { $0.handleCancel(utterance) }
        }

        private func onMain(_ work: @escaping (SpeechReader) -> Void) {
            if Thread.isMainThread {
                if let owner { work(owner) }
            } else {
                DispatchQueue.main.async { [weak self] in
                    if let owner = self?.owner { work(owner) }
                }
            }
        }
    }
}

extension AVSpeechSynthesisVoice {
    /// "Samantha — English (US)"
    var displayName: String {
        let locale = Locale.current.localizedString(forIdentifier: language) ?? language
        return "\(name) — \(locale)"
    }
}
