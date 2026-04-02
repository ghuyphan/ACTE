import AVFoundation
import Foundation
import React

@objc(LivePhotoMotionTranscoder)
final class LivePhotoMotionTranscoder: NSObject {
  private let maxDurationSeconds: Double = 2
  private let preferredPresets = [
    AVAssetExportPreset960x540,
    AVAssetExportPreset640x480,
    AVAssetExportPresetMediumQuality,
  ]

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(normalize:destinationBaseUri:resolver:rejecter:)
  func normalize(
    _ sourceUri: String,
    destinationBaseUri: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      do {
        let sourceURL = try fileURL(from: sourceUri)
        let destinationBaseURL = try fileURL(from: destinationBaseUri)
        let outputURL = try await exportNormalizedAsset(
          from: sourceURL,
          destinationBaseURL: destinationBaseURL
        )

        resolve([
          "uri": outputURL.absoluteString,
        ])
      } catch let error as NSError {
        reject("E_LIVE_PHOTO_NORMALIZE", error.localizedDescription, error)
      } catch {
        reject("E_LIVE_PHOTO_NORMALIZE", error.localizedDescription, error)
      }
    }
  }

  private func fileURL(from value: String) throws -> URL {
    let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedValue.isEmpty else {
      throw NSError(
        domain: "LivePhotoMotionTranscoder",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Received an empty file URI."]
      )
    }

    if let url = URL(string: trimmedValue), url.isFileURL {
      return url
    }

    return URL(fileURLWithPath: trimmedValue)
  }

  private func exportNormalizedAsset(
    from sourceURL: URL,
    destinationBaseURL: URL
  ) async throws -> URL {
    let asset = AVURLAsset(url: sourceURL)
    let compatiblePresets = AVAssetExportSession.exportPresets(compatibleWith: asset)
    guard let preset = preferredPresets.first(where: { compatiblePresets.contains($0) }) else {
      throw NSError(
        domain: "LivePhotoMotionTranscoder",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "No compatible export preset is available."]
      )
    }

    guard let exportSession = AVAssetExportSession(asset: asset, presetName: preset) else {
      throw NSError(
        domain: "LivePhotoMotionTranscoder",
        code: 3,
        userInfo: [NSLocalizedDescriptionKey: "Could not create an AVAssetExportSession."]
      )
    }

    let outputFileType: AVFileType
    let pathExtension: String
    if exportSession.supportedFileTypes.contains(.mp4) {
      outputFileType = .mp4
      pathExtension = "mp4"
    } else if exportSession.supportedFileTypes.contains(.mov) {
      outputFileType = .mov
      pathExtension = "mov"
    } else {
      throw NSError(
        domain: "LivePhotoMotionTranscoder",
        code: 4,
        userInfo: [NSLocalizedDescriptionKey: "No supported output file type is available."]
      )
    }

    let outputURL = destinationBaseURL.deletingPathExtension().appendingPathExtension(pathExtension)
    try? FileManager.default.removeItem(at: outputURL)

    exportSession.outputURL = outputURL
    exportSession.outputFileType = outputFileType
    exportSession.shouldOptimizeForNetworkUse = true

    let maxDuration = CMTime(seconds: maxDurationSeconds, preferredTimescale: 600)
    let duration = asset.duration
    if duration.isNumeric && duration.seconds.isFinite && duration > maxDuration {
      exportSession.timeRange = CMTimeRange(start: .zero, duration: maxDuration)
    }

    try await withCheckedThrowingContinuation { continuation in
      exportSession.exportAsynchronously {
        switch exportSession.status {
        case .completed:
          continuation.resume(returning: ())
        case .failed:
          continuation.resume(
            throwing: exportSession.error
              ?? NSError(
                domain: "LivePhotoMotionTranscoder",
                code: 5,
                userInfo: [NSLocalizedDescriptionKey: "Live photo motion export failed."]
              )
          )
        case .cancelled:
          continuation.resume(
            throwing: NSError(
              domain: "LivePhotoMotionTranscoder",
              code: 6,
              userInfo: [NSLocalizedDescriptionKey: "Live photo motion export was cancelled."]
            )
          )
        default:
          continuation.resume(
            throwing: NSError(
              domain: "LivePhotoMotionTranscoder",
              code: 7,
              userInfo: [
                NSLocalizedDescriptionKey: "Live photo motion export finished in an unexpected state."
              ]
            )
          )
        }
      }
    }

    return outputURL
  }
}
