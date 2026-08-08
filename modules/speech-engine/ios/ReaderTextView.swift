//
//  ReaderTextView.swift
//  The reader, kept native — adapted from ReadingLoud's ReaderView.swift.
//
//  Word ranges arrive by NotificationCenter straight from SpeechReader, so the
//  highlight never waits on the JS thread. React Native owns the chrome around
//  this view (nav bar, control row); everything inside is SwiftUI.
//

import SwiftUI
import UIKit

extension UIImage {
    /// One-pixel downscale — the cheapest honest "dominant colour".
    var averageColor: UIColor? {
        guard let cgImage else { return nil }
        var pixel = [UInt8](repeating: 0, count: 4)
        guard let context = CGContext(
            data: &pixel,
            width: 1,
            height: 1,
            bitsPerComponent: 8,
            bytesPerRow: 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: 1, height: 1))
        return UIColor(
            red: CGFloat(pixel[0]) / 255,
            green: CGFloat(pixel[1]) / 255,
            blue: CGFloat(pixel[2]) / 255,
            alpha: 1
        )
    }
}

final class ReaderModel: ObservableObject {
    @Published var paragraphs: [Paragraph] = []
    @Published var fontSize: Double = 19
    @Published var spokenRange: Range<Int>?
    @Published var following = true
    /// True when the engine is playing *this* reading — playback lives above this view.
    @Published var isActive = false
    /// Hue of the cover, so the page is tinted by the artwork (Apple Podcasts, §15).
    /// Set from the title's colour when a reading has no real cover, and replaced
    /// by the artwork's own dominant hue when it does.
    @Published var hue: Double = 210
    @Published var saturation: Double = 0.10

    /// Where to park the scroll on first load (resume position).
    var startOffset = 0
    var onSeek: ((Int) -> Void)?
    /// Reports the resolved tint up to React Native, so the header and the
    /// control dock can sit on the same colour as the page.
    var onTint: ((Double, Double) -> Void)?

    func setHue(_ newHue: Double) {
        guard newHue != hue else { return }
        hue = newHue
        onTint?(hue, saturation)
    }

    private var splitTask: Task<Void, Never>?
    private var observers: [NSObjectProtocol] = []
    private var currentText = ""

    init() {
        let center = NotificationCenter.default
        observers.append(
            center.addObserver(forName: .speechWordRange, object: nil, queue: .main) { [weak self] note in
                guard let self, self.isActive else { return }
                if let start = note.userInfo?["start"] as? Int,
                   let end = note.userInfo?["end"] as? Int {
                    self.spokenRange = start..<end
                } else {
                    self.spokenRange = nil
                }
            }
        )
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
        splitTask?.cancel()
    }

    /// Averages the cover down to one colour and tints the page with it — the
    /// literal reading of "background tinted from the cover" (§15). Falls back to
    /// the title-derived hue when there is no artwork.
    func setCover(_ path: String) {
        guard !path.isEmpty,
              let url = URL(string: path),
              let data = try? Data(contentsOf: url),
              let image = UIImage(data: data),
              let average = image.averageColor else { return }

        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard average.getHue(&h, saturation: &s, brightness: &b, alpha: &a) else { return }

        hue = Double(h) * 360
        // Book covers are often near-grey; floor the saturation so the page still
        // reads as tinted rather than as flat charcoal.
        saturation = max(0.05, min(0.16, Double(s)))
        onTint?(hue, saturation)
    }

    /// Splitting a 1.4 MB book blocks for long enough to drop frames, so it
    /// happens off the main actor.
    func setText(_ text: String) {
        guard text != currentText else { return }
        currentText = text
        splitTask?.cancel()
        splitTask = Task { [weak self] in
            let split = await Task.detached(priority: .userInitiated) {
                Paragraph.split(text)
            }.value
            guard !Task.isCancelled else { return }
            await MainActor.run { self?.paragraphs = split }
        }
    }
}

struct ReaderTextView: View {
    @ObservedObject var model: ReaderModel
    @State private var didRestoreScroll = false

    /// Binary search — a linear scan ran across 9,105 paragraphs on every word.
    private var currentParagraphID: Int? {
        paragraphID(containing: model.spokenRange?.lowerBound)
    }

    private func paragraphID(containing target: Int?) -> Int? {
        guard let target, !model.paragraphs.isEmpty else { return nil }
        var low = 0
        var high = model.paragraphs.count - 1
        while low <= high {
            let mid = (low + high) / 2
            if target < model.paragraphs[mid].start {
                high = mid - 1
            } else if target >= model.paragraphs[mid].end {
                low = mid + 1
            } else {
                return model.paragraphs[mid].id
            }
        }
        return model.paragraphs[min(low, model.paragraphs.count - 1)].id
    }

    /// Hands a paragraph the highlight only when the word is actually inside it,
    /// so every other paragraph's inputs stay unchanged and its body is skipped.
    private func highlight(for paragraph: Paragraph) -> Range<Int>? {
        guard let spokenRange = model.spokenRange,
              spokenRange.overlaps(paragraph.start..<paragraph.end) else { return nil }
        return spokenRange
    }

    /// Read / reading / not yet read. A paragraph's phase changes exactly once as
    /// playback passes it, so the equatable check still skips every other body.
    private func phase(for paragraph: Paragraph) -> ParagraphPhase {
        guard model.isActive, let spoken = model.spokenRange?.lowerBound else { return .idle }
        if spoken >= paragraph.end { return .past }
        if spoken < paragraph.start { return .upcoming }
        return .current
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    ForEach(model.paragraphs) { paragraph in
                        if paragraph.isBlank {
                            Color.clear.frame(height: 2).id(paragraph.id)
                        } else {
                            ParagraphText(paragraph: paragraph,
                                          spokenRange: highlight(for: paragraph),
                                          phase: phase(for: paragraph),
                                          fontSize: model.fontSize)
                                .equatable()
                                .id(paragraph.id)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    model.following = true
                                    model.onSeek?(paragraph.start)
                                }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 96) // clears the floating header
                .padding(.bottom, 210) // clears the control dock
            }
            .scrollIndicators(.hidden)
            // Text dissolves as it passes under the header rather than being cut
            // off by it — the top fade in Apple's transcript view (§15).
            .mask(
                // The fades have to clear the floating header and the control
                // area — text dissolves before it reaches either, instead of
                // running through them at full strength.
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .black.opacity(0.10), location: 0.10),
                        .init(color: .black, location: 0.22),
                        .init(color: .black, location: 0.72),
                        .init(color: .black.opacity(0.15), location: 0.85),
                        .init(color: .clear, location: 0.92),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            // Auto-scrolling mid-gesture is what made scrolling feel like it was
            // fighting back; hand control over until the user asks for it.
            // (`onScrollPhaseChange` would be tidier but needs iOS 18; the app
            // targets 16.4, and a simultaneous drag gesture reads the same intent.)
            .simultaneousGesture(
                DragGesture(minimumDistance: 8).onChanged { _ in
                    if model.following { model.following = false }
                }
            )
            .onChange(of: currentParagraphID) { newValue in
                guard model.following, let newValue else { return }
                withAnimation(.easeInOut(duration: 0.35)) {
                    proxy.scrollTo(newValue, anchor: .center)
                }
            }
            .onChange(of: model.paragraphs.count) { count in
                guard count > 0, !didRestoreScroll else { return }
                didRestoreScroll = true
                if model.startOffset > 0, let id = paragraphID(containing: model.startOffset) {
                    proxy.scrollTo(id, anchor: .center)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if !model.following && model.isActive {
                    Button {
                        model.following = true
                        if let id = currentParagraphID {
                            withAnimation { proxy.scrollTo(id, anchor: .center) }
                        }
                    } label: {
                        Label("Follow", systemImage: "text.line.first.and.arrowtriangle.forward")
                            .font(.footnote.weight(.medium))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(.regularMaterial, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.black)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 150)
                }
            }
        }
        // Text is the artwork. Apple Podcasts floods the whole page with the
        // cover's colour rather than fading to black, so the page reads as the
        // book itself (§15).
        .background(ReaderTint(hue: model.hue, saturation: model.saturation).ignoresSafeArea())
    }
}

/// Full-bleed wash of the cover's colour, dark enough to carry white serif text.
struct ReaderTint: View {
    let hue: Double
    let saturation: Double

    var body: some View {
        LinearGradient(
            colors: [
                Color(hue: hue / 360, saturation: saturation, brightness: 0.99),
                Color(hue: hue / 360, saturation: saturation * 1.3, brightness: 0.94),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

enum ParagraphPhase {
    /// Nothing is playing — everything reads at full strength.
    case idle
    case past
    case current
    case upcoming

    var textOpacity: Double {
        switch self {
        case .idle: return 0.92
        case .past: return 0.32
        case .current: return 0.92
        case .upcoming: return 0.52
        }
    }
}

/// Renders one paragraph, splicing in a highlight only when the spoken word lands inside it.
/// `Equatable` matters here: paragraphs that aren't being spoken receive an unchanged
/// `nil` range, so SwiftUI skips their bodies entirely while playback runs.
private struct ParagraphText: View, Equatable {
    let paragraph: Paragraph
    let spokenRange: Range<Int>?
    let phase: ParagraphPhase
    let fontSize: Double

    var body: some View {
        Text(attributed)
            .font(.system(size: fontSize, design: .serif))
            .lineSpacing(fontSize * 0.35)
            .frame(maxWidth: .infinity, alignment: .leading)
            // The passage being read sits on a soft block, the way ElevenReader
            // marks the active paragraph (§15).
            .padding(.horizontal, phase == .current ? 12 : 0)
            .padding(.vertical, phase == .current ? 10 : 0)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.black.opacity(phase == .current ? 0.05 : 0))
            )
            .padding(.horizontal, phase == .current ? -12 : 0)
            .animation(.easeOut(duration: 0.2), value: phase)
            .animation(.easeOut(duration: 0.12), value: spokenRange)
    }

    private var attributed: AttributedString {
        let (prefix, highlighted, suffix) = paragraph.slice(around: spokenRange)
        guard !highlighted.isEmpty else { return plain(prefix) }

        var result = plain(prefix)
        var word = AttributedString(highlighted)
        // accent at 0.28 over the text (§18)
        word.backgroundColor = Color(red: 0, green: 122 / 255, blue: 1).opacity(0.22)
        word.foregroundColor = .black
        result += word
        result += plain(suffix)
        return result
    }

    private func plain(_ string: String) -> AttributedString {
        var result = AttributedString(string)
        result.foregroundColor = .black.opacity(phase.textOpacity)
        return result
    }
}
