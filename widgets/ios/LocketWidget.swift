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
    let noteColorId: String?
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
        noteColorId: nil,
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
        noteColorId: String?,
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
        self.noteColorId = noteColorId
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
        noteColorId = LocketWidgetPayload.optionalStringValue(payload["noteColorId"])
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
    let renderMode: String
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
        let renderMode = (item["renderMode"] as? String) == "stamp" ? "stamp" : "default"
        let outlineEnabled = (item["outlineEnabled"] as? NSNumber)?.boolValue ?? true

        return LocketWidgetStickerPlacement(
            id: id,
            x: min(max(0, x), 1),
            y: min(max(0, y), 1),
            scale: min(max(0.35, scale), 3),
            rotation: rotation,
            zIndex: zIndex,
            opacity: min(max(0, opacity), 1),
            renderMode: renderMode,
            outlineEnabled: outlineEnabled,
            assetWidth: assetWidth,
            assetHeight: assetHeight,
            assetLocalUri: assetLocalUri
        )
    }
}

private struct LocketWidgetStampMetrics {
    let borderRadius: CGFloat
    let outerWidth: CGFloat
    let outerHeight: CGFloat
    let perforationOffset: CGFloat
    let perforationRadius: CGFloat
}

private func clampWidgetScalar(_ value: CGFloat, min minValue: CGFloat, max maxValue: CGFloat) -> CGFloat {
    Swift.min(maxValue, Swift.max(minValue, value))
}

private func buildWidgetStampPerforationCenters(length: CGFloat, radius: CGFloat) -> [CGFloat] {
    let safeLength = max(length, radius * 4)
    let preferredSpacing = max(radius * 1.95, 10)
    let count = max(5, Int(floor(safeLength / preferredSpacing)))
    let start = radius * 0.58
    let end = safeLength - radius * 0.58
    let step = count <= 1 ? 0 : (end - start) / CGFloat(count - 1)

    return (0..<count).map { index in
        start + (step * CGFloat(index))
    }
}

private func getWidgetStampMetrics(width: CGFloat, height: CGFloat) -> LocketWidgetStampMetrics {
    let shortestEdge = max(min(width, height), 1)
    let perforationRadius = clampWidgetScalar(shortestEdge * 0.048, min: 4, max: 6.6)
    let perforationOffset = perforationRadius * 0.18
    let borderRadius = clampWidgetScalar(shortestEdge * 0.02, min: 1.5, max: 3.5)

    return LocketWidgetStampMetrics(
        borderRadius: borderRadius,
        outerWidth: width,
        outerHeight: height,
        perforationOffset: perforationOffset,
        perforationRadius: perforationRadius
    )
}

private func createWidgetStampPath(in rect: CGRect, metrics: LocketWidgetStampMetrics) -> Path {
    var path = Path(roundedRect: rect, cornerRadius: metrics.borderRadius)

    for centerX in buildWidgetStampPerforationCenters(length: rect.width, radius: metrics.perforationRadius) {
        let topRect = CGRect(
            x: rect.minX + centerX - metrics.perforationRadius,
            y: rect.minY - metrics.perforationOffset - metrics.perforationRadius,
            width: metrics.perforationRadius * 2,
            height: metrics.perforationRadius * 2
        )
        let bottomRect = CGRect(
            x: rect.minX + centerX - metrics.perforationRadius,
            y: rect.maxY + metrics.perforationOffset - metrics.perforationRadius,
            width: metrics.perforationRadius * 2,
            height: metrics.perforationRadius * 2
        )

        path.addEllipse(in: topRect)
        path.addEllipse(in: bottomRect)
    }

    for centerY in buildWidgetStampPerforationCenters(length: rect.height, radius: metrics.perforationRadius) {
        let leftRect = CGRect(
            x: rect.minX - metrics.perforationOffset - metrics.perforationRadius,
            y: rect.minY + centerY - metrics.perforationRadius,
            width: metrics.perforationRadius * 2,
            height: metrics.perforationRadius * 2
        )
        let rightRect = CGRect(
            x: rect.maxX + metrics.perforationOffset - metrics.perforationRadius,
            y: rect.minY + centerY - metrics.perforationRadius,
            width: metrics.perforationRadius * 2,
            height: metrics.perforationRadius * 2
        )

        path.addEllipse(in: leftRect)
        path.addEllipse(in: rightRect)
    }

    return path
}

private func createWidgetStampBezierPath(in rect: CGRect, metrics: LocketWidgetStampMetrics) -> UIBezierPath {
    let path = UIBezierPath(roundedRect: rect, cornerRadius: metrics.borderRadius)

    for centerX in buildWidgetStampPerforationCenters(length: rect.width, radius: metrics.perforationRadius) {
        let topRect = CGRect(
            x: rect.minX + centerX - metrics.perforationRadius,
            y: rect.minY - metrics.perforationOffset - metrics.perforationRadius,
            width: metrics.perforationRadius * 2,
            height: metrics.perforationRadius * 2
        )
        let bottomRect = CGRect(
            x: rect.minX + centerX - metrics.perforationRadius,
            y: rect.maxY + metrics.perforationOffset - metrics.perforationRadius,
            width: metrics.perforationRadius * 2,
            height: metrics.perforationRadius * 2
        )

        path.append(UIBezierPath(ovalIn: topRect))
        path.append(UIBezierPath(ovalIn: bottomRect))
    }

    for centerY in buildWidgetStampPerforationCenters(length: rect.height, radius: metrics.perforationRadius) {
        let leftRect = CGRect(
            x: rect.minX - metrics.perforationOffset - metrics.perforationRadius,
            y: rect.minY + centerY - metrics.perforationRadius,
            width: metrics.perforationRadius * 2,
            height: metrics.perforationRadius * 2
        )
        let rightRect = CGRect(
            x: rect.maxX + metrics.perforationOffset - metrics.perforationRadius,
            y: rect.minY + centerY - metrics.perforationRadius,
            width: metrics.perforationRadius * 2,
            height: metrics.perforationRadius * 2
        )

        path.append(UIBezierPath(ovalIn: leftRect))
        path.append(UIBezierPath(ovalIn: rightRect))
    }

    path.usesEvenOddFillRule = true
    return path
}

private func getAspectFillRect(sourceSize: CGSize, destinationSize: CGSize) -> CGRect {
    let sourceWidth = max(sourceSize.width, 1)
    let sourceHeight = max(sourceSize.height, 1)
    let scale = max(destinationSize.width / sourceWidth, destinationSize.height / sourceHeight)
    let scaledWidth = sourceWidth * scale
    let scaledHeight = sourceHeight * scale

    return CGRect(
        x: (destinationSize.width - scaledWidth) / 2,
        y: (destinationSize.height - scaledHeight) / 2,
        width: scaledWidth,
        height: scaledHeight
    )
}

private func renderWidgetStampImage(_ image: UIImage, width: CGFloat, height: CGFloat, opacity: Double) -> UIImage? {
    guard width > 0, height > 0 else {
        return nil
    }

    let metrics = getWidgetStampMetrics(width: width, height: height)
    let stampRect = CGRect(origin: .zero, size: CGSize(width: metrics.outerWidth, height: metrics.outerHeight))
    let stampPath = createWidgetStampBezierPath(in: stampRect, metrics: metrics)
    let normalizedOpacity = min(max(opacity, 0), 1)
    let outlineWidth = max(2.6, metrics.perforationRadius * 0.72)
    let borderWidth = max(1, metrics.perforationRadius * 0.18)
    let drawRect = getAspectFillRect(sourceSize: image.size, destinationSize: stampRect.size)
    let format = UIGraphicsImageRendererFormat.default()
    format.opaque = false
    format.scale = 0

    return UIGraphicsImageRenderer(size: stampRect.size, format: format).image { _ in
        let cgContext = UIGraphicsGetCurrentContext()
        let outlineColor = UIColor(
            red: 1,
            green: 250.0 / 255.0,
            blue: 240.0 / 255.0,
            alpha: locketWidgetStampOutlineOpacity * normalizedOpacity
        )
        let borderColor = UIColor(
            red: 143.0 / 255.0,
            green: 112.0 / 255.0,
            blue: 72.0 / 255.0,
            alpha: 0.1 * normalizedOpacity
        )

        cgContext?.saveGState()
        cgContext?.clip(to: stampRect)
        cgContext?.addPath(stampPath.cgPath)
        cgContext?.eoClip()
        cgContext?.setAlpha(normalizedOpacity)
        image.draw(in: drawRect)
        cgContext?.restoreGState()

        cgContext?.saveGState()
        cgContext?.clip(to: stampRect)
        cgContext?.addPath(stampPath.cgPath)
        cgContext?.eoClip()
        cgContext?.addPath(stampPath.cgPath)
        cgContext?.setStrokeColor(outlineColor.cgColor)
        cgContext?.setLineWidth(outlineWidth)
        cgContext?.setLineJoin(.round)
        cgContext?.setLineCap(.round)
        cgContext?.strokePath()
        cgContext?.restoreGState()

        cgContext?.saveGState()
        cgContext?.clip(to: stampRect)
        cgContext?.addPath(stampPath.cgPath)
        cgContext?.eoClip()
        cgContext?.addPath(stampPath.cgPath)
        cgContext?.setStrokeColor(borderColor.cgColor)
        cgContext?.setLineWidth(borderWidth)
        cgContext?.setLineJoin(.round)
        cgContext?.setLineCap(.round)
        cgContext?.strokePath()
        cgContext?.restoreGState()
    }
}

private struct LocketWidgetStampStickerView: View {
    let image: UIImage
    let width: CGFloat
    let height: CGFloat
    let opacity: Double

    var body: some View {
        if let renderedStamp = renderWidgetStampImage(image, width: width, height: height, opacity: opacity) {
            Image(uiImage: renderedStamp)
                .resizable()
                .interpolation(.none)
                .frame(width: width, height: height)
        } else {
            Image(uiImage: image)
                .resizable()
                .interpolation(.none)
                .scaledToFit()
                .frame(width: width, height: height)
                .opacity(opacity)
        }
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
private let locketWidgetDoodleOverlayOpacity: Double = 1
private let locketWidgetStickerOverlayOpacity: Double = 1
private let locketWidgetStickerOutlineOpacity: Double = 1
private let locketWidgetStampOutlineOpacity: Double = 1
private let locketWidgetDecorationInset: CGFloat = 6
private let locketWidgetStickerMinimumBaseSize: CGFloat = 68
private let locketWidgetStickerBaseSizeRatio: CGFloat = 0.30

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
        artboardInset: CGFloat = locketWidgetDecorationInset,
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
                        let isStamp = placement.renderMode == "stamp"

                        ZStack {
                            if !isStamp && placement.outlineEnabled {
                                ForEach(Array(locketWidgetStickerOutlineOffsets.enumerated()), id: \.offset) { _, offset in
                                    Image(uiImage: outlineImage)
                                        .resizable()
                                        .renderingMode(.template)
                                        .interpolation(.none)
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

                            if isStamp {
                                LocketWidgetStampStickerView(
                                    image: renderedImage,
                                    width: stickerWidth,
                                    height: stickerHeight,
                                    opacity: placement.opacity * overlayOpacity
                                )
                            } else {
                                Image(uiImage: renderedImage)
                                    .resizable()
                                    .interpolation(.none)
                                    .scaledToFit()
                                    .frame(width: stickerWidth, height: stickerHeight)
                                    .opacity(placement.opacity * overlayOpacity)
                            }
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

private func normalizeWidgetImageOrientation(_ image: UIImage) -> UIImage {
    guard image.imageOrientation != .up else {
        return image
    }

    let format = UIGraphicsImageRendererFormat.default()
    format.scale = image.scale
    let renderer = UIGraphicsImageRenderer(size: image.size, format: format)
    return renderer.image { _ in
        image.draw(in: CGRect(origin: .zero, size: image.size))
    }
}

private func loadWidgetImageFromPath(_ path: String) -> UIImage? {
    let normalizedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedPath.isEmpty else {
        return nil
    }

    if normalizedPath.hasPrefix("file://"), let url = URL(string: normalizedPath) {
        if let image = UIImage(contentsOfFile: url.path) {
            return normalizeWidgetImageOrientation(image)
        }
        return nil
    }

    if let image = UIImage(contentsOfFile: normalizedPath) {
        return normalizeWidgetImageOrientation(image)
    }

    return nil
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
        locketWidgetDoodleOverlayOpacity
    }

    private var noteStickerOverlayOpacity: Double {
        locketWidgetStickerOverlayOpacity
    }

    private var hasVisualOnlyTextContent: Bool {
        payload.noteType == "text" &&
        payload.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        (shouldShowStickerOverlay || shouldShowDoodleOverlay)
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
        outerSurfaceColor
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
        framedMemoryCard(
            widgetPadding: 0,
            contentPadding: 12,
            isExpanded: false
        )
    }

    private var mediumLayout: some View {
        framedMemoryCard(
            widgetPadding: 0,
            contentPadding: 18,
            isExpanded: true
        )
    }

    private var largeLayout: some View {
        framedMemoryCard(
            widgetPadding: 0,
            contentPadding: 22,
            isExpanded: true
        )
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

    private var shouldShowCountBadge: Bool {
        payload.isIdleState && payload.noteCount > 0
    }

    private var primaryTextColor: Color {
        if hasPhotoBackground || payload.isIdleState {
            return Color(red: 1.0, green: 0.969, blue: 0.910) // #FFF7E8 — app dark text token
        }
        return Color(red: 0.169, green: 0.149, blue: 0.129)   // #2B2621 — app light text token
    }

    private var eyebrowTextColor: Color {
        hasPhotoBackground
            ? Color(red: 1.0, green: 0.969, blue: 0.910).opacity(0.84) // #FFF7E8 84%
            : Color(red: 0.478, green: 0.416, blue: 0.345)             // #7A6A58 — app secondary
    }

    private var floatingLocationChipBackgroundColor: Color {
        hasPhotoBackground
            ? Color.black.opacity(0.50)
            : Color(red: 0.929, green: 0.910, blue: 0.867).opacity(0.94) // warm ivory pill
    }

    private var badgeBackgroundColor: Color {
        if payload.isIdleState {
            return Color(red: 0.27, green: 0.20, blue: 0.15).opacity(0.58)
        }
        return hasPhotoBackground
            ? Color.black.opacity(0.50)
            : Color(red: 0.929, green: 0.910, blue: 0.867).opacity(0.94)
    }

    private var badgeForegroundColor: Color {
        if payload.isIdleState {
            return Color(red: 1.0, green: 0.969, blue: 0.910)
        }
        return hasPhotoBackground
            ? Color(red: 1.0, green: 0.969, blue: 0.910)
            : Color(red: 0.478, green: 0.416, blue: 0.345)
    }

    private var countBadge: some View {
        Text(countLabel)
            .font(.custom("Noto Sans SemiBold", size: isLarge ? 11 : 10))
            .foregroundStyle(badgeForegroundColor)
            .padding(.horizontal, isLarge ? 12 : 11)
            .padding(.vertical, isLarge ? 7 : 6)
            .background(badgeBackgroundColor)
            .clipShape(Capsule())
            .shadow(color: Color.black.opacity(hasPhotoBackground ? 0.16 : 0.08), radius: 10, x: 0, y: 4)
    }

    private var floatingLocationChip: some View {
        HStack(spacing: 5) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(eyebrowTextColor)

            Text(compactLocationName)
                .font(.custom("Noto Sans Medium", size: 10))
                .foregroundStyle(eyebrowTextColor)
                .lineLimit(1)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        .background(floatingLocationChipBackgroundColor)
        .clipShape(Capsule())
        .shadow(color: Color.black.opacity(hasPhotoBackground ? 0.18 : 0.08), radius: 10, x: 0, y: 4)
    }

    private var authorChipBackgroundColor: Color {
        hasPhotoBackground
            ? Color.black.opacity(0.50)
            : Color(red: 0.929, green: 0.910, blue: 0.867).opacity(0.94)
    }

    private var authorChipForegroundColor: Color {
        hasPhotoBackground
            ? Color(red: 1.0, green: 0.969, blue: 0.910)    // #FFF7E8
            : Color(red: 0.169, green: 0.149, blue: 0.129)  // #2B2621
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
                    .font(.custom("Noto Sans Bold", size: 9))
                    .foregroundStyle(authorChipForegroundColor)
                    .frame(width: 18, height: 18)
                    .background(authorChipForegroundColor.opacity(hasPhotoBackground ? 0.16 : 0.10))
                    .clipShape(Circle())
            }

            if !compactAuthorName.isEmpty {
                Text(compactAuthorName)
                    .font(.custom("Noto Sans Medium", size: 10))
                    .foregroundStyle(authorChipForegroundColor)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(authorChipBackgroundColor)
        .clipShape(Capsule())
        .shadow(color: Color.black.opacity(hasPhotoBackground ? 0.18 : 0.08), radius: 10, x: 0, y: 4)
    }

    private var livePhotoBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: "livephoto")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(authorChipForegroundColor)

            if isLarge || isMedium {
                Text(payload.livePhotoBadgeText.isEmpty ? widgetLocalized("widget.livePhotoBadge", fallback: "Live") : payload.livePhotoBadgeText)
                    .font(.custom("Noto Sans SemiBold", size: 10))
                    .foregroundStyle(authorChipForegroundColor)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(authorChipBackgroundColor)
        .clipShape(Capsule())
        .shadow(color: Color.black.opacity(0.18), radius: 10, x: 0, y: 4)
    }

    @ViewBuilder
    private var outerSurfaceColor: some View {
        Color.clear
    }

    private var paperSurfaceColor: Color {
        Color(red: 0.985, green: 0.972, blue: 0.944)
    }

    private var textTintOverlayColor: Color {
        if let start = payload.backgroundGradientStartColor, !start.isEmpty {
            return colorFromHex(start).opacity(0.13)
        }

        return Color.clear
    }

    private var photoCaptionText: String {
        guard !payload.isIdleState, payload.noteType == "photo", hasPhotoBackground else {
            return ""
        }

        return payload.text
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var compactPhotoCaptionText: String {
        guard !photoCaptionText.isEmpty else {
            return ""
        }

        let limit = isLarge ? 62 : 36
        if photoCaptionText.count <= limit {
            return photoCaptionText
        }

        let endIndex = photoCaptionText.index(photoCaptionText.startIndex, offsetBy: limit - 1)
        return "\(photoCaptionText[..<endIndex])…"
    }

    private var shouldShowTopLocationChip: Bool {
        !payload.isIdleState && !shouldShowAuthorChip && !compactLocationName.isEmpty
    }

    private var shouldShowBottomMetaChip: Bool {
        !payload.isIdleState && shouldShowAuthorChip
    }

    private var textBodyLineLimit: Int {
        if shouldShowTopLocationChip {
            return isLarge ? 4 : 3
        }

        return isLarge ? 5 : 4
    }

    private var textHeaderClearance: CGFloat {
        guard shouldShowTopLocationChip, !hasPhotoBackground else {
            return 0
        }

        if isLarge {
            return 24
        }

        return isMedium ? 18 : 14
    }

    @ViewBuilder
    private var bottomMetaChip: some View {
        if shouldShowAuthorChip {
            authorChip
        }
    }

    private var photoTitleFont: Font {
        if isLarge {
            return .custom("Noto Sans ExtraBold", size: 28)
        }
        if isMedium {
            return .custom("Noto Sans ExtraBold", size: 22)
        }
        return .custom("Noto Sans ExtraBold", size: compactPhotoCaptionText.count > 28 ? 18 : 20)
    }

    @ViewBuilder
    private var photoTitleContent: some View {
        if !compactPhotoCaptionText.isEmpty {
            Text(compactPhotoCaptionText)
                .font(photoTitleFont)
                .foregroundStyle(Color(red: 1.0, green: 0.969, blue: 0.910))
                .multilineTextAlignment(.leading)
                .lineLimit(isLarge ? 3 : 2)
                .lineSpacing(isLarge ? 2 : 1)
                .tracking(-0.45)
                .shadow(color: Color.black.opacity(0.30), radius: 10, x: 0, y: 2)
        }
    }

    @ViewBuilder
    private var framedTextContent: some View {
        if !contentDisplayText.isEmpty {
            Text(contentDisplayText)
                .font(payload.isIdleState ? noteCardIdleFont : noteCardBodyFont)
                .foregroundStyle(primaryTextColor)
                .multilineTextAlignment(isLarge ? .leading : .center)
                .lineLimit(textBodyLineLimit)
                .lineSpacing(noteCardLineSpacing)
                .tracking(noteCardTracking)
                .shadow(
                    color: (hasPhotoBackground || payload.isIdleState) ? Color.black.opacity(0.20) : .clear,
                    radius: (hasPhotoBackground || payload.isIdleState) ? 6 : 0,
                    x: 0,
                    y: (hasPhotoBackground || payload.isIdleState) ? 1 : 0
                )
                .frame(maxWidth: .infinity, alignment: isLarge ? .leading : .center)
        }
    }

    private var noteCardBodyFont: Font {
        let baseSize: CGFloat

        if isLarge {
            let count = contentDisplayText.trimmingCharacters(in: .whitespacesAndNewlines).count
            if count > 160 {
                baseSize = 18
            } else if count > 96 {
                baseSize = 20
            } else {
                baseSize = 24
            }
        } else if isMedium {
            let count = contentDisplayText.trimmingCharacters(in: .whitespacesAndNewlines).count
            baseSize = count > 110 ? 18 : 20
        } else {
            let count = contentDisplayText.trimmingCharacters(in: .whitespacesAndNewlines).count
            baseSize = count > 110 ? 16 : 18
        }

        return .custom("Noto Sans ExtraBold", size: baseSize)
    }

    private var noteCardLineSpacing: CGFloat {
        if isLarge {
            return 2
        }

        return 1
    }

    private var noteCardTracking: CGFloat {
        -0.35
    }

    private var noteCardIdleFont: Font {
        let baseSize: CGFloat = isLarge ? 20 : (isMedium ? 17 : 15)
        return .custom("Noto Sans Medium", size: baseSize).italic()
    }

    @ViewBuilder
    private var cardInnerBackground: some View {
        if let image = resolvedImage, hasPhotoBackground {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .scaleEffect(1.01)
                .clipped()
                .overlay(
                    LinearGradient(
                        colors: [
                            Color.black.opacity(0.00),
                            Color.black.opacity(0.12),
                            Color.black.opacity(0.62),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
        } else if payload.isIdleState {
            LinearGradient(
                colors: [
                    Color(red: 0.110, green: 0.100, blue: 0.118),
                    Color(red: 0.071, green: 0.063, blue: 0.078),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .overlay(
                RadialGradient(
                    colors: [
                        Color(red: 0.878, green: 0.694, blue: 0.357).opacity(0.18),
                        Color.clear
                    ],
                    center: .init(x: 0.5, y: 0.42),
                    startRadius: 0,
                    endRadius: 96
                )
            )
        } else {
            LinearGradient(
                colors: [
                    Color(red: 1.0, green: 0.992, blue: 0.974),
                    paperSurfaceColor
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .overlay(textTintOverlayColor)
        }
    }

    private func framedMemoryCard(
        widgetPadding: CGFloat,
        contentPadding: CGFloat,
        isExpanded: Bool
    ) -> some View {
        let cornerRadius: CGFloat = isExpanded ? 30 : 26
        let cardShape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        ZStack(alignment: .bottomLeading) {
            cardInnerBackground

            if shouldShowStickerOverlay {
                LocketWidgetStickerOverlay(
                    placements: stickerPlacements,
                    overlayOpacity: noteStickerOverlayOpacity,
                    artboardInset: locketWidgetDecorationInset,
                    minimumBaseSize: locketWidgetStickerMinimumBaseSize,
                    baseSizeRatio: locketWidgetStickerBaseSizeRatio
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            if shouldShowDoodleOverlay {
                LocketWidgetDoodleOverlay(
                    strokes: doodleStrokes,
                    isLarge: isExpanded,
                    overlayOpacity: noteOverlayOpacity,
                    contentInset: locketWidgetDecorationInset
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .allowsHitTesting(false)
            }

            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    HStack(alignment: .top) {
                        Spacer(minLength: 0)

                        if shouldShowLivePhotoBadge {
                            livePhotoBadge
                        } else if shouldShowCountBadge {
                            countBadge
                        }
                    }

                    if shouldShowTopLocationChip {
                        floatingLocationChip
                    }
                }

                Spacer(minLength: textHeaderClearance)

                if !hasPhotoBackground {
                    framedTextContent
                }

                Spacer(minLength: hasPhotoBackground ? 0 : 10)

                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: hasPhotoBackground && shouldShowBottomMetaChip && !compactPhotoCaptionText.isEmpty ? 10 : 0) {
                        if hasPhotoBackground {
                            photoTitleContent
                        }

                        if shouldShowBottomMetaChip {
                            bottomMetaChip
                        }
                    }

                    Spacer(minLength: 0)
                }
            }
            .padding(contentPadding)
        }
        .clipShape(cardShape)
        .padding(widgetPadding)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func loadImage(fromPath path: String) -> UIImage? {
        let normalizedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedPath.isEmpty else {
            return nil
        }

        if normalizedPath.hasPrefix("file://"), let url = URL(string: normalizedPath) {
            if let image = UIImage(contentsOfFile: url.path) {
                return normalizeWidgetImageOrientation(image)
            }
            return nil
        }

        if let image = UIImage(contentsOfFile: normalizedPath) {
            return normalizeWidgetImageOrientation(image)
        }

        return nil
    }

    private func loadImage(fromBase64 base64: String) -> UIImage? {
        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
            return nil
        }

        if let image = UIImage(data: data) {
            return normalizeWidgetImageOrientation(image)
        }

        return nil
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
