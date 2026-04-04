import WidgetKit
import SwiftUI
import UIKit

private func widgetLocalized(_ key: String, fallback: String) -> String {
    NSLocalizedString(key, tableName: nil, bundle: .main, value: fallback, comment: "")
}

private func widgetLocalizedCount(_ singularKey: String, pluralKey: String, count: Int) -> String {
    let format = widgetLocalized(
        count == 1 ? singularKey : pluralKey,
        fallback: count == 1 ? "%d item" : "%d items"
    )
    return String.localizedStringWithFormat(format, count)
}

private struct LocketWidgetPayload {
    let noteType: String
    let text: String
    let locationName: String
    let date: String
    let noteCount: Int
    let nearbyPlacesCount: Int
    let isLivePhoto: Bool
    let backgroundImageUrl: String?
    let backgroundImageBase64: String?
    let backgroundGradientStartColor: String?
    let backgroundGradientEndColor: String?
    let hasDoodle: Bool
    let doodleStrokesJson: String?
    let hasStickers: Bool
    let stickerPlacementsJson: String?
    let isIdleState: Bool
    let idleText: String
    let savedCountText: String
    let nearbyPlacesLabelText: String
    let memoryReminderText: String
    let accessorySaveMemoryText: String
    let accessoryAddFirstPlaceText: String
    let accessoryMemoryNearbyText: String
    let accessoryOpenAppText: String
    let accessoryAddLabelText: String
    let accessorySavedLabelText: String
    let accessoryNearLabelText: String
    let livePhotoBadgeText: String
    let isSharedContent: Bool
    let authorDisplayName: String
    let authorInitials: String
    let authorAvatarImageUrl: String?
    let authorAvatarImageBase64: String?
    let primaryActionUrl: String
    let badgeActionUrl: String?

    static let placeholder = LocketWidgetPayload(
        noteType: "text",
        text: "",
        locationName: "",
        date: "",
        noteCount: 0,
        nearbyPlacesCount: 0,
        isLivePhoto: false,
        backgroundImageUrl: nil,
        backgroundImageBase64: nil,
        backgroundGradientStartColor: nil,
        backgroundGradientEndColor: nil,
        hasDoodle: false,
        doodleStrokesJson: nil,
        hasStickers: false,
        stickerPlacementsJson: nil,
        isIdleState: true,
        idleText: widgetLocalized("widget.idleText", fallback: "The right note will appear when you're nearby."),
        savedCountText: "",
        nearbyPlacesLabelText: "",
        memoryReminderText: widgetLocalized("widget.memoryReminder", fallback: "A quiet reminder from here."),
        accessorySaveMemoryText: widgetLocalized("widget.accessorySaveMemory", fallback: "Save a memory"),
        accessoryAddFirstPlaceText: widgetLocalized("widget.accessoryAddFirstPlace", fallback: "Add your first place"),
        accessoryMemoryNearbyText: widgetLocalized("widget.accessoryMemoryNearby", fallback: "Memory nearby"),
        accessoryOpenAppText: widgetLocalized("widget.accessoryOpenApp", fallback: "Open Noto"),
        accessoryAddLabelText: widgetLocalized("widget.accessoryAddLabel", fallback: "Add"),
        accessorySavedLabelText: widgetLocalized("widget.accessorySavedLabel", fallback: "Saved"),
        accessoryNearLabelText: widgetLocalized("widget.accessoryNearLabel", fallback: "Near"),
        livePhotoBadgeText: widgetLocalized("widget.livePhotoBadge", fallback: "Live"),
        isSharedContent: false,
        authorDisplayName: "",
        authorInitials: "",
        authorAvatarImageUrl: nil,
        authorAvatarImageBase64: nil,
        primaryActionUrl: "noto:///",
        badgeActionUrl: nil
    )

    init(
        noteType: String,
        text: String,
        locationName: String,
        date: String,
        noteCount: Int,
        nearbyPlacesCount: Int,
        isLivePhoto: Bool,
        backgroundImageUrl: String?,
        backgroundImageBase64: String?,
        backgroundGradientStartColor: String?,
        backgroundGradientEndColor: String?,
        hasDoodle: Bool,
        doodleStrokesJson: String?,
        hasStickers: Bool,
        stickerPlacementsJson: String?,
        isIdleState: Bool,
        idleText: String,
        savedCountText: String,
        nearbyPlacesLabelText: String,
        memoryReminderText: String,
        accessorySaveMemoryText: String,
        accessoryAddFirstPlaceText: String,
        accessoryMemoryNearbyText: String,
        accessoryOpenAppText: String,
        accessoryAddLabelText: String,
        accessorySavedLabelText: String,
        accessoryNearLabelText: String,
        livePhotoBadgeText: String,
        isSharedContent: Bool,
        authorDisplayName: String,
        authorInitials: String,
        authorAvatarImageUrl: String?,
        authorAvatarImageBase64: String?,
        primaryActionUrl: String,
        badgeActionUrl: String?
    ) {
        self.noteType = noteType
        self.text = text
        self.locationName = locationName
        self.date = date
        self.noteCount = noteCount
        self.nearbyPlacesCount = nearbyPlacesCount
        self.isLivePhoto = isLivePhoto
        self.backgroundImageUrl = backgroundImageUrl
        self.backgroundImageBase64 = backgroundImageBase64
        self.backgroundGradientStartColor = backgroundGradientStartColor
        self.backgroundGradientEndColor = backgroundGradientEndColor
        self.hasDoodle = hasDoodle
        self.doodleStrokesJson = doodleStrokesJson
        self.hasStickers = hasStickers
        self.stickerPlacementsJson = stickerPlacementsJson
        self.isIdleState = isIdleState
        self.idleText = idleText
        self.savedCountText = savedCountText
        self.nearbyPlacesLabelText = nearbyPlacesLabelText
        self.memoryReminderText = memoryReminderText
        self.accessorySaveMemoryText = accessorySaveMemoryText
        self.accessoryAddFirstPlaceText = accessoryAddFirstPlaceText
        self.accessoryMemoryNearbyText = accessoryMemoryNearbyText
        self.accessoryOpenAppText = accessoryOpenAppText
        self.accessoryAddLabelText = accessoryAddLabelText
        self.accessorySavedLabelText = accessorySavedLabelText
        self.accessoryNearLabelText = accessoryNearLabelText
        self.livePhotoBadgeText = livePhotoBadgeText
        self.isSharedContent = isSharedContent
        self.authorDisplayName = authorDisplayName
        self.authorInitials = authorInitials
        self.authorAvatarImageUrl = authorAvatarImageUrl
        self.authorAvatarImageBase64 = authorAvatarImageBase64
        self.primaryActionUrl = primaryActionUrl
        self.badgeActionUrl = badgeActionUrl
    }

    init(rawProps: [String: Any]) {
        let payload = LocketWidgetPayload.unwrapPayload(from: rawProps)

        noteType = LocketWidgetPayload.stringValue(payload["noteType"])
        text = LocketWidgetPayload.stringValue(payload["text"])
        locationName = LocketWidgetPayload.stringValue(payload["locationName"])
        date = LocketWidgetPayload.stringValue(payload["date"])
        noteCount = LocketWidgetPayload.intValue(payload["noteCount"])
        nearbyPlacesCount = LocketWidgetPayload.intValue(payload["nearbyPlacesCount"])
        isLivePhoto = LocketWidgetPayload.boolValue(payload["isLivePhoto"])
        backgroundImageUrl = LocketWidgetPayload.optionalStringValue(payload["backgroundImageUrl"])
        backgroundImageBase64 = LocketWidgetPayload.optionalStringValue(payload["backgroundImageBase64"])
        backgroundGradientStartColor = LocketWidgetPayload.optionalStringValue(payload["backgroundGradientStartColor"])
        backgroundGradientEndColor = LocketWidgetPayload.optionalStringValue(payload["backgroundGradientEndColor"])
        hasDoodle = LocketWidgetPayload.boolValue(payload["hasDoodle"])
        doodleStrokesJson = LocketWidgetPayload.optionalStringValue(payload["doodleStrokesJson"])
        hasStickers = LocketWidgetPayload.boolValue(payload["hasStickers"])
        stickerPlacementsJson = LocketWidgetPayload.optionalStringValue(payload["stickerPlacementsJson"])
        isIdleState = LocketWidgetPayload.boolValue(payload["isIdleState"])
        idleText = LocketWidgetPayload.stringValue(payload["idleText"])
        savedCountText = LocketWidgetPayload.stringValue(payload["savedCountText"])
        nearbyPlacesLabelText = LocketWidgetPayload.stringValue(payload["nearbyPlacesLabelText"])
        memoryReminderText = LocketWidgetPayload.stringValue(payload["memoryReminderText"])
        accessorySaveMemoryText = LocketWidgetPayload.stringValue(payload["accessorySaveMemoryText"])
        accessoryAddFirstPlaceText = LocketWidgetPayload.stringValue(payload["accessoryAddFirstPlaceText"])
        accessoryMemoryNearbyText = LocketWidgetPayload.stringValue(payload["accessoryMemoryNearbyText"])
        accessoryOpenAppText = LocketWidgetPayload.stringValue(payload["accessoryOpenAppText"])
        accessoryAddLabelText = LocketWidgetPayload.stringValue(payload["accessoryAddLabelText"])
        accessorySavedLabelText = LocketWidgetPayload.stringValue(payload["accessorySavedLabelText"])
        accessoryNearLabelText = LocketWidgetPayload.stringValue(payload["accessoryNearLabelText"])
        livePhotoBadgeText = LocketWidgetPayload.stringValue(payload["livePhotoBadgeText"])
        isSharedContent = LocketWidgetPayload.boolValue(payload["isSharedContent"])
        authorDisplayName = LocketWidgetPayload.stringValue(payload["authorDisplayName"])
        authorInitials = LocketWidgetPayload.stringValue(payload["authorInitials"])
        authorAvatarImageUrl = LocketWidgetPayload.optionalStringValue(payload["authorAvatarImageUrl"])
        authorAvatarImageBase64 = LocketWidgetPayload.optionalStringValue(payload["authorAvatarImageBase64"])
        primaryActionUrl = LocketWidgetPayload.stringValue(payload["primaryActionUrl"])
        badgeActionUrl = LocketWidgetPayload.optionalStringValue(payload["badgeActionUrl"])
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

private struct LocketWidgetDoodleStroke {
    let colorHex: String
    let points: [CGPoint]
}

private struct LocketWidgetStickerPlacement: Identifiable {
    let id: String
    let x: CGFloat
    let y: CGFloat
    let scale: CGFloat
    let rotation: Double
    let zIndex: Int
    let opacity: Double
    let outlineEnabled: Bool
    let assetWidth: CGFloat
    let assetHeight: CGFloat
    let assetLocalUri: String
}

private struct LocketWidgetDoodleOverlay: View {
    let strokes: [LocketWidgetDoodleStroke]
    let isLarge: Bool
    let overlayOpacity: Double
    let contentInset: CGFloat

    init(
        strokes: [LocketWidgetDoodleStroke],
        isLarge: Bool,
        overlayOpacity: Double,
        contentInset: CGFloat = 0
    ) {
        self.strokes = strokes
        self.isLarge = isLarge
        self.overlayOpacity = overlayOpacity
        self.contentInset = contentInset
    }

    var body: some View {
        Canvas { context, size in
            let baseLineWidth = max(4, min(size.width, size.height) * (isLarge ? 0.011 : 0.013))

            for stroke in strokes {
                guard !stroke.points.isEmpty else {
                    continue
                }

                let strokeColor = colorFromHex(stroke.colorHex).opacity(overlayOpacity)
                let dotColor = colorFromHex(stroke.colorHex).opacity(overlayOpacity)
                let resolvedPoints = stroke.points.map { point in
                    CGPoint(x: point.x * size.width, y: point.y * size.height)
                }

                if resolvedPoints.count == 1, let point = resolvedPoints.first {
                    let rect = CGRect(
                        x: point.x - baseLineWidth / 2,
                        y: point.y - baseLineWidth / 2,
                        width: baseLineWidth,
                        height: baseLineWidth
                    )
                    context.fill(Path(ellipseIn: rect), with: .color(dotColor))
                    continue
                }

                var path = Path()
                path.move(to: resolvedPoints[0])

                if resolvedPoints.count == 2 {
                    path.addLine(to: resolvedPoints[1])
                } else {
                    if resolvedPoints.count > 3 {
                        for index in 1..<(resolvedPoints.count - 2) {
                            let current = resolvedPoints[index]
                            let next = resolvedPoints[index + 1]
                            let midpoint = CGPoint(
                                x: (current.x + next.x) / 2,
                                y: (current.y + next.y) / 2
                            )
                            path.addQuadCurve(to: midpoint, control: current)
                        }
                    }

                    path.addQuadCurve(
                        to: resolvedPoints[resolvedPoints.count - 1],
                        control: resolvedPoints[resolvedPoints.count - 2]
                    )
                }

                context.stroke(
                    path,
                    with: .color(strokeColor),
                    style: StrokeStyle(
                        lineWidth: baseLineWidth,
                        lineCap: .round,
                        lineJoin: .round
                    )
                )
            }
        }
        .padding(contentInset)
    }
}

private let locketWidgetDoodleArtboardInset: CGFloat = 18

private func parseDoodleStrokes(from doodleStrokesJson: String?) -> [LocketWidgetDoodleStroke] {
    guard
        let doodleStrokesJson,
        let data = doodleStrokesJson.data(using: .utf8),
        let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else {
        return []
    }

    return parsed.compactMap { item in
        guard
            let colorHex = item["color"] as? String,
            let rawPoints = item["points"] as? [NSNumber]
        else {
            return nil
        }

        var points: [CGPoint] = []
        var index = 0
        while index + 1 < rawPoints.count {
            let x = CGFloat(max(0, min(1, rawPoints[index].doubleValue)))
            let y = CGFloat(max(0, min(1, rawPoints[index + 1].doubleValue)))
            points.append(CGPoint(x: x, y: y))
            index += 2
        }

        guard !points.isEmpty else {
            return nil
        }

        return LocketWidgetDoodleStroke(colorHex: colorHex, points: points)
    }
}

private func parseStickerPlacements(from stickerPlacementsJson: String?) -> [LocketWidgetStickerPlacement] {
    guard
        let stickerPlacementsJson,
        let data = stickerPlacementsJson.data(using: .utf8),
        let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else {
        return []
    }

    return parsed.compactMap { item in
        guard
            let id = item["id"] as? String,
            let asset = item["asset"] as? [String: Any],
            let assetLocalUri = (asset["localUri"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
            !assetLocalUri.isEmpty
        else {
            return nil
        }

        let assetWidth = CGFloat((asset["width"] as? NSNumber)?.doubleValue ?? 0)
        let assetHeight = CGFloat((asset["height"] as? NSNumber)?.doubleValue ?? 0)
        guard assetWidth > 0, assetHeight > 0 else {
            return nil
        }

        let x = CGFloat((item["x"] as? NSNumber)?.doubleValue ?? 0.5)
        let y = CGFloat((item["y"] as? NSNumber)?.doubleValue ?? 0.5)
        let scale = CGFloat((item["scale"] as? NSNumber)?.doubleValue ?? 1)
        let rotation = (item["rotation"] as? NSNumber)?.doubleValue ?? 0
        let zIndex = (item["zIndex"] as? NSNumber)?.intValue ?? 0
        let opacity = (item["opacity"] as? NSNumber)?.doubleValue ?? 1
        let outlineEnabled = (item["outlineEnabled"] as? NSNumber)?.boolValue ?? true

        return LocketWidgetStickerPlacement(
            id: id,
            x: min(max(0, x), 1),
            y: min(max(0, y), 1),
            scale: min(max(0.35, scale), 3),
            rotation: rotation,
            zIndex: zIndex,
            opacity: min(max(0, opacity), 1),
            outlineEnabled: outlineEnabled,
            assetWidth: assetWidth,
            assetHeight: assetHeight,
            assetLocalUri: assetLocalUri
        )
    }
}

private let locketWidgetStickerOutlineOffsets: [CGPoint] = [
    CGPoint(x: -1, y: 0),
    CGPoint(x: -0.92, y: -0.38),
    CGPoint(x: -0.71, y: -0.71),
    CGPoint(x: -0.38, y: -0.92),
    CGPoint(x: 0, y: -1),
    CGPoint(x: 0.38, y: -0.92),
    CGPoint(x: 0.71, y: -0.71),
    CGPoint(x: 0.92, y: -0.38),
    CGPoint(x: 1, y: 0),
    CGPoint(x: 0.92, y: 0.38),
    CGPoint(x: 0.71, y: 0.71),
    CGPoint(x: 0.38, y: 0.92),
    CGPoint(x: 0, y: 1),
    CGPoint(x: -0.38, y: 0.92),
    CGPoint(x: -0.71, y: 0.71),
    CGPoint(x: -0.92, y: 0.38)
]
private let locketWidgetStickerOutlineOpacity: Double = 0.72

private func getWidgetStickerOutlineSize(width: CGFloat, height: CGFloat) -> CGFloat {
    max(2.5, min(6, min(width, height) * 0.032))
}

private struct LocketWidgetStickerOverlay: View {
    let placements: [LocketWidgetStickerPlacement]
    let overlayOpacity: Double
    let artboardInset: CGFloat
    let minimumBaseSize: CGFloat
    let baseSizeRatio: CGFloat

    init(
        placements: [LocketWidgetStickerPlacement],
        overlayOpacity: Double,
        artboardInset: CGFloat = 18,
        minimumBaseSize: CGFloat = 68,
        baseSizeRatio: CGFloat = 0.30
    ) {
        self.placements = placements
        self.overlayOpacity = overlayOpacity
        self.artboardInset = artboardInset
        self.minimumBaseSize = minimumBaseSize
        self.baseSizeRatio = baseSizeRatio
    }

    var body: some View {
        GeometryReader { proxy in
            let artboardWidth = max(1, proxy.size.width - (artboardInset * 2))
            let artboardHeight = max(1, proxy.size.height - (artboardInset * 2))
            let baseSize = max(minimumBaseSize, min(artboardWidth, artboardHeight) * baseSizeRatio)

            ZStack {
                ForEach(placements.sorted(by: { left, right in
                    if left.zIndex == right.zIndex {
                        return left.id < right.id
                    }
                    return left.zIndex < right.zIndex
                })) { placement in
                    if let image = loadWidgetImageFromPath(placement.assetLocalUri) {
                        let longestEdge = max(max(placement.assetWidth, placement.assetHeight), 1)
                        let baseScale = baseSize / longestEdge
                        let stickerWidth = placement.assetWidth * baseScale * placement.scale
                        let stickerHeight = placement.assetHeight * baseScale * placement.scale
                        let outlineSize = getWidgetStickerOutlineSize(width: stickerWidth, height: stickerHeight)
                        let renderedImage = image.withRenderingMode(.alwaysOriginal)
                        let outlineImage = image.withRenderingMode(.alwaysTemplate)

                        ZStack {
                            if placement.outlineEnabled {
                                ForEach(Array(locketWidgetStickerOutlineOffsets.enumerated()), id: \.offset) { _, offset in
                                    Image(uiImage: outlineImage)
                                        .resizable()
                                        .renderingMode(.template)
                                        .scaledToFit()
                                        .frame(width: stickerWidth, height: stickerHeight)
                                        .foregroundStyle(Color.white)
                                        .opacity(locketWidgetStickerOutlineOpacity * placement.opacity * overlayOpacity)
                                        .offset(
                                            x: offset.x * outlineSize,
                                            y: offset.y * outlineSize
                                        )
                                }
                            }

                            Image(uiImage: renderedImage)
                                .resizable()
                                .scaledToFit()
                                .frame(width: stickerWidth, height: stickerHeight)
                                .opacity(placement.opacity * overlayOpacity)
                        }
                        .rotationEffect(.degrees(placement.rotation))
                        .position(
                            x: artboardInset + (placement.x * artboardWidth),
                            y: artboardInset + (placement.y * artboardHeight)
                        )
                        .zIndex(Double(placement.zIndex))
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .allowsHitTesting(false)
    }
}

private func colorFromHex(_ value: String) -> Color {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    let hex = trimmed.hasPrefix("#") ? String(trimmed.dropFirst()) : trimmed
    var number: UInt64 = 0

    guard Scanner(string: hex).scanHexInt64(&number) else {
        return Color.black
    }

    switch hex.count {
    case 6:
        let red = Double((number & 0xFF0000) >> 16) / 255.0
        let green = Double((number & 0x00FF00) >> 8) / 255.0
        let blue = Double(number & 0x0000FF) / 255.0
        return Color(red: red, green: green, blue: blue)
    case 8:
        let alpha = Double((number & 0xFF000000) >> 24) / 255.0
        let red = Double((number & 0x00FF0000) >> 16) / 255.0
        let green = Double((number & 0x0000FF00) >> 8) / 255.0
        let blue = Double(number & 0x000000FF) / 255.0
        return Color(.sRGB, red: red, green: green, blue: blue, opacity: alpha)
    default:
        return Color.black
    }
}

private func loadWidgetImageFromPath(_ path: String) -> UIImage? {
    let normalizedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedPath.isEmpty else {
        return nil
    }

    if normalizedPath.hasPrefix("file://"), let url = URL(string: normalizedPath) {
        return UIImage(contentsOfFile: url.path)
    }

    return UIImage(contentsOfFile: normalizedPath)
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

    private var isMedium: Bool {
        family == .systemMedium
    }

    private var isAccessoryInline: Bool {
        family == .accessoryInline
    }

    private var isAccessoryCircular: Bool {
        family == .accessoryCircular
    }

    private var isAccessoryRectangular: Bool {
        family == .accessoryRectangular
    }

    private var isAccessoryFamily: Bool {
        isAccessoryInline || isAccessoryCircular || isAccessoryRectangular
    }

    private var primaryActionURL: URL? {
        let normalized = payload.primaryActionUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            return nil
        }

        return URL(string: normalized)
    }

    private var displayText: String {
        if payload.isIdleState {
            if !payload.idleText.isEmpty {
                return payload.idleText
            }
            return widgetLocalized("widget.idleText", fallback: "The right note will appear when you're nearby.")
        }

        if !payload.text.isEmpty {
            return payload.text
        }

        if hasVisualOnlyTextContent {
            return ""
        }

        if !payload.memoryReminderText.isEmpty {
            return payload.memoryReminderText
        }

        return widgetLocalized("widget.memoryReminder", fallback: "A quiet reminder from here.")
    }

    private var shouldHidePhotoBodyText: Bool {
        !payload.isIdleState &&
        payload.noteType == "photo" &&
        hasPhotoBackground
    }

    private var shouldHideSharedBodyText: Bool {
        payload.isSharedContent &&
        !payload.isIdleState &&
        (shouldHidePhotoBodyText || shouldShowDoodleOverlay || shouldShowStickerOverlay)
    }

    private var shouldHideBodyText: Bool {
        shouldHidePhotoBodyText || shouldHideSharedBodyText
    }

    private var contentDisplayText: String {
        shouldHideBodyText ? "" : displayText
    }

    private var hasLocationEyebrow: Bool {
        !payload.isIdleState && !payload.locationName.isEmpty
    }

    private var countLabel: String {
        if !payload.savedCountText.isEmpty {
            return payload.savedCountText
        }
        return widgetLocalizedCount(
            "widget.countBadgeFallbackOne",
            pluralKey: "widget.countBadgeFallbackOther",
            count: payload.noteCount
        )
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

    private var resolvedAuthorAvatar: UIImage? {
        if let authorAvatarImageUrl = payload.authorAvatarImageUrl,
           let image = loadImage(fromPath: authorAvatarImageUrl) {
            return image
        }

        if let authorAvatarImageBase64 = payload.authorAvatarImageBase64,
           let image = loadImage(fromBase64: authorAvatarImageBase64) {
            return image
        }

        return nil
    }

    private var hasPhotoBackground: Bool {
        resolvedImage != nil && !payload.isIdleState
    }

    private var doodleStrokes: [LocketWidgetDoodleStroke] {
        parseDoodleStrokes(from: payload.doodleStrokesJson)
    }

    private var stickerPlacements: [LocketWidgetStickerPlacement] {
        parseStickerPlacements(from: payload.stickerPlacementsJson)
    }

    private var shouldShowDoodleOverlay: Bool {
        !isAccessoryFamily &&
        !payload.isIdleState &&
        payload.hasDoodle &&
        !doodleStrokes.isEmpty
    }

    private var shouldShowStickerOverlay: Bool {
        !isAccessoryFamily &&
        !payload.isIdleState &&
        payload.hasStickers &&
        !stickerPlacements.isEmpty
    }

    private var shouldShowAuthorChip: Bool {
        !isAccessoryFamily &&
        !payload.isIdleState &&
        payload.isSharedContent &&
        (
            !compactAuthorName.isEmpty ||
            !payload.authorInitials.isEmpty ||
            payload.authorAvatarImageUrl != nil ||
            payload.authorAvatarImageBase64 != nil
        )
    }

    private var shouldShowLivePhotoBadge: Bool {
        !isAccessoryFamily &&
        !payload.isIdleState &&
        payload.noteType == "photo" &&
        payload.isLivePhoto &&
        hasPhotoBackground
    }

    private var noteOverlayOpacity: Double {
        payload.noteType == "photo" ? 0.92 : 0.5
    }

    private var shouldPinLocationChip: Bool {
        hasLocationEyebrow && contentDisplayText.isEmpty
    }

    private var hasVisualOnlyTextContent: Bool {
        payload.noteType == "text" &&
        payload.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        (shouldShowStickerOverlay || shouldShowDoodleOverlay)
    }

    private var textSurfaceColors: [Color] {
        if
            let start = payload.backgroundGradientStartColor,
            let end = payload.backgroundGradientEndColor,
            !start.isEmpty,
            !end.isEmpty
        {
            return [colorFromHex(start), colorFromHex(end)]
        }

        return [Color(red: 0.96, green: 0.94, blue: 0.91), Color(red: 0.93, green: 0.90, blue: 0.86)]
    }

    private var photoOverlayColors: [Color] {
        [Color.black.opacity(0.14), Color.black.opacity(0.48)]
    }

    private var nearbyPlacesLabel: String {
        if !payload.nearbyPlacesLabelText.isEmpty {
            return payload.nearbyPlacesLabelText
        }

        let count = max(payload.nearbyPlacesCount, payload.isIdleState ? 0 : 1)
        return widgetLocalizedCount(
            "widget.nearbyPlaceFallbackOne",
            pluralKey: "widget.nearbyPlaceFallbackOther",
            count: count
        )
    }

    private var accessorySymbolName: String {
        if payload.noteCount <= 0 {
            return "plus.circle.fill"
        }

        return payload.isIdleState ? "bookmark.fill" : "location.fill"
    }

    private var accessoryTitle: String {
        let locationLabel = compactLocationName

        if payload.noteCount <= 0 {
            return payload.accessorySaveMemoryText.isEmpty
                ? widgetLocalized("widget.accessorySaveMemory", fallback: "Save a memory")
                : payload.accessorySaveMemoryText
        }

        if !locationLabel.isEmpty {
            return locationLabel
        }

        if payload.isIdleState {
            return countLabel
        }

        return payload.accessoryMemoryNearbyText.isEmpty
            ? widgetLocalized("widget.accessoryMemoryNearby", fallback: "Memory nearby")
            : payload.accessoryMemoryNearbyText
    }

    private var accessoryNearLabel: String {
        payload.accessoryNearLabelText.isEmpty
            ? widgetLocalized("widget.accessoryNearLabel", fallback: "Near")
            : payload.accessoryNearLabelText
    }

    private var accessorySubtitle: String {
        if payload.noteCount <= 0 {
            return payload.accessoryAddFirstPlaceText.isEmpty
                ? widgetLocalized("widget.accessoryAddFirstPlace", fallback: "Add your first place")
                : payload.accessoryAddFirstPlaceText
        }

        if !accessoryNoteExcerpt.isEmpty {
            return accessoryNoteExcerpt
        }

        if payload.isIdleState {
            return payload.accessoryOpenAppText.isEmpty
                ? widgetLocalized("widget.accessoryOpenApp", fallback: "Open Noto")
                : payload.accessoryOpenAppText
        }

        return nearbyPlacesLabel
    }

    private var accessoryInlineText: String {
        if payload.noteCount <= 0 {
            return payload.accessorySaveMemoryText.isEmpty
                ? widgetLocalized("widget.accessorySaveMemory", fallback: "Save a memory")
                : payload.accessorySaveMemoryText
        }

        if payload.isIdleState {
            return countLabel
        }

        let locationLabel = compactLocationName
        if !locationLabel.isEmpty {
            return "\(accessoryNearLabel) \(locationLabel)"
        }

        return payload.accessoryMemoryNearbyText.isEmpty
            ? widgetLocalized("widget.accessoryMemoryNearby", fallback: "Memory nearby")
            : payload.accessoryMemoryNearbyText
    }

    private var accessoryInlineFallbackText: String {
        payload.isIdleState ? countLabel : accessoryNearLabel
    }

    private var accessoryCircularValue: String {
        if payload.noteCount <= 0 {
            return "+"
        }

        if payload.isIdleState {
            return "\(payload.noteCount)"
        }

        return "\(max(payload.nearbyPlacesCount, 1))"
    }

    private var accessoryCircularCaption: String {
        if payload.noteCount <= 0 {
            return payload.accessoryAddLabelText.isEmpty
                ? widgetLocalized("widget.accessoryAddLabel", fallback: "Add")
                : payload.accessoryAddLabelText
        }

        if payload.isIdleState {
            return payload.accessorySavedLabelText.isEmpty
                ? widgetLocalized("widget.accessorySavedLabel", fallback: "Saved")
                : payload.accessorySavedLabelText
        }

        return accessoryNearLabel
    }

    private var accessoryRectangularValue: String? {
        if payload.noteCount <= 0 {
            return nil
        }

        if payload.isIdleState {
            return "\(payload.noteCount)"
        }

        return "\(max(payload.nearbyPlacesCount, 1))"
    }

    private var accessoryNoteExcerpt: String {
        let rawText = displayText
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !rawText.isEmpty else {
            return ""
        }

        let limit = payload.isIdleState ? 26 : 32
        if rawText.count <= limit {
            return rawText
        }

        let endIndex = rawText.index(rawText.startIndex, offsetBy: limit - 1)
        return "\(rawText[..<endIndex])…"
    }

    private var compactLocationName: String {
        let trimmed = payload.locationName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return ""
        }

        let firstSegment = trimmed
            .split(separator: ",", maxSplits: 1, omittingEmptySubsequences: true)
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? trimmed

        return firstSegment
    }

    private var compactAuthorName: String {
        let trimmed = payload.authorDisplayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return ""
        }

        let firstSegment = trimmed
            .split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? trimmed

        return firstSegment
    }

    var body: some View {
        Group {
            if isAccessoryFamily {
                accessoryContentLayer
            } else if #available(iOS 17.0, *) {
                contentLayer
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .containerBackground(for: .widget) {
                        backgroundLayer
                    }
            } else {
                legacyBody
            }
        }
        .widgetURL(primaryActionURL)
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
        } else if isMedium {
            mediumLayout
        } else {
            smallLayout
        }
    }

    @ViewBuilder
    private var accessoryContentLayer: some View {
        if isAccessoryRectangular {
            accessoryRectangularLayout
        } else if isAccessoryCircular {
            accessoryCircularLayout
        } else {
            accessoryInlineLayout
        }
    }

    private var accessoryInlineLayout: some View {
        ViewThatFits {
            HStack(spacing: 4) {
                Image(systemName: accessorySymbolName)
                    .font(.caption2.weight(.semibold))
                    .widgetAccentable()

                Text(accessoryInlineText)
            }
            HStack(spacing: 4) {
                Image(systemName: accessorySymbolName)
                    .font(.caption2.weight(.semibold))
                    .widgetAccentable()

                Text(accessoryInlineFallbackText)
            }
            Text(accessoryInlineFallbackText)
        }
        .font(.caption.weight(.semibold))
        .lineLimit(1)
        .minimumScaleFactor(0.85)
    }

    private var accessoryCircularLayout: some View {
        VStack(spacing: 1) {
            if payload.noteCount <= 0 {
                Image(systemName: "plus")
                    .font(.callout.weight(.bold))
                    .widgetAccentable()
            } else {
                Text(accessoryCircularValue)
                    .font(.title3.weight(.bold))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .widgetAccentable()
            }

            Text(accessoryCircularCaption)
                .font(.caption2)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }

    private var accessoryRectangularLayout: some View {
        HStack(alignment: .center, spacing: 8) {
            Image(systemName: accessorySymbolName)
                .font(.caption.weight(.semibold))
                .widgetAccentable()

            VStack(alignment: .leading, spacing: 1) {
                Text(accessoryTitle)
                    .font(.headline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
                    .widgetAccentable()

                Text(accessorySubtitle)
                    .font(.caption)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }

            Spacer(minLength: 0)

            if let value = accessoryRectangularValue {
                Text(value)
                    .font(.headline.weight(.bold))
                    .monospacedDigit()
                    .lineLimit(1)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.16), in: Capsule())
                    .widgetAccentable()
            }
        }
    }

    private var smallLayout: some View {
        ZStack(alignment: .bottom) {
            if shouldShowCountBadge {
                countBadge
                    .padding(.bottom, smallLayoutPadding + smallBadgeBottomPadding)
            }

            if shouldShowStickerOverlay {
                LocketWidgetStickerOverlay(
                    placements: stickerPlacements,
                    overlayOpacity: noteOverlayOpacity,
                    artboardInset: 0,
                    minimumBaseSize: 48,
                    baseSizeRatio: 0.24
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            if shouldShowDoodleOverlay {
                LocketWidgetDoodleOverlay(
                    strokes: doodleStrokes,
                    isLarge: false,
                    overlayOpacity: noteOverlayOpacity,
                    contentInset: 0
                )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .allowsHitTesting(false)
            }

            VStack(spacing: 0) {
                if shouldShowAuthorChip || shouldShowLivePhotoBadge || shouldPinLocationChip {
                    VStack(spacing: 0) {
                        if shouldShowAuthorChip || shouldShowLivePhotoBadge {
                            HStack {
                                if shouldShowAuthorChip {
                                    authorChip
                                }
                                Spacer(minLength: 0)
                                if shouldShowLivePhotoBadge {
                                    livePhotoBadge
                                }
                            }
                        }

                        if shouldPinLocationChip {
                            HStack {
                                Spacer(minLength: 0)
                                floatingLocationChip
                                Spacer(minLength: 0)
                            }
                            .padding(.top, (shouldShowAuthorChip || shouldShowLivePhotoBadge) ? 6 : 0)
                        }
                    }
                    .padding(.bottom, shouldPinLocationChip ? 10 : 6)
                }

                Spacer(minLength: 0)
                smallTextContent
                Spacer(minLength: 0)
            }
            .padding(.horizontal, smallLayoutPadding)
            .padding(.top, smallLayoutPadding)
            .padding(.bottom, smallLayoutPadding + (shouldShowCountBadge ? smallBadgeReservedSpace : 0))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var mediumLayout: some View {
        ZStack {
            if shouldShowStickerOverlay {
                LocketWidgetStickerOverlay(
                    placements: stickerPlacements,
                    overlayOpacity: noteOverlayOpacity
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            if shouldShowDoodleOverlay {
                LocketWidgetDoodleOverlay(
                    strokes: doodleStrokes,
                    isLarge: true,
                    overlayOpacity: noteOverlayOpacity,
                    contentInset: locketWidgetDoodleArtboardInset
                )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .allowsHitTesting(false)
            }

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 8) {
                    if shouldShowAuthorChip {
                        authorChip
                    }

                    Spacer(minLength: 0)

                    if shouldPinLocationChip || shouldShowLivePhotoBadge {
                        trailingOverlayChips
                    }
                }
                .padding(.bottom, (shouldShowAuthorChip || shouldPinLocationChip || shouldShowLivePhotoBadge) ? 10 : 0)

                if hasLocationEyebrow && !shouldPinLocationChip {
                    Text(payload.locationName)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(eyebrowTextColor)
                        .lineLimit(1)
                        .padding(.bottom, 10)
                }

                if !contentDisplayText.isEmpty {
                    Text(contentDisplayText)
                        .font(.system(size: mediumFontSize, weight: .regular, design: .serif))
                        .foregroundStyle(primaryTextColor)
                        .multilineTextAlignment(.leading)
                        .lineLimit(hasPhotoBackground ? 3 : 4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Spacer(minLength: 14)

                if shouldShowCountBadge {
                    HStack {
                        countBadge
                        Spacer(minLength: 0)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 18)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var smallTextContent: some View {
        VStack(spacing: 0) {
            if hasLocationEyebrow && !shouldPinLocationChip {
                Text(payload.locationName)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(eyebrowTextColor)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.bottom, 8)
            }

            if !contentDisplayText.isEmpty {
                Text(contentDisplayText)
                    .font(.system(size: fontSize, weight: .regular, design: .serif))
                    .foregroundStyle(primaryTextColor)
                    .multilineTextAlignment(.center)
                    .lineLimit(smallTextLineLimit)
                    .minimumScaleFactor(smallTextMinimumScaleFactor)
                    .allowsTightening(usesCompactSmallTextLayout)
                    .padding(.horizontal, smallTextHorizontalPadding)
                    .padding(.top, hasLocationEyebrow ? 2 : 10)
            }
        }
    }

    private var largeLayout: some View {
        ZStack {
            if shouldShowStickerOverlay {
                LocketWidgetStickerOverlay(
                    placements: stickerPlacements,
                    overlayOpacity: noteOverlayOpacity
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            if shouldShowDoodleOverlay {
                LocketWidgetDoodleOverlay(
                    strokes: doodleStrokes,
                    isLarge: true,
                    overlayOpacity: noteOverlayOpacity,
                    contentInset: locketWidgetDoodleArtboardInset
                )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .allowsHitTesting(false)
            }

            VStack(alignment: .leading, spacing: 0) {
                if shouldShowAuthorChip || shouldPinLocationChip || shouldShowLivePhotoBadge {
                    HStack(alignment: .top, spacing: 8) {
                        if shouldShowAuthorChip {
                            authorChip
                        }

                        Spacer(minLength: 0)

                        if shouldPinLocationChip || shouldShowLivePhotoBadge {
                            trailingOverlayChips
                        }
                    }
                    .padding(.bottom, (shouldShowAuthorChip || shouldPinLocationChip || shouldShowLivePhotoBadge) ? 10 : 0)
                }

                if hasLocationEyebrow && !shouldPinLocationChip {
                    Text(payload.locationName)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(eyebrowTextColor)
                        .lineLimit(1)
                        .padding(.bottom, 12)
                }

                if !contentDisplayText.isEmpty {
                    Text(contentDisplayText)
                        .font(.system(size: fontSize, weight: .regular, design: .serif))
                        .foregroundStyle(primaryTextColor)
                        .multilineTextAlignment(.leading)
                        .lineLimit(4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var fontSize: CGFloat {
        let count = contentDisplayText.trimmingCharacters(in: .whitespacesAndNewlines).count

        if isLarge {
            if count <= 60 { return 26 }
            if count <= 120 { return 22 }
            return 20
        }

        if count <= 28 { return 17 }
        if count <= 64 { return 15.5 }
        return 14.5
    }

    private var mediumFontSize: CGFloat {
        let count = contentDisplayText.trimmingCharacters(in: .whitespacesAndNewlines).count

        if count <= 60 { return 21 }
        if count <= 120 { return 18.5 }
        return 16.5
    }

    private var usesCompactSmallTextLayout: Bool {
        !isLarge && !hasPhotoBackground
    }

    private var smallTextLineLimit: Int {
        usesCompactSmallTextLayout ? 4 : 3
    }

    private var smallTextMinimumScaleFactor: CGFloat {
        usesCompactSmallTextLayout ? 0.82 : 1
    }

    private var smallTextHorizontalPadding: CGFloat {
        usesCompactSmallTextLayout ? 14 : 18
    }

    private var smallBadgeBottomPadding: CGFloat {
        usesCompactSmallTextLayout ? 4 : 6
    }

    private var smallBadgeReservedSpace: CGFloat {
        28
    }

    private var smallLayoutPadding: CGFloat {
        usesCompactSmallTextLayout ? 12 : 14
    }

    private var shouldShowCountBadge: Bool {
        payload.isIdleState && payload.noteCount > 0
    }

    private var primaryTextColor: Color {
        hasPhotoBackground
            ? Color.white
            : Color(red: 0.17, green: 0.10, blue: 0.07)
    }

    private var eyebrowTextColor: Color {
        hasPhotoBackground
            ? Color.white.opacity(0.82)
            : Color(red: 0.44, green: 0.36, blue: 0.30)
    }

    private var floatingLocationChipBackgroundColor: Color {
        hasPhotoBackground
            ? Color.black.opacity(0.28)
            : Color.white.opacity(0.72)
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

    private var floatingLocationChip: some View {
        Text(payload.locationName)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(eyebrowTextColor)
            .lineLimit(1)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(floatingLocationChipBackgroundColor)
            .clipShape(Capsule())
    }

    private var authorChipBackgroundColor: Color {
        hasPhotoBackground
            ? Color.black.opacity(0.30)
            : Color.white.opacity(0.84)
    }

    private var authorChipForegroundColor: Color {
        hasPhotoBackground
            ? Color.white
            : Color(red: 0.17, green: 0.10, blue: 0.07)
    }

    private var authorChip: some View {
        HStack(spacing: 6) {
            if let authorAvatar = resolvedAuthorAvatar {
                Image(uiImage: authorAvatar)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 18, height: 18)
                    .clipShape(Circle())
            } else if !payload.authorInitials.isEmpty {
                Text(payload.authorInitials)
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundStyle(authorChipForegroundColor)
                    .frame(width: 18, height: 18)
                    .background(authorChipForegroundColor.opacity(hasPhotoBackground ? 0.16 : 0.10))
                    .clipShape(Circle())
            }

            if !compactAuthorName.isEmpty {
                Text(compactAuthorName)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(authorChipForegroundColor)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(authorChipBackgroundColor)
        .clipShape(Capsule())
    }

    @ViewBuilder
    private var trailingOverlayChips: some View {
        VStack(alignment: .trailing, spacing: 8) {
            if shouldShowLivePhotoBadge {
                livePhotoBadge
            }

            if shouldPinLocationChip {
                floatingLocationChip
            }
        }
    }

    private var livePhotoBadgeLabel: String {
        payload.livePhotoBadgeText.isEmpty
            ? widgetLocalized("widget.livePhotoBadge", fallback: "Live")
            : payload.livePhotoBadgeText
    }

    private var livePhotoBadge: some View {
        HStack(spacing: 5) {
            Image(systemName: "livephoto")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(authorChipForegroundColor)

            if isMedium || isLarge {
                Text(livePhotoBadgeLabel)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(authorChipForegroundColor)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(authorChipBackgroundColor)
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
        .configurationDisplayName(widgetLocalized("widget.configTitle", fallback: "Nearby reminders"))
        .description(widgetLocalized("widget.configDescription", fallback: "See the right note when you return somewhere familiar."))
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryInline, .accessoryCircular, .accessoryRectangular])
    }
}
