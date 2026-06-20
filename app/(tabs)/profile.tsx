import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LANGUAGES } from "@/data/languages";
import { colors } from "@/constants/theme";
import { useLanguageStore } from "@/store/languageStore";
import { useLearningStore } from "@/store/learningStore";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { selectedLanguage, clearSelectedLanguage } = useLanguageStore();
  const { xpToday, dailyGoal, streak, completedLessonIds } = useLearningStore();

  const language = LANGUAGES.find((l) => l.code === selectedLanguage);
  const xpProgress = dailyGoal > 0 ? Math.min((xpToday / dailyGoal) * 100, 100) : 0;
  const memberSince = user?.createdAt
    ? user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";
  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user?.firstName ?? "Learner");
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const initial = (displayName[0] ?? "?").toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/onboarding");
  };

  const handleChangeLanguage = () => {
    clearSelectedLanguage();
    router.replace("/language-select");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.neutral.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Screen title */}
        <Text style={styles.screenTitle}>Profile</Text>

        {/* Avatar + identity */}
        <View style={styles.avatarSection}>
          {user?.imageUrl ? (
            <Image
              source={{ uri: user.imageUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <Text style={styles.displayName}>{displayName}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
          <Text style={styles.memberSince}>Member since {memberSince}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🔥</Text>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statValue}>{xpToday}</Text>
            <Text style={styles.statLabel}>XP Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📚</Text>
            <Text style={styles.statValue}>{completedLessonIds.length}</Text>
            <Text style={styles.statLabel}>Lessons</Text>
          </View>
        </View>

        {/* Daily goal */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Daily Goal</Text>
          <View style={styles.goalRow}>
            <Text style={styles.goalText}>
              {xpToday} / {dailyGoal} XP
            </Text>
            <Text style={styles.goalPercent}>{Math.round(xpProgress)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(xpProgress)}%` as `${number}%` },
              ]}
            />
          </View>
        </View>

        {/* Language */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Learning</Text>
          <View style={styles.langRow}>
            {language && (
              <Image
                source={{ uri: language.flag }}
                style={styles.flag}
                contentFit="cover"
              />
            )}
            <Text style={styles.langName}>
              {language?.name ?? "No language selected"}
            </Text>
            <TouchableOpacity
              onPress={handleChangeLanguage}
              style={styles.changeBtn}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Settings</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleChangeLanguage}
            activeOpacity={0.7}
          >
            <Ionicons
              name="language-outline"
              size={20}
              color={colors.neutral.textPrimary}
            />
            <Text style={styles.settingText}>Change Language</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.neutral.textSecondary}
            />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={colors.neutral.textPrimary}
            />
            <Text style={styles.settingText}>Notifications</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.neutral.textSecondary}
            />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={colors.neutral.textPrimary}
            />
            <Text style={styles.settingText}>Privacy & Data</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.neutral.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.85}
          testID="sign-out-button"
        >
          <Ionicons name="log-out-outline" size={18} color={colors.semantic.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 },
  screenTitle: {
    fontFamily: "Poppins-Bold",
    fontSize: 28,
    color: colors.neutral.textPrimary,
    marginBottom: 20,
  },
  // Avatar
  avatarSection: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 12 },
  avatarFallback: {
    backgroundColor: colors.primary.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: "Poppins-Bold",
    fontSize: 36,
    color: "#fff",
  },
  displayName: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 20,
    color: colors.neutral.textPrimary,
    marginBottom: 2,
  },
  email: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: colors.neutral.textSecondary,
    marginBottom: 4,
  },
  memberSince: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: colors.neutral.textSecondary,
  },
  // Stats
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: {
    fontFamily: "Poppins-Bold",
    fontSize: 20,
    color: colors.neutral.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: colors.neutral.textSecondary,
    textAlign: "center",
  },
  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    padding: 16,
    marginBottom: 14,
  },
  cardLabel: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 11,
    color: colors.neutral.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  // Daily goal
  goalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  goalText: {
    fontFamily: "Poppins-Medium",
    fontSize: 14,
    color: colors.neutral.textPrimary,
  },
  goalPercent: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
    color: colors.primary.purple,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.neutral.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: colors.primary.purple,
    borderRadius: 4,
  },
  // Language
  langRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  flag: { width: 32, height: 32, borderRadius: 16 },
  langName: {
    flex: 1,
    fontFamily: "Poppins-Medium",
    fontSize: 15,
    color: colors.neutral.textPrimary,
  },
  changeBtn: {
    backgroundColor: colors.neutral.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeBtnText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 13,
    color: colors.primary.purple,
  },
  // Settings
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  settingText: {
    flex: 1,
    fontFamily: "Poppins-Regular",
    fontSize: 15,
    color: colors.neutral.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: 8,
  },
  // Sign out
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.semantic.error,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
  },
  signOutText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 15,
    color: colors.semantic.error,
  },
});
