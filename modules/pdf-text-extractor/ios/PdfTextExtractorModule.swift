import ExpoModulesCore
import Foundation

/// Thin wrapper around the vendored `TextFileImporter`. PDFs and text files both
/// come through here: PDFKit does in ~1s what pdf.js on Hermes cannot do
/// acceptably for a 600-page book, and the encoding fallback chain already
/// handles the text files that aren't UTF-8 (§17.15).
public class PdfTextExtractorModule: Module {
    public func definition() -> ModuleDefinition {
        Name("PdfTextExtractor")

        // AsyncFunction runs off the main thread — a 613-page extraction must
        // never block the UI (§17.17).
        AsyncFunction("importFile") { (uri: String) -> [String: Any?] in
            guard let url = URL(string: uri) else {
                throw ImportFailure("That file could not be opened.")
            }

            let imported: ImportedText
            do {
                imported = try TextFileImporter.loadSynchronously(from: url)
            } catch {
                throw ImportFailure(error.localizedDescription)
            }

            return [
                "title": imported.title,
                "text": imported.text,
                "coverPath": imported.cover.flatMap { Self.writeCover($0) },
            ]
        }
    }

    /// Covers are files on disk, never BLOBs in the database (§13b).
    private static func writeCover(_ data: Data) -> String? {
        let directory = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("covers", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        let file = directory.appendingPathComponent("\(UUID().uuidString).png")
        do {
            try data.write(to: file)
            return file.absoluteString
        } catch {
            return nil
        }
    }
}

/// Carries the importer's own message across to JS — "this PDF is a scan, it
/// needs OCR" is the whole point of failing loudly (§17.13).
final class ImportFailure: GenericException<String> {
    override var reason: String { param }
}
