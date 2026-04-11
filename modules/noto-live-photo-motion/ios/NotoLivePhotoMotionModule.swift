import AVFoundation
import CoreVideo
import ExpoModulesCore

public final class NotoLivePhotoMotionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NotoLivePhotoMotion")

    AsyncFunction("normalizeAsync") { (
      sourceUri: String,
      destinationBasePath: String,
      maxDurationSeconds: Double,
      maxDimension: Double,
      targetBitrate: Double
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

      try await transcodeMotionClip(
        sourceVideoTrack: sourceVideoTrack,
        destinationUrl: destinationUrl,
        trimmedDuration: trimmedDuration,
        sourceTransform: sourceTransform,
        sourceSize: sourceSize,
        maxDimension: CGFloat(max(1, maxDimension)),
        targetBitrate: max(1, targetBitrate)
      )

      let outputAttributes = try FileManager.default.attributesOfItem(atPath: destinationUrl.path)
      let fileSize = (outputAttributes[.size] as? NSNumber)?.doubleValue ?? 0

      return [
        "uri": destinationUrl.absoluteString,
        "size": fileSize
      ]
    }
  }

  private func transcodeMotionClip(
    sourceVideoTrack: AVAssetTrack,
    destinationUrl: URL,
    trimmedDuration: CMTime,
    sourceTransform: CGAffineTransform,
    sourceSize: CGSize,
    maxDimension: CGFloat,
    targetBitrate: Double
  ) async throws {
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
      maxDimension: maxDimension
    )

    let reader = try AVAssetReader(asset: composition)
    let videoOutput = AVAssetReaderVideoCompositionOutput(
      videoTracks: [compositionTrack],
      videoSettings: [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)
      ]
    )
    videoOutput.alwaysCopiesSampleData = false
    videoOutput.videoComposition = videoComposition

    guard reader.canAdd(videoOutput) else {
      throw LivePhotoMotionExportException("Unable to read motion export frames.")
    }
    reader.add(videoOutput)

    let writer = try AVAssetWriter(outputURL: destinationUrl, fileType: .mp4)
    let writerInput = AVAssetWriterInput(
      mediaType: .video,
      outputSettings: makeWriterOutputSettings(
        renderSize: videoComposition.renderSize,
        targetBitrate: targetBitrate
      )
    )
    writerInput.expectsMediaDataInRealTime = false
    writerInput.performsMultiPassEncodingIfSupported = true

    guard writer.canAdd(writerInput) else {
      throw LivePhotoMotionExportException("Unable to configure motion export writer.")
    }
    writer.add(writerInput)

    guard writer.startWriting() else {
      throw writer.error ?? LivePhotoMotionExportException("Unable to start motion export writer.")
    }
    guard reader.startReading() else {
      throw reader.error ?? LivePhotoMotionExportException("Unable to start motion export reader.")
    }

    writer.startSession(atSourceTime: .zero)
    let queue = DispatchQueue(label: "com.acte.app.live-photo-motion-export")
    let completionLock = NSLock()
    var didResume = false

    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      func finish(_ result: Result<Void, Error>) {
        completionLock.lock()
        defer { completionLock.unlock() }

        guard !didResume else {
          return
        }

        didResume = true
        continuation.resume(with: result)
      }

      writerInput.requestMediaDataWhenReady(on: queue) {
        while writerInput.isReadyForMoreMediaData {
          if let sampleBuffer = videoOutput.copyNextSampleBuffer() {
            if !writerInput.append(sampleBuffer) {
              reader.cancelReading()
              writerInput.markAsFinished()
              writer.cancelWriting()
              finish(.failure(writer.error ?? LivePhotoMotionExportException("Motion export failed.")))
              return
            }

            continue
          }

          writerInput.markAsFinished()
          writer.finishWriting {
            if let error = reader.error ?? writer.error {
              finish(.failure(error))
              return
            }

            switch writer.status {
            case .completed:
              finish(.success(()))
            case .failed:
              finish(.failure(writer.error ?? LivePhotoMotionExportException("Motion export failed.")))
            case .cancelled:
              finish(.failure(LivePhotoMotionExportException("Motion export cancelled.")))
            default:
              finish(.failure(LivePhotoMotionExportException("Motion export finished in an unexpected state.")))
            }
          }
          return
        }

        if reader.status == .failed {
          writerInput.markAsFinished()
          writer.cancelWriting()
          finish(.failure(reader.error ?? LivePhotoMotionExportException("Motion export reader failed.")))
        }
      }
    }
  }

  private func makeWriterOutputSettings(
    renderSize: CGSize,
    targetBitrate: Double
  ) -> [String: Any] {
    let normalizedBitrate = max(1, Int(targetBitrate.rounded()))

    return [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: Int(renderSize.width),
      AVVideoHeightKey: Int(renderSize.height),
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: normalizedBitrate,
        AVVideoExpectedSourceFrameRateKey: 30,
        AVVideoMaxKeyFrameIntervalKey: 30,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
      ]
    ]
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
