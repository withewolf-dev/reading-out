//
//  TextHighlighting.swift
//  Vendored from the ReadingLoud Swift app.
//
//  Only change: the original's `nonisolated` keyword is dropped — it existed
//  because that app defaults to main-actor isolation, which this module doesn't.
//

import Foundation

/// A chunk of the text with its position in the whole, so highlighting only ever
/// rebuilds the one paragraph being spoken rather than the entire document.
struct Paragraph: Identifiable, Equatable {
    let id: Int
    /// UTF-16 offset of this paragraph's first character within the full text.
    let start: Int
    let text: String

    var end: Int { start + text.utf16.count }
    var isBlank: Bool { text.trimmingCharacters(in: .whitespaces).isEmpty }

    static func split(_ text: String) -> [Paragraph] {
        var result: [Paragraph] = []
        var cursor = 0
        for (index, line) in text.components(separatedBy: "\n").enumerated() {
            result.append(Paragraph(id: index, start: cursor, text: line))
            cursor += line.utf16.count + 1 // + the "\n" separator
        }
        return result
    }

    /// Splits this paragraph around `spokenRange` (given in full-text UTF-16 offsets).
    /// `highlighted` is empty when the spoken word lies outside this paragraph.
    ///
    /// Offsets are clamped and snapped to character boundaries, so a range that
    /// lands mid-surrogate-pair (emoji, some scripts) widens rather than crashing.
    func slice(around spokenRange: Range<Int>?) -> (prefix: String, highlighted: String, suffix: String) {
        guard let spokenRange, spokenRange.overlaps(start..<end), !text.isEmpty else {
            return (text, "", "")
        }

        let count = text.utf16.count
        let lower = max(0, min(spokenRange.lowerBound - start, count))
        let upper = max(lower, min(spokenRange.upperBound - start, count))

        let utf16 = text.utf16
        guard let lowIdx = utf16.index(utf16.startIndex, offsetBy: lower, limitedBy: utf16.endIndex),
              let highIdx = utf16.index(utf16.startIndex, offsetBy: upper, limitedBy: utf16.endIndex),
              // `samePositionIn` returns nil when the offset falls inside a
              // multi-unit character; fall back to leaving the paragraph plain.
              let start = lowIdx.samePosition(in: text),
              let finish = highIdx.samePosition(in: text),
              start <= finish else {
            return (text, "", "")
        }

        return (String(text[..<start]), String(text[start..<finish]), String(text[finish...]))
    }
}
