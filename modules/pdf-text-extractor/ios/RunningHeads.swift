//
//  RunningHeads.swift
//  New in this repo: strips the page furniture that survives PDF extraction.
//
//  Running heads and page numbers interrupt listening mid-sentence, every page,
//  for the length of a book (§17.14). They are recognisable by repetition: a
//  line that appears near the top or bottom of many pages is furniture, not prose.
//

import Foundation

enum RunningHeads {
    /// Normalised forms of lines that repeat near the page edges.
    static func detect(in pages: [String]) -> Set<String> {
        guard pages.count >= 4 else { return [] }
        var counts: [String: Int] = [:]

        for page in pages {
            let lines = edgeLines(of: page)
            for line in Set(lines) where line.count < 90 {
                counts[normalize(line), default: 0] += 1
            }
        }

        let threshold = max(3, Int(Double(pages.count) * 0.3))
        return Set(counts.filter { $0.value >= threshold && !$0.key.isEmpty }.keys)
    }

    static func strip(_ furniture: Set<String>, from page: String) -> String {
        // Page numbers are stripped even when no repeated head was found.
        let lines = page.components(separatedBy: .newlines)
        var kept: [String] = []
        kept.reserveCapacity(lines.count)

        // Only the first and last couple of non-empty lines are candidates —
        // the same words mid-paragraph are just words.
        let edges = edgeIndices(of: lines)

        for (index, line) in lines.enumerated() {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if edges.contains(index) && (furniture.contains(normalize(trimmed)) || isPageNumber(trimmed)) {
                continue
            }
            kept.append(line)
        }
        return kept.joined(separator: "\n")
    }

    private static func edgeLines(of page: String) -> [String] {
        let lines = page
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        guard !lines.isEmpty else { return [] }
        return Array(lines.prefix(2)) + Array(lines.suffix(2))
    }

    private static func edgeIndices(of lines: [String]) -> Set<Int> {
        let nonEmpty = lines.enumerated().filter { !$0.element.trimmingCharacters(in: .whitespaces).isEmpty }
        guard !nonEmpty.isEmpty else { return [] }
        let leading = nonEmpty.prefix(2).map(\.offset)
        let trailing = nonEmpty.suffix(2).map(\.offset)
        return Set(leading + trailing)
    }

    /// Page numbers differ per page, so they never repeat — match them by shape.
    private static func isPageNumber(_ line: String) -> Bool {
        if line.isEmpty || line.count > 12 { return false }
        if line.rangeOfCharacter(from: .letters) != nil { return false }
        return line.rangeOfCharacter(from: .decimalDigits) != nil
    }

    /// Strip digits so "Chapter 2 | 33" and "Chapter 2 | 34" count as one head.
    private static func normalize(_ line: String) -> String {
        line.components(separatedBy: CharacterSet.decimalDigits).joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
