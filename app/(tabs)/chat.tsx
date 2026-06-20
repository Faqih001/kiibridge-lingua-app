import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LANGUAGES } from "@/data/languages";
import { colors } from "@/constants/theme";
import { useLanguageStore } from "@/store/languageStore";
import { posthog } from "@/lib/posthog";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";

async function askGemini(
  messages: Array<{ role: string; content: string }>,
  language: string
): Promise<string> {
  const systemPrompt =
    `You are KiiBridge, a friendly and encouraging ${language} language tutor. ` +
    `Help the user practice ${language} through natural conversation. ` +
    `Keep responses concise (2-3 sentences). ` +
    `Gently correct mistakes and introduce vocabulary naturally. ` +
    `Encourage the user to try writing in ${language}.`;

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
        generationConfig: { maxOutputTokens: 300 },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export default function ChatScreen() {
  const { selectedLanguage } = useLanguageStore();
  const language = LANGUAGES.find((l) => l.code === selectedLanguage);
  const langName = language?.name ?? "your target language";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi! I'm your ${langName} tutor. Let's practice together — ask me anything, start a conversation, or say a word and I'll help you use it naturally. What would you like to practice today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const flatListRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    posthog.capture("chat_viewed");
  }, []);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Hi! I'm your ${langName} tutor. Let's practice together — ask me anything, start a conversation, or say a word and I'll help you use it naturally. What would you like to practice today?`,
      },
    ]);
  }, [langName]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    posthog.capture("chat_message_sent");
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
      const reply = await askGemini(apiMessages, langName);
      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, role: "assistant", content: reply },
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Couldn't reach the AI tutor. ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, langName]);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.neutral.background }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>AI</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>AI Language Tutor</Text>
          <View style={styles.headerOnlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSub}>{langName} • Online</Text>
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
          keyExtractor={(item) => item.id}
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
            placeholder={`Message your ${langName} tutor...`}
            placeholderTextColor={colors.neutral.textSecondary}
            multiline
            maxLength={500}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
    gap: 12,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    fontFamily: "Poppins-Bold",
    fontSize: 14,
    color: "#fff",
  },
  headerInfo: { flex: 1 },
  headerTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 15,
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
  headerSub: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: colors.neutral.textSecondary,
  },
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
});
