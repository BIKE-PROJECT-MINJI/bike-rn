const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withAppBuildGradle,
} = require('expo/config-plugins');

const PLUGIN_NAME = 'with-google-maps-key-guard';
const PLUGIN_VERSION = '1.0.0';
const META_DATA_NAME = 'com.google.android.geo.API_KEY';
const PLACEHOLDER = '${GOOGLE_MAPS_API_KEY}';
const GRADLE_MARKER = '// GAJA_GOOGLE_MAPS_KEY_GUARD';

function addGoogleMapsMetaData(manifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    application,
    META_DATA_NAME,
    PLACEHOLDER,
  );
  return manifest;
}

function addGoogleMapsReleaseGate(source) {
  if (source.includes(GRADLE_MARKER)) {
    return source;
  }
  return `${source.trimEnd()}\n\n${GRADLE_MARKER}
def gajaGoogleMapsApiKey = providers.environmentVariable("GOOGLE_MAPS_ANDROID_API_KEY")
    .orElse(providers.gradleProperty("GOOGLE_MAPS_ANDROID_API_KEY"))
    .getOrElse("")
def gajaGoogleMapsManifestValue = gajaGoogleMapsApiKey.trim().isEmpty()
    ? "debug-only-missing-google-maps-key"
    : gajaGoogleMapsApiKey
android.defaultConfig.manifestPlaceholders["GOOGLE_MAPS_API_KEY"] = gajaGoogleMapsManifestValue
tasks.configureEach { task ->
    def isReleaseManifestTask = task.name.toLowerCase().contains("release") && task.name.endsWith("MainManifest")
    if (isReleaseManifestTask) {
        task.doFirst {
            if (gajaGoogleMapsApiKey.trim().isEmpty()) {
                throw new GradleException("Google Maps Android API key is required for release builds")
            }
        }
    }
}
`;
}

function withGoogleMapsKeyGuard(config) {
  let next = withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = addGoogleMapsMetaData(manifestConfig.modResults);
    return manifestConfig;
  });
  next = withAppBuildGradle(next, (gradleConfig) => {
    gradleConfig.modResults.contents = addGoogleMapsReleaseGate(gradleConfig.modResults.contents);
    return gradleConfig;
  });
  return next;
}

module.exports = createRunOncePlugin(withGoogleMapsKeyGuard, PLUGIN_NAME, PLUGIN_VERSION);
module.exports.addGoogleMapsMetaData = addGoogleMapsMetaData;
module.exports.addGoogleMapsReleaseGate = addGoogleMapsReleaseGate;
