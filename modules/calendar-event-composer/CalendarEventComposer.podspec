require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'CalendarEventComposer'
  s.version = package['version']
  s.summary = 'Presents the system calendar event editor for House Care.'
  s.description = s.summary
  s.license = 'MIT'
  s.author = 'House Care'
  s.homepage = 'https://github.com/tongzhen/house-care'
  s.platforms = { ios: '16.4' }
  s.source = { git: 'https://github.com/tongzhen/house-care.git' }
  s.static_framework = true
  s.source_files = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
