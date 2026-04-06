import CoreImage
import ExpoModulesCore
import UIKit
import Vision

public final class NotoSubjectCutoutModule: Module {
  private let ciContext = CIContext()

  public func definition() -> ModuleDefinition {
    Name("NotoSubjectCutout")

    AsyncFunction("prepareAsync") { () -> [String: Any] in
      let available: Bool
      if #available(iOS 17.0, *) {
        available = true
      } else {
        available = false
      }

      return [
        "available": available
      ]
    }

    AsyncFunction("cutOutAsync") { (
      sourceUri: String,
      destinationBasePath: String
    ) async throws -> [String: Any] in
      guard #available(iOS 17.0, *) else {
        throw SubjectCutoutException("platform-unavailable", "Foreground subject cutout requires iOS 17 or newer.")
      }

      let sourceUrl = try fileURL(from: sourceUri)
      let destinationBaseUrl = try fileURL(from: destinationBasePath)

      guard FileManager.default.fileExists(atPath: sourceUrl.path) else {
        throw SubjectCutoutException("source-unavailable", "The source image is unavailable.")
      }

      let destinationDirectory = destinationBaseUrl.deletingLastPathComponent()
      try FileManager.default.createDirectory(
        at: destinationDirectory,
        withIntermediateDirectories: true,
        attributes: nil
      )

      let destinationUrl = destinationBaseUrl.appendingPathExtension("png")
      if FileManager.default.fileExists(atPath: destinationUrl.path) {
        try FileManager.default.removeItem(at: destinationUrl)
      }

      let request = VNGenerateForegroundInstanceMaskRequest()
      let handler = VNImageRequestHandler(url: sourceUrl)

      do {
        try handler.perform([request])
      } catch {
        throw SubjectCutoutException("processing-failed", "Unable to analyze this image for a foreground subject.")
      }

      guard let observation = request.results?.first as? VNInstanceMaskObservation else {
        throw SubjectCutoutException("no-subject", "No clear foreground subject was found in this image.")
      }

      let instances = observation.allInstances
      guard instances.count > 0 else {
        throw SubjectCutoutException("no-subject", "No clear foreground subject was found in this image.")
      }

      let maskedPixelBuffer: CVPixelBuffer
      do {
        maskedPixelBuffer = try observation.generateMaskedImage(
          ofInstances: instances,
          from: handler,
          croppedToInstancesExtent: true
        )
      } catch {
        throw SubjectCutoutException("processing-failed", "Unable to build a sticker cutout from this image.")
      }

      let outputImage = CIImage(cvPixelBuffer: maskedPixelBuffer)
      let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()

      do {
        try ciContext.writePNGRepresentation(
          of: outputImage,
          to: destinationUrl,
          format: .RGBA8,
          colorSpace: colorSpace
        )
      } catch {
        throw SubjectCutoutException("processing-failed", "Unable to save the sticker cutout.")
      }

      let width = CVPixelBufferGetWidth(maskedPixelBuffer)
      let height = CVPixelBufferGetHeight(maskedPixelBuffer)

      return [
        "uri": destinationUrl.absoluteString,
        "mimeType": "image/png",
        "width": width,
        "height": height
      ]
    }
  }

  private func fileURL(from rawValue: String) throws -> URL {
    guard let url = URL(string: rawValue), url.isFileURL else {
      throw SubjectCutoutException("source-unavailable", "Expected a file URL, received: \(rawValue)")
    }

    return url
  }
}

internal final class SubjectCutoutException: Exception {
  private let errorCode: String
  private let errorReason: String

  init(_ code: String, _ reason: String) {
    self.errorCode = code
    self.errorReason = reason
    super.init(name: "NotoSubjectCutoutException", description: reason, code: code)
  }

  override var reason: String {
    errorReason
  }

  override var code: String {
    errorCode
  }
}
