import WidgetKit
import SwiftUI
import UIKit

private struct LocketWidgetPayload {
    let text: String
    let locationName: String
    let date: String
    let noteCount: Int
    let nearbyPlacesCount: Int
    let backgroundImageUrl: String?
    let backgroundImageBase64: String?
    let isIdleState: Bool
    let idleText: String
    let savedCountText: String
    let memoryReminderText: String

    static let placeholder = LocketWidgetPayload(
        text: "",
        locationName: "",
        date: "",
        noteCount: 0,
        nearbyPlacesCount: 0,
        backgroundImageUrl: nil,
        backgroundImageBase64: nil,
        isIdleState: true,
        idleText: "Note it down before she gets upset",
        savedCountText: "",
        memoryReminderText: ""
    )

    init(
        text: String,
        locationName: String,
        date: String,
        noteCount: Int,
        nearbyPlacesCount: Int,
        backgroundImageUrl: String?,
        backgroundImageBase64: String?,
        isIdleState: Bool,
        idleText: String,
        savedCountText: String,
        memoryReminderText: String
    ) {
        self.text = text
        self.locationName = locationName
        self.date = date
        self.noteCount = noteCount
        self.nearbyPlacesCount = nearbyPlacesCount
        self.backgroundImageUrl = backgroundImageUrl
        self.backgroundImageBase64 = backgroundImageBase64
        self.isIdleState = isIdleState
        self.idleText = idleText
        self.savedCountText = savedCountText
        self.memoryReminderText = memoryReminderText
    }

    init(rawProps: [String: Any]) {
        let payload = LocketWidgetPayload.unwrapPayload(from: rawProps)

        text = LocketWidgetPayload.stringValue(payload["text"])
        locationName = LocketWidgetPayload.stringValue(payload["locationName"])
        date = LocketWidgetPayload.stringValue(payload["date"])
        noteCount = LocketWidgetPayload.intValue(payload["noteCount"])
        nearbyPlacesCount = LocketWidgetPayload.intValue(payload["nearbyPlacesCount"])
        backgroundImageUrl = LocketWidgetPayload.optionalStringValue(payload["backgroundImageUrl"])
        backgroundImageBase64 = LocketWidgetPayload.optionalStringValue(payload["backgroundImageBase64"])
        isIdleState = LocketWidgetPayload.boolValue(payload["isIdleState"])
        idleText = LocketWidgetPayload.stringValue(payload["idleText"])
        savedCountText = LocketWidgetPayload.stringValue(payload["savedCountText"])
        memoryReminderText = LocketWidgetPayload.stringValue(payload["memoryReminderText"])
    }

    private static func unwrapPayload(from rawProps: [String: Any]) -> [String: Any] {
        if let nestedProps = rawProps["props"] as? [String: Any] {
            if let doubleNestedProps = nestedProps["props"] as? [String: Any] {
                return doubleNestedProps
            }
            return nestedProps
        }
        return rawProps
    }

    private static func stringValue(_ value: Any?) -> String {
        if let value = value as? String {
            return value.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return ""
    }

    private static func optionalStringValue(_ value: Any?) -> String? {
        let stringValue = stringValue(value)
        return stringValue.isEmpty ? nil : stringValue
    }

    private static func intValue(_ value: Any?) -> Int {
        if let value = value as? Int {
            return value
        }
        if let value = value as? NSNumber {
            return value.intValue
        }
        if let value = value as? Double {
            return Int(value)
        }
        return 0
    }

    private static func boolValue(_ value: Any?) -> Bool {
        if let value = value as? Bool {
            return value
        }
        if let value = value as? NSNumber {
            return value.boolValue
        }
        return false
    }
}

private struct LocketWidgetEntry: TimelineEntry {
    let date: Date
    let payload: LocketWidgetPayload
}

private struct LocketWidgetTimelineProvider: TimelineProvider {
    private var widgetDefaults: UserDefaults? {
        guard let appGroupIdentifier = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String else {
            return nil
        }

        return UserDefaults(suiteName: appGroupIdentifier)
    }

    func placeholder(in context: Context) -> LocketWidgetEntry {
        LocketWidgetEntry(date: Date(), payload: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (LocketWidgetEntry) -> Void) {
        completion(loadEntries().first ?? placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<LocketWidgetEntry>) -> Void) {
        let entries = loadEntries()
        let timelineEntries = entries.isEmpty ? [placeholder(in: context)] : entries
        completion(Timeline(entries: timelineEntries, policy: .atEnd))
    }

    private func loadEntries() -> [LocketWidgetEntry] {
        let timelineKey = "__expo_widgets_LocketWidget_timeline"
        let timeline = widgetDefaults?.array(forKey: timelineKey) ?? []

        return timeline.compactMap { item in
            guard
                let entry = item as? [String: Any],
                let timestamp = entry["timestamp"] as? Int,
                let rawProps = entry["props"] as? [String: Any]
            else {
                return nil
            }

            return LocketWidgetEntry(
                date: Date(timeIntervalSince1970: Double(timestamp) / 1000),
                payload: LocketWidgetPayload(rawProps: rawProps)
            )
        }
    }
}

private struct LocketWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family

    let entry: LocketWidgetEntry

    private var payload: LocketWidgetPayload { entry.payload }

    private var isLarge: Bool {
        family == .systemLarge
    }

    private var displayText: String {
        if payload.isIdleState {
            if !payload.idleText.isEmpty {
                return payload.idleText
            }
            return "Note it down before she gets upset"
        }

        if !payload.text.isEmpty {
            return payload.text
        }

        if !payload.memoryReminderText.isEmpty {
            return payload.memoryReminderText
        }

        return "A memory reminds you"
    }

    private var countLabel: String {
        if !payload.savedCountText.isEmpty {
            return payload.savedCountText
        }
        let noteLabel = payload.noteCount == 1 ? "note" : "notes"
        return "\(payload.noteCount) \(noteLabel)"
    }

    private var resolvedImage: UIImage? {
        if let backgroundImageUrl = payload.backgroundImageUrl,
           let image = loadImage(fromPath: backgroundImageUrl) {
            return image
        }

        if let backgroundImageBase64 = payload.backgroundImageBase64,
           let image = loadImage(fromBase64: backgroundImageBase64) {
            return image
        }

        return nil
    }

    private var hasPhotoBackground: Bool {
        resolvedImage != nil && !payload.isIdleState
    }

    private var textSurfaceColors: [Color] {
        [Color(red: 0.96, green: 0.94, blue: 0.91), Color(red: 0.93, green: 0.90, blue: 0.86)]
    }

    private var photoOverlayColors: [Color] {
        [Color.black.opacity(0.14), Color.black.opacity(0.48)]
    }

    var body: some View {
        Group {
            if #available(iOS 17.0, *) {
                contentLayer
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .containerBackground(for: .widget) {
                        backgroundLayer
                    }
            } else {
                legacyBody
            }
        }
    }

    private var legacyBody: some View {
        ZStack {
            ZStack {
                backgroundLayer
                contentLayer
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    private var backgroundLayer: some View {
        if let image = resolvedImage, hasPhotoBackground {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
                .overlay(
                    LinearGradient(
                        colors: photoOverlayColors,
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
        } else {
            LinearGradient(
                colors: textSurfaceColors,
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    @ViewBuilder
    private var contentLayer: some View {
        if isLarge {
            largeLayout
        } else {
            smallLayout
        }
    }

    private var smallLayout: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            Text(displayText)
                .font(.system(size: fontSize, weight: .regular, design: .serif))
                .foregroundStyle(primaryTextColor)
                .multilineTextAlignment(.center)
                .lineLimit(3)
                .padding(.horizontal, 18)

            Spacer(minLength: 0)

            if shouldShowCountBadge {
                countBadge
                    .padding(.bottom, 6)
            }
        }
        .padding(14)
    }

    private var largeLayout: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(displayText)
                .font(.system(size: fontSize, weight: .regular, design: .serif))
                .foregroundStyle(primaryTextColor)
                .multilineTextAlignment(.leading)
                .lineLimit(4)
                .frame(maxWidth: .infinity, alignment: .leading)

            Spacer(minLength: 18)

            if shouldShowCountBadge {
                HStack {
                    countBadge
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 22)
    }

    private var fontSize: CGFloat {
        let count = displayText.trimmingCharacters(in: .whitespacesAndNewlines).count

        if isLarge {
            if count <= 60 { return 26 }
            if count <= 120 { return 22 }
            return 20
        }

        if count <= 28 { return 17 }
        if count <= 64 { return 15.5 }
        return 14.5
    }

    private var shouldShowCountBadge: Bool {
        !payload.isIdleState && payload.noteCount > 0
    }

    private var primaryTextColor: Color {
        hasPhotoBackground ? Color.white : Color(red: 0.17, green: 0.10, blue: 0.07)
    }

    private var badgeBackgroundColor: Color {
        hasPhotoBackground
            ? Color.white.opacity(0.18)
            : Color.white.opacity(0.84)
    }

    private var badgeForegroundColor: Color {
        hasPhotoBackground
            ? Color.white
            : Color(red: 0.43, green: 0.37, blue: 0.31)
    }

    private var countBadge: some View {
        Text(countLabel)
            .font(.system(size: isLarge ? 11 : 10, weight: .medium))
            .foregroundStyle(badgeForegroundColor)
            .padding(.horizontal, isLarge ? 12 : 10)
            .padding(.vertical, isLarge ? 6 : 5)
            .background(badgeBackgroundColor)
            .clipShape(Capsule())
    }

    private func loadImage(fromPath path: String) -> UIImage? {
        let normalizedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedPath.isEmpty else {
            return nil
        }

        if normalizedPath.hasPrefix("file://"), let url = URL(string: normalizedPath) {
            return UIImage(contentsOfFile: url.path)
        }

        return UIImage(contentsOfFile: normalizedPath)
    }

    private func loadImage(fromBase64 base64: String) -> UIImage? {
        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
            return nil
        }
        return UIImage(data: data)
    }
}

struct LocketWidget: Widget {
    let name: String = "LocketWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: name, provider: LocketWidgetTimelineProvider()) { entry in
            LocketWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Memories")
        .description("See your latest memory on your Home Screen.")
        .supportedFamilies([.systemSmall, .systemLarge])
    }
}
