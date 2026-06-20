import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { colors } from "@/constants/theme";
import { LANGUAGES } from "@/data/languages";
import { LESSONS } from "@/data/lessons";
import { UNITS } from "@/data/units";
import { posthog } from "@/lib/posthog";
import { useLanguageStore } from "@/store/languageStore";
import { Lesson } from "@/types/learning";

type Message = { id: string; role: "user" | "assistant"; content: string };

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";

async function askTeacher(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 200 },
      }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── Lesson picker ────────────────────────────────────────────────────────────
function LessonPicker({
  lessons,
  langName,
  onSelect,
}: {
  lessons: Lesson[];
  langName: string;
  onSelect: (lesson: Lesson) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.pickerHeader}>
        <Text style={styles.screenTitle}>AI Teacher</Text>
        <Text style={styles.screenSub}>
          Choose a {langName} lesson to practice with your AI teacher
        </Text>
      </View>

      {/* Mascot */}
      <View style={styles.mascotRow}>
        <Image
          source={images.mascotWelcome}
          style={styles.mascot}
          resizeMode="contain"
        />
        <View style={styles.speechBubble}>
          <Text style={styles.speechText}>
            Which topic would you like to practice today? 👇
          </Text>
        </View>
      </View>

      {/* Lesson list */}
      <FlatList
        data={lessons}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.lessonList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.lessonCard}
            onPress={() => onSelect(item)}
            activeOpacity={0.8}
          >
            <View style={styles.lessonIcon}>
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lessonTitle}>{item.title}</Text>
              <Text style={styles.lessonDesc} numberOfLines={1}>
                {item.description}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.neutral.textSecondary}
            />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: colors.neutral.border }} />
        )}
      />
    </View>
  );
}

// ─── Active session chat ──────────────────────────────────────────────────────
function TeacherChat({
  lesson,
  onBack,
}: {
  lesson: Lesson;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "assistant",
      content: lesson.aiTeacherPrompt.introMessage,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const apiMessages = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const reply = await askTeacher(
        apiMessages,
        lesson.aiTeacherPrompt.systemPrompt
      );
      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, role: "assistant", content: reply },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Connection error — please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, lesson]);

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
          {item.content}
        </Text>
      </View>
    );
  };

  return (
    <>
      {/* Chat header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.neutral.textPrimary} />
        </TouchableOpacity>
        <View style={styles.chatHeaderAvatar}>
          <Text style={{ fontSize: 20 }}>{lesson.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chatHeaderTitle}>{lesson.title}</Text>
          <View style={styles.headerOnlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.chatHeaderSub}>AI Teacher • Active</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          showsVerticalScrollIndicator={false}
        />

        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.aiBubble}>
              <ActivityIndicator size="small" color={colors.neutral.textSecondary} />
            </View>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Reply to your AI teacher..."
            placeholderTextColor={colors.neutral.textSecondary}
            multiline
            maxLength={400}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || loading) && styles.sendBtnDisabled,
            ]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Root screen ──────────────────────────────────────────────────────────────
export default function AITeacherScreen() {
  const { selectedLanguage } = useLanguageStore();
  const language = LANGUAGES.find((l) => l.code === selectedLanguage);
  const langName = language?.name ?? "your target language";

  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const unit = UNITS.find((u) => u.languageCode === selectedLanguage);
  const lessons = unit
    ? (unit.lessonIds
        .map((id) => LESSONS.find((l) => l.id === id))
        .filter(Boolean) as Lesson[])
    : [];

  useEffect(() => {
    posthog.capture("ai_teacher_viewed");
  }, []);

  const handleSelectLesson = (lesson: Lesson) => {
    posthog.capture("ai_teacher_lesson_started", {
      lesson_id: lesson.id,
      lesson_title: lesson.title,
    });
    setSelectedLesson(lesson);
  };

  const handleBack = () => setSelectedLesson(null);

  if (!selectedLanguage || lessons.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.neutral.background }}>
        <View style={styles.emptyCenter}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🌍</Text>
          <Text style={styles.emptyTitle}>No lessons yet</Text>
          <Text style={styles.emptySub}>
            Select a language from the home screen to unlock AI lessons.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.neutral.background }}>
      {selectedLesson ? (
        <TeacherChat lesson={selectedLesson} onBack={handleBack} />
      ) : (
        <LessonPicker
          lessons={lessons}
          langName={langName}
          onSelect={handleSelectLesson}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Picker
  pickerHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
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
    marginBottom: 8,
  },
  mascotRow: { alignItems: "center", paddingVertical: 8 },
  mascot: { width: 140, height: 120 },
  speechBubble: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    maxWidth: "80%",
  },
  speechText: {
    fontFamily: "Poppins-Medium",
    fontSize: 13,
    color: colors.neutral.textPrimary,
    textAlign: "center",
  },
  lessonList: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 },
  lessonCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
  },
  lessonIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.neutral.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  lessonTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 15,
    color: colors.neutral.textPrimary,
    marginBottom: 2,
  },
  lessonDesc: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: colors.neutral.textSecondary,
  },
  // Chat header
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
    color: colors.neutral.textPrimary,
  },
  headerOnlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.semantic.success,
  },
  chatHeaderSub: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: colors.neutral.textSecondary,
  },
  // Messages
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary.purple,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.neutral.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: colors.neutral.textPrimary,
    lineHeight: 21,
  },
  userBubbleText: { color: "#fff" },
  typingRow: { paddingHorizontal: 16, paddingBottom: 6 },
  // Input
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: colors.neutral.textPrimary,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  // Empty state
  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 20,
    color: colors.neutral.textPrimary,
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: colors.neutral.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
