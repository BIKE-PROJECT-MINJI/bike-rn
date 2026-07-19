const {
  createRunOncePlugin,
  withAppBuildGradle,
} = require('expo/config-plugins');

const PLUGIN_NAME = 'with-android-release-signing';
const PLUGIN_VERSION = '1.0.0';
const GRADLE_MARKER = '// GAJA_ANDROID_RELEASE_SIGNING';

function addAndroidReleaseSigningGate(source) {
  if (source.includes(GRADLE_MARKER)) {
    return source;
  }
  return `${source.trimEnd()}\n\n${GRADLE_MARKER}
def gajaUploadKeystorePath = providers.environmentVariable("GAJA_ANDROID_UPLOAD_KEYSTORE_PATH").getOrElse("")
def gajaUploadStorePassword = providers.environmentVariable("GAJA_ANDROID_UPLOAD_STORE_PASSWORD").getOrElse("")
def gajaUploadKeyAlias = providers.environmentVariable("GAJA_ANDROID_UPLOAD_KEY_ALIAS").getOrElse("")
def gajaUploadKeyPassword = providers.environmentVariable("GAJA_ANDROID_UPLOAD_KEY_PASSWORD").getOrElse("")
def gajaUploadSigningReady = [
    gajaUploadKeystorePath,
    gajaUploadStorePassword,
    gajaUploadKeyAlias,
    gajaUploadKeyPassword,
].every { !it.trim().isEmpty() }

android {
    signingConfigs {
        gajaRelease {
            if (gajaUploadSigningReady) {
                storeFile file(gajaUploadKeystorePath)
                storePassword gajaUploadStorePassword
                keyAlias gajaUploadKeyAlias
                keyPassword gajaUploadKeyPassword
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.gajaRelease
        }
    }
}

tasks.configureEach { task ->
    def isReleaseSigningTask = task.name.toLowerCase().contains("release") && (
        task.name.toLowerCase().contains("package") ||
        task.name.toLowerCase().contains("bundle") ||
        task.name.toLowerCase().contains("assemble")
    )
    if (isReleaseSigningTask) {
        task.doFirst {
            if (!gajaUploadSigningReady) {
                throw new GradleException("GAJA Android upload signing credentials are required for release builds")
            }
        }
    }
}
`;
}

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    gradleConfig.modResults.contents = addAndroidReleaseSigningGate(
      gradleConfig.modResults.contents,
    );
    return gradleConfig;
  });
}

module.exports = createRunOncePlugin(
  withAndroidReleaseSigning,
  PLUGIN_NAME,
  PLUGIN_VERSION,
);
module.exports.addAndroidReleaseSigningGate = addAndroidReleaseSigningGate;
