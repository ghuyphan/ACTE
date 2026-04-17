import AVFoundation
import ExpoModulesCore
import UIKit

private final class PhotoCaptureProcessor: NSObject, AVCapturePhotoCaptureDelegate {
  private let onComplete: (Result<Data, Error>) -> Void

  init(onComplete: @escaping (Result<Data, Error>) -> Void) {
    self.onComplete = onComplete
    super.init()
  }

  func photoOutput(
    _ output: AVCapturePhotoOutput,
    didFinishProcessingPhoto photo: AVCapturePhoto,
    error: Error?
  ) {
    if let error {
      onComplete(.failure(error))
      return
    }

    guard let data = photo.fileDataRepresentation() else {
      onComplete(.failure(NotoDualCameraException("capture-failed", "Photo data was unavailable.")))
      return
    }

    onComplete(.success(data))
  }
}

final class NotoDualCameraView: ExpoView {
  let onCaptureError = EventDispatcher()
  let onPreviewReady = EventDispatcher()

  private let session = AVCaptureMultiCamSession()
  private let sessionQueue = DispatchQueue(label: "com.acte.noto.dualcamera.session")
  private var configured = false
  private var active = false
  private var primaryFacing: String = "back"
  private var hasDispatchedPreviewReady = false

  private let insetSizeRatio: CGFloat = 276.0 / 1080.0
  private let insetMarginRatio: CGFloat = 44.0 / 1080.0
  private let insetRadiusRatio: CGFloat = 32.0 / 1080.0

  private var backInput: AVCaptureDeviceInput?
  private var frontInput: AVCaptureDeviceInput?
  private var backPhotoOutput: AVCapturePhotoOutput?
  private var frontPhotoOutput: AVCapturePhotoOutput?
  private var backPreviewLayer: AVCaptureVideoPreviewLayer?
  private var frontPreviewLayer: AVCaptureVideoPreviewLayer?
  private var captureProcessors: [PhotoCaptureProcessor] = []

  override init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    if #available(iOS 13.0, *) {
      layer.cornerCurve = .continuous
    }
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    clipsToBounds = true
    backgroundColor = .black
    if #available(iOS 13.0, *) {
      layer.cornerCurve = .continuous
    }
  }

  deinit {
    sessionQueue.sync {
      if session.isRunning {
        session.stopRunning()
      }
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    layoutPreviewLayers()
  }

  func setActive(_ nextValue: Bool) {
    active = nextValue
    if nextValue {
      startPreview()
    } else {
      stopPreview()
    }
  }

  func setPrimaryFacing(_ nextFacing: String) {
    primaryFacing = nextFacing == "front" ? "front" : "back"
    DispatchQueue.main.async { [weak self] in
      self?.layoutPreviewLayers()
    }
  }

  func startPreview() {
    guard AVCaptureMultiCamSession.isMultiCamSupported else {
      return
    }

    sessionQueue.async { [weak self] in
      guard let self else { return }
      do {
        try self.configureIfNeeded()
        if !self.session.isRunning {
          self.session.startRunning()
        }
        self.dispatchPreviewReadyIfNeeded()
      } catch {
        self.dispatchCaptureError(code: "preview-failed", message: error.localizedDescription)
      }
    }
  }

  func stopPreview() {
    sessionQueue.async { [weak self] in
      guard let self else { return }
      self.hasDispatchedPreviewReady = false
      if self.session.isRunning {
        self.session.stopRunning()
      }
    }
  }

  func captureStill() async throws -> [String: Any] {
    guard AVCaptureMultiCamSession.isMultiCamSupported else {
      throw NotoDualCameraException("platform-unavailable", "Concurrent camera capture is unavailable on this device.")
    }

    try await configureIfNeeded()
    startPreview()

    guard let backPhotoOutput, let frontPhotoOutput else {
      throw NotoDualCameraException("capture-failed", "Dual camera outputs are unavailable.")
    }

    let backData = try await capturePhoto(from: backPhotoOutput)
    let frontData = try await capturePhoto(from: frontPhotoOutput)

    let backUrl = try writePhotoData(backData, suffix: "back")
    let frontUrl = try writePhotoData(frontData, suffix: "front")
    let primaryFacingValue = primaryFacing == "front" ? "front" : "back"
    let primaryUrl = primaryFacingValue == "front" ? frontUrl : backUrl
    let secondaryUrl = primaryFacingValue == "front" ? backUrl : frontUrl

    let imageSize = UIImage(data: primaryFacingValue == "front" ? frontData : backData)?.size

    return [
      "primaryUri": primaryUrl.absoluteString,
      "secondaryUri": secondaryUrl.absoluteString,
      "primaryFacing": primaryFacingValue,
      "secondaryFacing": primaryFacingValue == "front" ? "back" : "front",
      "width": Int(imageSize?.width ?? 0),
      "height": Int(imageSize?.height ?? 0),
    ]
  }

  private func capturePhoto(from output: AVCapturePhotoOutput) async throws -> Data {
    let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
    settings.isHighResolutionPhotoEnabled = false

    return try await withCheckedThrowingContinuation { continuation in
      let processor = PhotoCaptureProcessor { [weak self] result in
        guard let self else { return }
        self.captureProcessors.removeAll { $0 === processor }
        continuation.resume(with: result)
      }
      captureProcessors.append(processor)
      output.capturePhoto(with: settings, delegate: processor)
    }
  }

  private func writePhotoData(_ data: Data, suffix: String) throws -> URL {
    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent("noto-dual-camera", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

    let url = directory.appendingPathComponent("dual-\(suffix)-\(UUID().uuidString).jpg")
    try data.write(to: url, options: .atomic)
    return url
  }

  private func configureIfNeeded() throws {
    if configured {
      return
    }

    guard AVCaptureMultiCamSession.isMultiCamSupported else {
      throw NotoDualCameraException("platform-unavailable", "Concurrent camera capture is unavailable on this device.")
    }

    session.beginConfiguration()
    defer { session.commitConfiguration() }

    let backDevice = try cameraDevice(position: .back)
    let frontDevice = try cameraDevice(position: .front)
    let nextBackInput = try AVCaptureDeviceInput(device: backDevice)
    let nextFrontInput = try AVCaptureDeviceInput(device: frontDevice)

    guard session.canAddInput(nextBackInput), session.canAddInput(nextFrontInput) else {
      throw NotoDualCameraException("configuration-failed", "Unable to add camera inputs.")
    }

    session.addInputWithNoConnections(nextBackInput)
    session.addInputWithNoConnections(nextFrontInput)

    let nextBackPhotoOutput = AVCapturePhotoOutput()
    let nextFrontPhotoOutput = AVCapturePhotoOutput()

    guard session.canAddOutput(nextBackPhotoOutput), session.canAddOutput(nextFrontPhotoOutput) else {
      throw NotoDualCameraException("configuration-failed", "Unable to add camera outputs.")
    }

    session.addOutputWithNoConnections(nextBackPhotoOutput)
    session.addOutputWithNoConnections(nextFrontPhotoOutput)

    let backPreview = AVCaptureVideoPreviewLayer(sessionWithNoConnection: session)
    let frontPreview = AVCaptureVideoPreviewLayer(sessionWithNoConnection: session)
    backPreview.videoGravity = .resizeAspectFill
    frontPreview.videoGravity = .resizeAspectFill
    backPreview.cornerRadius = 0
    frontPreview.cornerRadius = 12
    frontPreview.masksToBounds = true
    if #available(iOS 13.0, *) {
      backPreview.cornerCurve = .continuous
      frontPreview.cornerCurve = .continuous
    }

    let installLayers = {
      self.layer.insertSublayer(backPreview, at: 0)
      self.layer.insertSublayer(frontPreview, above: backPreview)
    }
    if Thread.isMainThread {
      installLayers()
    } else {
      DispatchQueue.main.sync(execute: installLayers)
    }

    try addConnection(from: nextBackInput, to: backPreview, mirrored: false)
    try addConnection(from: nextFrontInput, to: frontPreview, mirrored: true)
    try addConnection(from: nextBackInput, to: nextBackPhotoOutput, mirrored: false)
    try addConnection(from: nextFrontInput, to: nextFrontPhotoOutput, mirrored: true)

    backInput = nextBackInput
    frontInput = nextFrontInput
    backPhotoOutput = nextBackPhotoOutput
    frontPhotoOutput = nextFrontPhotoOutput
    backPreviewLayer = backPreview
    frontPreviewLayer = frontPreview
    configured = true

    DispatchQueue.main.async { [weak self] in
      self?.layoutPreviewLayers()
    }
  }

  private func addConnection(
    from input: AVCaptureDeviceInput,
    to output: AVCaptureOutput,
    mirrored: Bool
  ) throws {
    guard let inputPort = input.ports.first(where: { $0.mediaType == .video }) else {
      throw NotoDualCameraException("configuration-failed", "Video input port was unavailable.")
    }

    let connection = AVCaptureConnection(inputPorts: [inputPort], output: output)
    if connection.isVideoOrientationSupported {
      connection.videoOrientation = .portrait
    }
    if connection.isVideoMirroringSupported {
      connection.isVideoMirrored = mirrored
    }

    guard session.canAddConnection(connection) else {
      throw NotoDualCameraException("configuration-failed", "Unable to add camera output connection.")
    }

    session.addConnection(connection)
  }

  private func addConnection(
    from input: AVCaptureDeviceInput,
    to previewLayer: AVCaptureVideoPreviewLayer,
    mirrored: Bool
  ) throws {
    guard let inputPort = input.ports.first(where: { $0.mediaType == .video }) else {
      throw NotoDualCameraException("configuration-failed", "Video preview port was unavailable.")
    }

    let connection = AVCaptureConnection(inputPort: inputPort, videoPreviewLayer: previewLayer)
    if connection.isVideoOrientationSupported {
      connection.videoOrientation = .portrait
    }
    if connection.isVideoMirroringSupported {
      connection.isVideoMirrored = mirrored
    }

    guard session.canAddConnection(connection) else {
      throw NotoDualCameraException("configuration-failed", "Unable to add preview connection.")
    }

    session.addConnection(connection)
  }

  private func cameraDevice(position: AVCaptureDevice.Position) throws -> AVCaptureDevice {
    if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) {
      return device
    }

    throw NotoDualCameraException("configuration-failed", "Required camera device was unavailable.")
  }

  private func layoutPreviewLayers() {
    guard let backPreviewLayer, let frontPreviewLayer else {
      return
    }

    let bounds = self.bounds
    backPreviewLayer.frame = bounds
    let minSide = min(bounds.width, bounds.height)
    let insetSide = max(84, minSide * insetSizeRatio)
    let insetMargin = max(14, minSide * insetMarginRatio)
    let insetRadius = max(12, minSide * insetRadiusRatio)
    let insetFrame = CGRect(x: insetMargin, y: insetMargin, width: insetSide, height: insetSide)

    if primaryFacing == "front" {
      frontPreviewLayer.frame = bounds
      backPreviewLayer.frame = insetFrame
      layer.bringSublayerToFront(backPreviewLayer)
      frontPreviewLayer.cornerRadius = 0
      frontPreviewLayer.masksToBounds = false
      backPreviewLayer.cornerRadius = insetRadius
      backPreviewLayer.masksToBounds = true
    } else {
      backPreviewLayer.frame = bounds
      frontPreviewLayer.frame = insetFrame
      layer.bringSublayerToFront(frontPreviewLayer)
      backPreviewLayer.cornerRadius = 0
      backPreviewLayer.masksToBounds = false
      frontPreviewLayer.cornerRadius = insetRadius
      frontPreviewLayer.masksToBounds = true
    }
  }

  private func dispatchCaptureError(code: String, message: String) {
    DispatchQueue.main.async { [weak self] in
      self?.onCaptureError([
        "code": code,
        "message": message,
      ])
    }
  }

  private func dispatchPreviewReadyIfNeeded() {
    guard !hasDispatchedPreviewReady else {
      return
    }

    hasDispatchedPreviewReady = true
    DispatchQueue.main.async { [weak self] in
      self?.onPreviewReady()
    }
  }
}

public final class NotoDualCameraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NotoDualCamera")

    AsyncFunction("getAvailabilityAsync") { () -> [String: Any] in
      let supported = AVCaptureMultiCamSession.isMultiCamSupported
      return [
        "available": supported,
        "supported": supported,
        "reason": supported ? NSNull() : "concurrent-camera-unavailable",
      ]
    }

    View(NotoDualCameraView.self) {
      Events("onCaptureError", "onPreviewReady")

      Prop("active", false) { (view: NotoDualCameraView, active: Bool) in
        view.setActive(active)
      }

      Prop("primaryFacing", "back") { (view: NotoDualCameraView, primaryFacing: String) in
        view.setPrimaryFacing(primaryFacing)
      }

      AsyncFunction("startPreview") { (view: NotoDualCameraView) in
        view.startPreview()
      }

      AsyncFunction("stopPreview") { (view: NotoDualCameraView) in
        view.stopPreview()
      }

      AsyncFunction("setPrimaryCamera") { (view: NotoDualCameraView, primaryFacing: String) in
        view.setPrimaryFacing(primaryFacing)
      }

      AsyncFunction("captureStill") { (view: NotoDualCameraView) async throws -> [String: Any] in
        try await view.captureStill()
      }
    }
  }
}

internal final class NotoDualCameraException: Exception {
  private let errorCode: String
  private let errorReason: String

  init(_ code: String, _ reason: String) {
    self.errorCode = code
    self.errorReason = reason
    super.init(name: "NotoDualCameraException", description: reason, code: code)
  }

  override var reason: String {
    errorReason
  }

  override var code: String {
    errorCode
  }
}
