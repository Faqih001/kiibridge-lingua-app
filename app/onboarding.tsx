import { images } from "@/constants/images";
import { posthog } from "@/lib/posthog";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OnboardingScreen() {
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360;
  const isTablet = width >= 768;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Centre content and cap width on wide screens */}
      <View style={styles.outer}>
        <View
          style={[
            styles.inner,
            {
              maxWidth: isTablet ? 600 : undefined,
              paddingHorizontal: isTablet ? 40 : isSmall ? 16 : 24,
            },
          ]}
        >
          {/* Logo header */}
          <View className="flex-row items-center justify-center gap-2 mt-4">
            <Image
              source={images.mascotLogo}
              style={{ width: isTablet ? 52 : 40, height: isTablet ? 52 : 40 }}
            />
            <Text
              style={{
                fontFamily: "Poppins-SemiBold",
                fontSize: isTablet ? 26 : 20,
                color: "#001328",
              }}
            >
              KiiBridge Lingua App
            </Text>
          </View>

          {/* Hero heading */}
          <Text
            style={{
              fontFamily: "Poppins-Bold",
              fontSize: isSmall ? 26 : isTablet ? 42 : 32,
              lineHeight: isSmall ? 32 : isTablet ? 52 : 38,
              color: "#001328",
              marginTop: isTablet ? 40 : 28,
            }}
          >
            {"Your AI language\n"}
            <Text style={{ color: "#6c4ef5" }}>teacher.</Text>
          </Text>

          {/* Subtitle */}
          <Text
            style={{
              fontFamily: "Poppins-Regular",
              fontSize: isSmall ? 13 : isTablet ? 17 : 15,
              lineHeight: isTablet ? 27 : 22,
              color: "#6b7280",
              marginTop: isTablet ? 14 : 10,
            }}
          >
            Real conversations, personalized lessons, anytime, anywhere.
          </Text>

          {/* Mascot illustration with speech bubbles */}
          <View
            style={{
              flex: 1,
              marginTop: isTablet ? 24 : 16,
              // Cap image area so it never swallows the CTA on short/tall screens
              maxHeight: Math.min(
                isTablet ? 500 : 320,
                height * (isTablet ? 0.52 : 0.44)
              ),
            }}
          >
            <Image
              source={images.mascotWelcome}
              style={{ flex: 1, width: "100%" }}
              resizeMode="contain"
            />

            <View
              className="absolute bg-white rounded-2xl px-4 py-2.5"
              style={[styles.shadow, { left: 0, top: "35%" }]}
            >
              <Text className="font-poppins-medium text-sm text-text-primary">
                Hello!
              </Text>
            </View>

            <View
              className="absolute bg-white rounded-2xl px-4 py-2.5"
              style={[styles.shadow, { right: 0, top: "10%" }]}
            >
              <Text className="font-poppins-medium text-sm text-text-primary">
                ¡Hola!
              </Text>
            </View>

            <View
              className="absolute bg-white rounded-2xl px-4 py-2.5"
              style={[styles.shadow, { right: isTablet ? 24 : 20, top: "60%" }]}
            >
              <Text className="font-poppins-medium text-sm text-error">
                你好!
              </Text>
            </View>
          </View>

          {/* CTA button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#6c4ef5",
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 12,
              marginBottom: isTablet ? 40 : 24,
              paddingVertical: isTablet ? 18 : 16,
            }}
            activeOpacity={0.85}
            testID="get-started-button"
            onPress={() => {
              posthog.capture("onboarding_get_started_tapped");
              router.push("/(auth)/sign-up");
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins-SemiBold",
                fontSize: isTablet ? 18 : 16,
                color: "#fff",
              }}
            >
              Get Started
            </Text>
            <Ionicons
              name="chevron-forward"
              size={isTablet ? 26 : 22}
              color="#fff"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: "center",
  },
  inner: {
    flex: 1,
    width: "100%",
  },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
});
