require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'NotoDualCamera'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = 'MIT'
  s.author = 'OpenAI'
  s.homepage = 'https://example.invalid/noto-dual-camera'
  s.platforms = {
    :ios => '15.1'
  }
  s.swift_version = '5.9'
  s.source = { git: 'https://example.invalid/noto-dual-camera.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = ['AVFoundation', 'UIKit']

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
