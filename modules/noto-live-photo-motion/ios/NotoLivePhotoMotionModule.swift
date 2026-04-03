import AVFoundation
import ExpoModulesCore

public final class NotoLivePhotoMotionModule: Module {
  private let presetCandidates = [
    AVAssetExportPreset1280x720,
    AVAssetExportPreset960x540,
    AVAssetExportPreset640x480,
    AVAssetExportPresetMediumQuality
  ]

  public func definition() -> ModuleDefinition {
    Name("NotoLivePhotoMotion")

    AsyncFunction("normalizeAsync") { (
      sourceUri: String,
      destinationBasePath: String,
      maxDurationSeconds: Double,
      maxDimension: Double
    ) async throws -> [String: Any] in
      let sourceUrl = try fileURL(from: sourceUri)
      let destinationBaseUrl = try fileURL(from: destinationBasePath)

      let destinationDirectory = destinationBaseUrl.deletingLastPathComponent()
      try FileManager.default.createDirectory(
        at: destinationDirectory,
        withIntermediateDirectories: true
      )

      let destinationUrl = destinationBaseUrl.appendingPathExtension("mp4")
      if FileManager.default.fileExists(atPath: destinationUrl.path) {
        try FileManager.default.removeItem(at: destinationUrl)
      }

      let asset = AVURLAsset(url: sourceUrl)
      guard let sourceVideoTrack = try await asset.loadTracks(withMediaType: .video).first else {
        throw LivePhotoMotionExportException("Motion clip has no video track.")
      }

      let duration = try await asset.load(.duration)
      let sourceTransform = try await sourceVideoTrack.load(.preferredTransform)
      let sourceSize = try await sourceVideoTrack.load(.naturalSize)
      let trimmedDuration = CMTimeMinimum(
        duration,
        CMTime(seconds: max(0.1, maxDurationSeconds), preferredTimescale: 600)
      )

      let composition = AVMutableComposition()
      guard let compositionTrack = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid
      ) else {
        throw LivePhotoMotionExportException("Unable to create motion export track.")
      }

      try compositionTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: trimmedDuration),
        of: sourceVideoTrack,
        at: .zero
      )
      compositionTrack.preferredTransform = sourceTransform

      let videoComposition = makeVideoComposition(
        for: compositionTrack,
        sourceTransform: sourceTransform,
        sourceSize: sourceSize,
        duration: trimmedDuration,
        maxDimension: CGFloat(max(1, maxDimension))
      )

      guard let exportSession = makeExportSession(for: composition) else {
        throw LivePhotoMotionExportException("Unable to create motion export session.")
      }

      exportSession.outputURL = destinationUrl
      exportSession.outputFileType = .mp4
      exportSession.shouldOptimizeForNetworkUse = true
      exportSession.videoComposition = videoComposition

      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        exportSession.exportAsynchronously {
          switch exportSession.status {
          case .completed:
            continuation.resume(returning: ())
          case .failed:
            continuation.resume(
              throwing: exportSession.error ??
                LivePhotoMotionExportException("Motion export failed.")
            )
          case .cancelled:
            continuation.resume(throwing: LivePhotoMotionExportException("Motion export cancelled."))
          default:
            continuation.resume(
              throwing: LivePhotoMotionExportException("Motion export finished in an unexpected state.")
            )
          }
        }
      }

      let outputAttributes = try FileManager.default.attributesOfItem(atPath: destinationUrl.path)
      let fileSize = (outputAttributes[.size] as? NSNumber)?.doubleValue ?? 0

      return [
        "uri": destinationUrl.absoluteString,
        "size": fileSize
      ]
    }
  }

  private func makeExportSession(for asset: AVAsset) -> AVAssetExportSession? {
    for preset in presetCandidates where AVAssetExportSession.exportPresets(compatibleWith: asset).contains(preset) {
      if let exportSession = AVAssetExportSession(asset: asset, presetName: preset) {
        return exportSession
      }
    }

    return nil
  }

  private func makeVideoComposition(
    for track: AVCompositionTrack,
    sourceTransform: CGAffineTransform,
    sourceSize: CGSize,
    duration: CMTime,
    maxDimension: CGFloat
  ) -> AVMutableVideoComposition {
    let transformedSize = sourceSize.applying(sourceTransform)
    let orientedSize = CGSize(width: abs(transformedSize.width), height: abs(transformedSize.height))
    let scale = min(1, maxDimension / max(orientedSize.width, orientedSize.height))
    let renderSize = CGSize(
      width: max(2, floor(orientedSize.width * scale / 2) * 2),
      height: max(2, floor(orientedSize.height * scale / 2) * 2)
    )

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = renderSize
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: duration)

    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: track)
    let scaleTransform = CGAffineTransform(scaleX: scale, y: scale)
    layerInstruction.setTransform(sourceTransform.concatenating(scaleTransform), at: .zero)
    instruction.layerInstructions = [layerInstruction]
    videoComposition.instructions = [instruction]

    return videoComposition
  }

  private func fileURL(from rawValue: String) throws -> URL {
    guard let url = URL(string: rawValue), url.isFileURL else {
      throw LivePhotoMotionExportException("Expected a file URL, received: \(rawValue)")
    }

    return url
  }
}

internal struct LivePhotoMotionExportException: Error, CustomStringConvertible {
  let message: String

  init(_ message: String) {
    self.message = message
  }

  var description: String {
    return message
  }
}
