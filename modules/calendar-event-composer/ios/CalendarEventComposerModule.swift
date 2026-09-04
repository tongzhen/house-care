import ExpoModulesCore
import EventKit
import EventKitUI

private final class CalendarEventComposerDelegate: NSObject, EKEventEditViewDelegate {
  let onComplete: () -> Void

  init(onComplete: @escaping () -> Void) {
    self.onComplete = onComplete
  }

  func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
    controller.dismiss(animated: true, completion: onComplete)
  }
}

public final class CalendarEventComposerModule: Module {
  private let eventStore = EKEventStore()
  private var completion: Promise?
  private var editorDelegate: CalendarEventComposerDelegate?

  public func definition() -> ModuleDefinition {
    Name("CalendarEventComposer")

    AsyncFunction("presentAsync") { (title: String, startAtMilliseconds: Double, endAtMilliseconds: Double, notes: String, promise: Promise) in
      guard self.completion == nil else {
        promise.reject("E_CALENDAR_EDITOR_IN_PROGRESS", "A calendar editor is already open.")
        return
      }
      guard let viewController = self.appContext?.utilities?.currentViewController() else {
        promise.reject("E_CALENDAR_EDITOR_UNAVAILABLE", "Unable to present the calendar editor.")
        return
      }

      let event = EKEvent(eventStore: self.eventStore)
      event.title = title
      event.startDate = Date(timeIntervalSince1970: startAtMilliseconds / 1_000)
      event.endDate = Date(timeIntervalSince1970: endAtMilliseconds / 1_000)
      event.notes = notes

      let editor = EKEventEditViewController()
      editor.eventStore = self.eventStore
      editor.event = event
      self.completion = promise
      let editorDelegate = CalendarEventComposerDelegate {
        self.completion?.resolve()
        self.completion = nil
        self.editorDelegate = nil
      }
      self.editorDelegate = editorDelegate
      editor.editViewDelegate = editorDelegate
      viewController.present(editor, animated: true)
    }.runOnQueue(.main)
  }
}
