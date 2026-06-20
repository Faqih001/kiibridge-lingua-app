import PostHog from "posthog-react-native";
import Constants from "expo-constants";

const apiKey = Constants.expoConfig?.extra?.posthogProjectToken as
  | string
  | undefined;
const rawHost = Constants.expoConfig?.extra?.posthogHost as string | undefined;

// Reject placeholder values that ship in documentation templates
const PLACEHOLDER_HOSTS = ["your-posthog-host", "https://your-posthog-host"];
const host =
  rawHost && !PLACEHOLDER_HOSTS.some((p) => rawHost.includes(p))
    ? rawHost
    : undefined;

const isPostHogConfigured =
  !!apiKey && apiKey !== "phc_your_project_token_here";

// posthog-react-native is not SSR-safe; disable during server-side rendering
const isSSR = typeof window === "undefined";

if (__DEV__) {
  console.log("PostHog config:", {
    apiKey: apiKey ? "SET" : "NOT SET",
    host: host ? "SET" : "NOT SET",
    isConfigured: isPostHogConfigured,
    isSSR,
  });
}

if (!isPostHogConfigured) {
  console.warn(
    "PostHog project token not configured. Analytics will be disabled. " +
      "Set POSTHOG_PROJECT_TOKEN in your .env file to enable analytics."
  );
}

export const posthog = new PostHog(apiKey || "placeholder_key", {
  host,
  disabled: !isPostHogConfigured || isSSR,
  captureAppLifecycleEvents: true,
  debug: __DEV__,
  flushAt: 20,
  flushInterval: 10000,
  maxBatchSize: 100,
  maxQueueSize: 1000,
  preloadFeatureFlags: true,
  sendFeatureFlagEvent: true,
  featureFlagsRequestTimeoutMs: 10000,
  requestTimeout: 10000,
  fetchRetryCount: 3,
  fetchRetryDelay: 3000,
});
