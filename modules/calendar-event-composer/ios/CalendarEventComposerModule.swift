import ExpoModulesCore
import EventKit
import EventKitUI

public final class CalendarEventComposerModule: Module, EKEventEditViewDelegate {
  private let eventStore = EKEventStore()
  private var completion: Promise?

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
      editor.editViewDelegate = self
      self.completion = promise
      viewController.present(editor, animated: true)
    }.runOnQueue(.main)
  }

  public func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
    controller.dismiss(animated: true) {
      self.completion?.resolve()
      self.completion = nil
    }
  }
}
