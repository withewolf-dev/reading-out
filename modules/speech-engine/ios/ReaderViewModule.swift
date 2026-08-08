import ExpoModulesCore
import SwiftUI

/// Hosts the SwiftUI reader as a React Native component. Props go down,
/// `onSeek` comes up — the word-by-word highlight never leaves Swift.
public class ReaderViewModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ReaderView")

        View(ReaderTextExpoView.self) {
            Events("onSeek", "onTint")

            Prop("text") { (view: ReaderTextExpoView, text: String) in
                view.model.setText(text)
            }
            Prop("fontSize") { (view: ReaderTextExpoView, size: Double) in
                view.model.fontSize = size
            }
            Prop("active") { (view: ReaderTextExpoView, active: Bool) in
                view.model.isActive = active
                if !active { view.model.spokenRange = nil }
            }
            Prop("startOffset") { (view: ReaderTextExpoView, offset: Int) in
                view.model.startOffset = offset
            }
            Prop("hue") { (view: ReaderTextExpoView, hue: Double) in
                view.model.setHue(hue)
            }
            Prop("coverPath") { (view: ReaderTextExpoView, path: String?) in
                if let path { view.model.setCover(path) }
            }
        }
    }
}

public final class ReaderTextExpoView: ExpoView {
    let model = ReaderModel()
    private let onSeek = EventDispatcher()
    private let onTint = EventDispatcher()
    private lazy var host = UIHostingController(rootView: ReaderTextView(model: model))

    public required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        clipsToBounds = true
        backgroundColor = .white

        host.view.backgroundColor = .clear
        addSubview(host.view)

        model.onSeek = { [weak self] offset in
            self?.onSeek(["offset": offset])
        }
        model.onTint = { [weak self] hue, saturation in
            self?.onTint(["hue": hue, "saturation": saturation])
        }
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        host.view.frame = bounds
    }

    /// SwiftUI needs a real view-controller parent for safe-area and lifecycle
    /// behaviour; without it, scrolling and animations misbehave in subtle ways.
    public override func didMoveToWindow() {
        super.didMoveToWindow()
        guard let parent = closestViewController(), host.parent !== parent else { return }
        parent.addChild(host)
        host.didMove(toParent: parent)
    }

    private func closestViewController() -> UIViewController? {
        var responder: UIResponder? = self
        while let next = responder?.next {
            if let controller = next as? UIViewController { return controller }
            responder = next
        }
        return nil
    }
}
