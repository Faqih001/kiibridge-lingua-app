import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { colors } from "@/constants/theme";
import { LANGUAGES } from "@/data/languages";
import { posthog } from "@/lib/posthog";
import { useLanguageStore } from "@/store/languageStore";

// Stream Video SDK — only used on native (stubbed for web by metro)
import {
  Call,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  useCallStateHooks,
} from "@stream-io/video-react-native-sdk";

type SessionState = "idle" | "connecting" | "active" | "error";

const API_BASE =
  Platform.OS === "web"
    ? ""
    : `http://${Constants.expoConfig?.hostUri ?? "localhost:8081"}`;

// ─── Web placeholder ──────────────────────────────────────────────────────────
function WebNotAvailable() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.neutral.background }}>
      <View style={styles.center}>
        <Text style={styles.webIcon}>🎙️</Text>
        <Text style={styles.webTitle}>Voice sessions on mobile</Text>
        <Text style={styles.webSub}>
          AI voice lessons are available in the iOS and Android app. Open this
          app on your phone to get started.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Mic controls (must live inside <StreamCall>) ─────────────────────────────
function MicButton() {
  const { useMicrophoneState } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();

  return (
    <TouchableOpacity
      style={[styles.micBtn, isMute && styles.micBtnMuted]}
      onPress={() => microphone.toggle()}
      activeOpacity={0.8}
    >
      <Ionicons
        name={isMute ? "mic-off" : "mic"}
        size={26}
        color={isMute ? colors.semantic.error : "#fff"}
      />
    </TouchableOpacity>
  );
}

// ─── Active session UI (inside <StreamVideo> + <StreamCall>) ─────────────────
function ActiveSession({
  langName,
  onEnd,
}: {
  langName: string;
  onEnd: () => void;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 700 }),
        withTiming(1, { duration: 700 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.activeContainer}>
      {/* Pulsing ring */}
      <View style={styles.pulseWrapper}>
        <Animated.View style={[styles.pulseRing, pulseStyle]} />
        <View style={styles.pulseInner}>
          <Ionicons name="mic" size={40} color="#fff" />
        </View>
      </View>

      <Text style={styles.activeTitle}>AI Lesson in Progress</Text>
      <Text style={styles.activeSub}>
        Your {langName} AI teacher is listening…
      </Text>

      {/* Controls */}
      <View style={styles.controls}>
        <MicButton />
        <TouchableOpacity
          style={styles.endBtn}
          onPress={onEnd}
          activeOpacity={0.85}
        >
          <Ionicons name="call" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.controlsHint}>
        Tap the mic to mute · Red button to end
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AITeacherScreen() {
  if (Platform.OS === "web") return <WebNotAvailable />;
  return <AITeacherNative />;
}

function AITeacherNative() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { selectedLanguage } = useLanguageStore();
  const language = LANGUAGES.find((l) => l.code === selectedLanguage);
  const langName = language?.name ?? "your target language";

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  // Refs for safe async cleanup
  const clientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<Call | null>(null);
  const callIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    posthog.capture("ai_teacher_viewed");
    return () => {
      cleanup().catch(console.error);
    };
  }, []);

  const cleanup = async () => {
    if (sessionIdRef.current && callIdRef.current) {
      await fetch(
        `${API_BASE}/api/agent-session?callId=${encodeURIComponent(callIdRef.current)}&sessionId=${encodeURIComponent(sessionIdRef.current)}`,
        { method: "DELETE" }
      ).catch(() => {});
    }
    if (callRef.current) {
      await callRef.current.leave().catch(() => {});
      callRef.current = null;
    }
    if (clientRef.current) {
      await clientRef.current.disconnectUser().catch(() => {});
      clientRef.current = null;
    }
    callIdRef.current = null;
    sessionIdRef.current = null;
  };

  const handleStart = async () => {
    if (!user) return;
    setError(null);
    setSessionState("connecting");
    posthog.capture("ai_teacher_session_started");

    try {
      // 1. Get Clerk → Stream token
      const clerkToken = await getToken();
      const tokenRes = await fetch(`${API_BASE}/api/stream-token`, {
        headers: { Authorization: `Bearer ${clerkToken}` },
      });
      if (!tokenRes.ok) throw new Error("Failed to get session token");
      const { token, apiKey } = (await tokenRes.json()) as {
        token: string;
        apiKey: string;
      };

      // 2. Create Stream Video client
      const videoClient = new StreamVideoClient({
        apiKey,
        user: {
          id: user.id,
          name: user.firstName ?? "Learner",
          image: user.imageUrl ?? undefined,
        },
        token,
      });
      clientRef.current = videoClient;

      // 3. Create + join call
      const callId = `ai-teacher-${user.id}-${Date.now()}`;
      callIdRef.current = callId;
      const videoCall = videoClient.call("default", callId);
      await videoCall.getOrCreate();
      await videoCall.join({ create: true });
      await videoCall.microphone.enable();
      await videoCall.camera.disable();
      callRef.current = videoCall;

      // 4. Start the AI agent session
      const agentRes = await fetch(`${API_BASE}/api/agent-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, callType: "default" }),
      });
      if (agentRes.ok) {
        const agentData = (await agentRes.json()) as { session_id?: string };
        sessionIdRef.current = agentData.session_id ?? null;
      }
      // If the agent server isn't running we still continue with the call

      setClient(videoClient);
      setCall(videoCall);
      setSessionState("active");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start session";
      setError(msg);
      setSessionState("error");
      posthog.capture("ai_teacher_session_error", { error: msg });
      await cleanup();
    }
  };

  const handleEnd = async () => {
    posthog.capture("ai_teacher_session_ended");
    setSessionState("idle");
    setClient(null);
    setCall(null);
    await cleanup();
  };

  // Active session — wrap with Stream providers
  if (sessionState === "active" && client && call) {
    return (
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <SafeAreaView
            style={{ flex: 1, backgroundColor: colors.neutral.background }}
          >
            <ActiveSession langName={langName} onEnd={handleEnd} />
          </SafeAreaView>
        </StreamCall>
      </StreamVideo>
    );
  }

  // Idle / connecting / error
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.neutral.background }}>
      <View style={styles.idleContainer}>
        {/* Header */}
        <Text style={styles.screenTitle}>AI Teacher</Text>
        <Text style={styles.screenSub}>
          Practice {langName} with your personal AI tutor
        </Text>

        {/* Mascot */}
        <View style={styles.mascotWrapper}>
          <Image
            source={images.mascotWelcome}
            style={styles.mascot}
            resizeMode="contain"
          />
          {/* Speech bubble */}
          <View style={styles.speechBubble}>
            <Text style={styles.speechText}>
              {language?.nativeName
                ? `Ready to practice ${language.nativeName}? 🎙️`
                : "Ready to start your AI lesson? 🎙️"}
            </Text>
          </View>
        </View>

        {/* Feature bullets */}
        <View style={styles.featureList}>
          {[
            { icon: "mic-outline", text: "Real-time voice conversation" },
            { icon: "school-outline", text: "Personalised to your level" },
            { icon: "checkmark-circle-outline", text: "Instant pronunciation feedback" },
          ].map(({ icon, text }) => (
            <View key={text} style={styles.featureRow}>
              <Ionicons
                name={icon as "mic-outline"}
                size={18}
                color={colors.primary.purple}
              />
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons
              name="warning-outline"
              size={16}
              color={colors.semantic.error}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[
            styles.startBtn,
            sessionState === "connecting" && { opacity: 0.7 },
          ]}
          onPress={handleStart}
          disabled={sessionState === "connecting"}
          activeOpacity={0.85}
        >
          {sessionState === "connecting" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="mic" size={20} color="#fff" />
              <Text style={styles.startBtnText}>
                {sessionState === "error"
                  ? "Try Again"
                  : "Start AI Voice Lesson"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {sessionState === "connecting" && (
          <Text style={styles.connectingHint}>
            Connecting to your AI teacher…
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const PULSE_SIZE = 100;

const styles = StyleSheet.create({
  // Shared
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  // Web unavailable
  webIcon: { fontSize: 56, marginBottom: 16 },
  webTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 20,
    color: colors.neutral.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  webSub: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: colors.neutral.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  // Idle / error
  idleContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },
  screenTitle: {
    fontFamily: "Poppins-Bold",
    fontSize: 28,
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  screenSub: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: colors.neutral.textSecondary,
    marginBottom: 20,
  },
  mascotWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  mascot: { width: "80%", maxWidth: 280, height: 240 },
  speechBubble: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginTop: 12,
  },
  speechText: {
    fontFamily: "Poppins-Medium",
    fontSize: 14,
    color: colors.neutral.textPrimary,
    textAlign: "center",
  },
  // Feature list
  featureList: { gap: 10, marginBottom: 20 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: colors.neutral.textSecondary,
  },
  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF1F1",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: colors.semantic.error,
  },
  // CTA
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.primary.purple,
    borderRadius: 16,
    paddingVertical: 16,
  },
  startBtnText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  connectingHint: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: colors.neutral.textSecondary,
    textAlign: "center",
    marginTop: 10,
  },
  // Active session
  activeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  pulseWrapper: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  pulseRing: {
    position: "absolute",
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    backgroundColor: colors.primary.purple,
    opacity: 0.25,
  },
  pulseInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 22,
    color: colors.neutral.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  activeSub: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: colors.neutral.textSecondary,
    textAlign: "center",
    marginBottom: 40,
  },
  controls: {
    flexDirection: "row",
    gap: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  micBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnMuted: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: colors.semantic.error,
  },
  endBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.semantic.error,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "135deg" }],
  },
  controlsHint: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: colors.neutral.textSecondary,
  },
});
