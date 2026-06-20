const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Stub native-only WebRTC and Stream Video packages on web — they use
// requireNativeComponent which doesn't exist in the browser or SSR.
const WEB_NATIVE_STUBS = new Set([
  "@stream-io/react-native-webrtc",
  "@stream-io/video-react-native-sdk",
]);

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_NATIVE_STUBS.has(moduleName)) {
    return { type: "empty" };
  }
  return upstream
    ? upstream(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativewind(config, { input: "./global.css" });
