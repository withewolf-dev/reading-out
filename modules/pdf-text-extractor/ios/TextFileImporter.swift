//
//  TextFileImporter.swift
//  Vendored from the ReadingLoud Swift app — this is the implementation, not a port.
//
//  One addition: running heads and page numbers are stripped before reflow
//  (§17.14). "Chapter 2 | 33" read aloud every page for 21 hours is
//  disqualifying, and PRODUCT.md asks for it from day one in this repo.
//

import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import UniformTypeIdentifiers

struct ImportedText: Sendable {
    let title: String
    let text: String
    /// PNG of the first page, for PDFs that have one.
    let cover: Data?

    init(title: String, text: String, cover: Data? = nil) {
        self.title = title
        self.text = text
        self.cover = cover
    }
}

enum TextImportError: LocalizedError {
    case empty(name: String)
    case noTextLayer(name: String)
    case unreadable(name: String, underlying: String)

    var errorDescription: String? {
        switch self {
        case .empty(let name):
            return "“\(name)” has no text in it."
        case .noTextLayer(let name):
            return "“\(name)” has no selectable text. It's likely a scan of page images, which needs OCR before it can be read aloud."
        case .unreadable(let name, let underlying):
            return "Couldn't read “\(name)”: \(underlying)"
        }
    }
}

/// Shared by the library's importer and the composer so both handle
/// security-scoped URLs, odd encodings, and PDFs the same way.
enum TextFileImporter {

    /// File types the pickers offer.
    static let supportedTypes: [UTType] = [.plainText, .utf8PlainText, .pdf]

    /// Extraction from a large PDF takes seconds, so it runs off the main actor.
    static func load(from url: URL) async throws -> ImportedText {
        try await Task.detached(priority: .userInitiated) {
            try loadSynchronously(from: url)
        }.value
    }

    static func loadSynchronously(from url: URL) throws -> ImportedText {
        // Files chosen through the picker live outside the app sandbox.
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        let name = url.deletingPathExtension().lastPathComponent
        let imported = url.pathExtension.lowercased() == "pdf"
            ? try loadPDF(at: url, fallbackTitle: name)
            : try loadPlainText(at: url, fallbackTitle: name)

        guard !imported.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw TextImportError.empty(name: url.lastPathComponent)
        }
        return imported
    }

    // MARK: - Plain text

    private static func loadPlainText(at url: URL, fallbackTitle: String) throws -> ImportedText {
        let contents: String
        do {
            contents = try readString(at: url)
        } catch {
            throw TextImportError.unreadable(name: url.lastPathComponent,
                                             underlying: error.localizedDescription)
        }
        return ImportedText(title: fallbackTitle,
                            text: contents.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// Most files are UTF-8; fall back to the file's declared encoding, then to
    /// Latin-1, which always decodes rather than failing on an odd byte.
    private static func readString(at url: URL) throws -> String {
        if let utf8 = try? String(contentsOf: url, encoding: .utf8) {
            return utf8
        }
        var detected: String.Encoding = .utf8
        if let sniffed = try? String(contentsOf: url, usedEncoding: &detected) {
            return sniffed
        }
        return try String(contentsOf: url, encoding: .isoLatin1)
    }

    // MARK: - PDF

    private static func loadPDF(at url: URL, fallbackTitle: String) throws -> ImportedText {
        guard let document = PDFDocument(url: url) else {
            throw TextImportError.unreadable(name: url.lastPathComponent,
                                             underlying: "the file isn't a readable PDF.")
        }

        var rawPages: [String] = []
        rawPages.reserveCapacity(document.pageCount)
        for index in 0..<document.pageCount {
            guard let page = document.page(at: index), let raw = page.string else { continue }
            rawPages.append(raw)
        }

        // Added: drop the running heads and page numbers before reflow (§17.14).
        let furniture = RunningHeads.detect(in: rawPages)
        var pages: [String] = []
        pages.reserveCapacity(rawPages.count)
        for raw in rawPages {
            let cleaned = reflow(RunningHeads.strip(furniture, from: raw))
            if !cleaned.isEmpty { pages.append(cleaned) }
        }

        guard !pages.isEmpty else {
            throw TextImportError.noTextLayer(name: url.lastPathComponent)
        }

        let title = (document.documentAttributes?[PDFDocumentAttribute.titleAttribute] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return ImportedText(title: title?.isEmpty == false ? title! : fallbackTitle,
                            text: pages.joined(separator: "\n\n"),
                            cover: document.page(at: 0).flatMap { renderCover(of: $0) })
    }

    /// Rasterizes the first page as the library thumbnail. Drawn through
    /// CoreGraphics rather than UIKit so this file stays platform-neutral.
    private static func renderCover(of page: PDFPage, maxDimension: CGFloat = 400) -> Data? {
        let bounds = page.bounds(for: .mediaBox)
        guard bounds.width > 1, bounds.height > 1 else { return nil }

        let scale = maxDimension / max(bounds.width, bounds.height)
        let width = Int((bounds.width * scale).rounded())
        let height = Int((bounds.height * scale).rounded())
        guard width > 0, height > 0 else { return nil }

        guard let context = CGContext(data: nil,
                                      width: width,
                                      height: height,
                                      bitsPerComponent: 8,
                                      bytesPerRow: 0,
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
            return nil
        }

        // PDF pages are usually transparent; paint white so text isn't invisible.
        context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.scaleBy(x: scale, y: scale)
        context.translateBy(x: -bounds.minX, y: -bounds.minY)
        page.draw(with: .mediaBox, to: context)

        guard let image = context.makeImage() else { return nil }
        return pngData(from: image)
    }

    private static func pngData(from image: CGImage) -> Data? {
        let buffer = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            buffer, UTType.png.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return buffer as Data
    }

    /// PDF text arrives hard-wrapped at the column width, which would otherwise
    /// make every visual line its own paragraph. Rejoin lines that are merely
    /// wrapped, and keep breaks that look deliberate.
    private static func reflow(_ raw: String) -> String {
        var paragraphs: [String] = []
        var current = ""

        for line in raw.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty {
                if !current.isEmpty { paragraphs.append(current); current = "" }
                continue
            }

            if current.isEmpty {
                current = trimmed
            } else if current.hasSuffix("-") {
                // A word split across lines: "inter-\nnal" -> "internal".
                current.removeLast()
                current += trimmed
            } else {
                current += " " + trimmed
            }

            // A line ending in sentence punctuation is a real break often enough
            // to be worth honouring; mid-sentence wraps keep accumulating.
            if trimmed.hasSuffix(".") || trimmed.hasSuffix("?") || trimmed.hasSuffix("!") {
                paragraphs.append(current)
                current = ""
            }
        }

        if !current.isEmpty { paragraphs.append(current) }
        return paragraphs.joined(separator: "\n\n")
    }
}
