require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'NotoSubjectCutout'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = package['license'] || 'Proprietary'
  s.author = package['author'] || 'OpenAI'
  s.homepage = package['homepage'] || 'https://example.com/noto-subject-cutout'
  s.platforms = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source = { :git => 'https://example.com/noto-subject-cutout.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = ['Vision', 'CoreImage', 'UIKit']

  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
