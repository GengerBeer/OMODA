import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

const TOPICS = ["technology", "business", "science", "world", "culture", "sports"];

const CATEGORY_STYLES = {
  technology: { base: "#1c4d5b", glow: "#d97548" },
  business: { base: "#23435d", glow: "#d49d4d" },
  science: { base: "#30566b", glow: "#73a7ba" },
  world: { base: "#27415d", glow: "#73a6d8" },
  culture: { base: "#6d3e4b", glow: "#df8f72" },
  sports: { base: "#3d5f43", glow: "#a9cc78" },
  fallback: { base: "#2d414f", glow: "#d97548" },
};

function titleCase(value) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function buildInitialBaseUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  const scriptUrl = NativeModules?.SourceCode?.scriptURL;
  const hostMatch = typeof scriptUrl === "string" ? scriptUrl.match(/https?:\/\/([^/:]+)/) : null;

  if (hostMatch?.[1]) {
    return `http://${hostMatch[1]}:3000`;
  }

  return "http://localhost:3000";
}

async function requestJson(baseUrl, path, options) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed.");
  }

  return response.json();
}

function formatArticleMeta(article) {
  const source = article?.source ?? "NewsTok";
  const publishedAt = article?.publishedAt
    ? new Date(article.publishedAt).toLocaleString()
    : "Now";

  return `${source} | ${publishedAt}`;
}

export default function App() {
  const detectedBaseUrl = buildInitialBaseUrl();
  const { height: windowHeight } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [apiBaseUrl, setApiBaseUrl] = useState(detectedBaseUrl);
  const [profile, setProfile] = useState(null);
  const [feedItems, setFeedItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [activeArticle, setActiveArticle] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showConnectionEditor, setShowConnectionEditor] = useState(true);
  const [status, setStatus] = useState(
    Platform.OS === "web"
      ? "Web preview can connect to localhost automatically."
      : detectedBaseUrl.includes("localhost")
        ? "Enter your Windows PC IP, then connect from Expo Go."
        : `Detected backend host ${detectedBaseUrl}. Tap Connect.`,
  );

  const compactConnection = isConnected && !showConnectionEditor;
  const cardHeight = Math.max(windowHeight - (compactConnection ? 270 : 420), 320);
  const cardSnap = cardHeight + 18;

  async function loadProfile(baseUrl) {
    const response = await requestJson(baseUrl, "/v1/profile/demo-user");
    setProfile(response);
    return response;
  }

  async function loadFeed(baseUrl, cursor, append = false) {
    const suffix = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const response = await requestJson(
      baseUrl,
      `/v1/feed?userId=demo-user&limit=4${suffix}`,
    );

    setNextCursor(response.nextCursor ?? null);
    setFeedItems((currentItems) => {
      const nextItems = append ? currentItems.concat(response.items ?? []) : response.items ?? [];

      if (!append && nextItems.length > 0) {
        setActiveArticle(nextItems[0].article);
      }

      return nextItems;
    });
  }

  async function connect() {
    const baseUrl = normalizeBaseUrl(apiBaseUrl);

    if (!baseUrl) {
      setStatus("Add your backend URL first.");
      return;
    }

    setLoading(true);
    setStatus(`Connecting to ${baseUrl}...`);

    try {
      await loadProfile(baseUrl);
      await loadFeed(baseUrl, null, false);
      setIsConnected(true);
      setShowConnectionEditor(false);
      setStatus("Connected. Swipe the feed and open stories.");
    } catch (error) {
      console.error(error);
      setIsConnected(false);
      setStatus(`Could not connect to ${baseUrl}. Use your Windows LAN IP like "http://192.168.1.20:3000".`);
      Alert.alert(
        "Connection failed",
        `Could not reach ${baseUrl}. Expo Go on your phone cannot use localhost from your PC. Enter your Windows LAN IP instead.`,
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    const baseUrl = normalizeBaseUrl(apiBaseUrl);

    setLoading(true);
    setStatus("Refreshing profile and feed...");

    try {
      await loadProfile(baseUrl);
      await loadFeed(baseUrl, null, false);
      setIsConnected(true);
      setStatus("Feed refreshed.");
    } catch (error) {
      console.error(error);
      setStatus("Could not refresh the feed.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    const baseUrl = normalizeBaseUrl(apiBaseUrl);

    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setStatus("Loading more stories...");

    try {
      await loadFeed(baseUrl, nextCursor, true);
      setStatus("More stories loaded.");
    } catch (error) {
      console.error(error);
      setStatus("Could not load more stories.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleTopic(topic) {
    if (!profile) {
      return;
    }

    const nextTopics = profile.selectedTopics.includes(topic)
      ? profile.selectedTopics.filter((item) => item !== topic)
      : profile.selectedTopics.concat(topic);

    if (nextTopics.length === 0) {
      Alert.alert("Choose at least one topic");
      return;
    }

    setLoading(true);
    setStatus("Updating your interests...");

    try {
      const updatedProfile = await requestJson(apiBaseUrl, "/v1/profile/demo-user/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ selectedTopics: nextTopics }),
      });

      setProfile(updatedProfile);
      await loadFeed(apiBaseUrl, null, false);
      setStatus("Interests updated. Feed reranked instantly.");
    } catch (error) {
      console.error(error);
      setStatus("Could not update interests.");
    } finally {
      setLoading(false);
    }
  }

  async function openArticle(articleId) {
    try {
      setStatus("Loading article detail...");
      const article = await requestJson(apiBaseUrl, `/v1/articles/${articleId}`);
      setActiveArticle(article);
      setDetailVisible(true);
      setStatus("Story loaded.");
    } catch (error) {
      console.error(error);
      setStatus("Could not load article detail.");
    }
  }

  useEffect(() => {
    if (Platform.OS === "web" || !detectedBaseUrl.includes("localhost")) {
      connect().catch((error) => {
        console.error(error);
      });
    }
  }, []);

  function renderTopicChips() {
    if (!profile) {
      return null;
    }

      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.topicScroller}
          contentContainerStyle={styles.topicRow}
        >
        {TOPICS.map((topic) => {
          const active = profile.selectedTopics?.includes(topic);

          return (
            <Pressable
              key={topic}
              style={[styles.topicChip, active ? styles.topicChipActive : null]}
              onPress={() => {
                toggleTopic(topic).catch((error) => {
                  console.error(error);
                });
              }}
            >
              <Text style={[styles.topicChipText, active ? styles.topicChipTextActive : null]}>
                {titleCase(topic)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  function renderFeedCard({ item, index }) {
    const category = item.article?.summary?.category ?? "technology";
    const palette = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.fallback;
    const inputRange = [
      (index - 1) * cardSnap,
      index * cardSnap,
      (index + 1) * cardSnap,
    ];

    const scale = scrollY.interpolate({
      inputRange,
      outputRange: [0.97, 1, 0.97],
      extrapolate: "clamp",
    });

    const opacity = scrollY.interpolate({
      inputRange,
      outputRange: [0.74, 1, 0.74],
      extrapolate: "clamp",
    });

    return (
      <View style={[styles.cardPage, { height: cardHeight }]}>
        <Animated.View style={{ flex: 1, transform: [{ scale }], opacity }}>
          <Pressable
            style={[styles.card, { backgroundColor: palette.base }]}
            onPress={() => {
              openArticle(item.articleId).catch((error) => {
                console.error(error);
              });
            }}
          >
            <View style={[styles.cardGlowLarge, { backgroundColor: palette.glow }]} />
            <View style={styles.cardGlowSmall} />

            <View style={styles.cardTopRow}>
              <Text style={styles.cardCategory}>{titleCase(category)}</Text>
              <Text style={styles.cardSource}>{item.article.source}</Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.article.title}</Text>
              <Text style={styles.cardSummary}>{item.article.summary.summaryShort}</Text>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardReason}>{item.reason}</Text>
              <Text style={styles.cardCta}>Open story</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.backgroundOrbOne} />
        <View style={styles.backgroundOrbTwo} />

        <View style={styles.header}>
          <Text style={styles.kicker}>Expo Go Preview</Text>
          <Text style={styles.title}>NewsTok For You</Text>
          <Text style={styles.subtitle}>
            Connect your phone to the same Wi-Fi as this PC, then point the app to your backend.
          </Text>
        </View>

        {compactConnection ? (
          <View style={styles.connectionCompact}>
            <View style={styles.connectionCompactCopy}>
              <Text style={styles.connectionCompactLabel}>Connected backend</Text>
              <Text style={styles.connectionCompactValue}>{normalizeBaseUrl(apiBaseUrl)}</Text>
            </View>
            <Pressable
              style={styles.connectionCompactButton}
              onPress={() => setShowConnectionEditor(true)}
            >
              <Text style={styles.connectionCompactButtonText}>Edit URL</Text>
            </Pressable>
          </View>
        ) : null}

        {!compactConnection ? (
          <View style={styles.connectionCard}>
            <Text style={styles.connectionLabel}>Backend URL</Text>
            <View style={styles.connectionRow}>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.1.20:3000"
                placeholderTextColor="#8d8276"
                value={apiBaseUrl}
                onChangeText={setApiBaseUrl}
              />
              <Pressable
                style={styles.connectButton}
                onPress={() => {
                  connect().catch((error) => {
                    console.error(error);
                  });
                }}
              >
                <Text style={styles.connectButtonText}>Connect</Text>
              </Pressable>
            </View>
            <Text style={styles.connectionHint}>
              On a real phone, replace localhost with your Windows LAN IP from ipconfig.
            </Text>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}

        {renderTopicChips()}

        <View style={styles.feedHeader}>
          <View>
            <Text style={styles.feedLabel}>Personalized feed</Text>
            <Text style={styles.feedMeta}>
              {profile
                ? `${profile.selectedTopics.length} active topics`
                : "Connect to load demo-user interests"}
            </Text>
          </View>
          <Pressable
            style={[styles.refreshButton, loading ? styles.refreshButtonDisabled : null]}
            disabled={loading}
            onPress={() => {
              refreshAll().catch((error) => {
                console.error(error);
              });
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.refreshButtonText}>Refresh</Text>
            )}
          </Pressable>
        </View>

        <Animated.FlatList
          style={styles.feedList}
          data={feedItems}
          keyExtractor={(item) => item.articleId}
          renderItem={renderFeedCard}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          snapToInterval={cardSnap}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          onEndReachedThreshold={0.25}
          onEndReached={() => {
            loadMore().catch((error) => {
              console.error(error);
            });
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Ready for phone testing</Text>
              <Text style={styles.emptyBody}>
                Start the backend, enter your PC IP, and connect to load the NewsTok feed.
              </Text>
            </View>
          }
          ListFooterComponent={
            feedItems.length > 0 ? (
              <Pressable
                style={[styles.loadMoreButton, !nextCursor ? styles.loadMoreButtonDisabled : null]}
                disabled={!nextCursor || loadingMore}
                onPress={() => {
                  loadMore().catch((error) => {
                    console.error(error);
                  });
                }}
              >
                {loadingMore ? (
                  <ActivityIndicator color="#1f1c19" />
                ) : (
                  <Text style={styles.loadMoreButtonText}>
                    {nextCursor ? "Load more stories" : "No more stories"}
                  </Text>
                )}
              </Pressable>
            ) : null
          }
        />

        <Modal
          visible={detailVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setDetailVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalKicker}>
                  {titleCase(activeArticle?.summary?.category ?? "story")}
                </Text>
                <Pressable onPress={() => setDetailVisible(false)}>
                  <Text style={styles.modalClose}>Close</Text>
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{activeArticle?.title ?? "Story detail"}</Text>
                <Text style={styles.modalSummary}>
                  {activeArticle?.summary?.summaryShort ?? "Open a card to read more."}
                </Text>
                <Text style={styles.modalMeta}>{formatArticleMeta(activeArticle)}</Text>
                <Text style={styles.modalBody}>{activeArticle?.body ?? ""}</Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2ede3",
  },
  container: {
    flex: 1,
    backgroundColor: "#f2ede3",
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  backgroundOrbOne: {
    position: "absolute",
    top: -80,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(216, 109, 69, 0.18)",
  },
  backgroundOrbTwo: {
    position: "absolute",
    right: -80,
    bottom: 180,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(31, 94, 115, 0.16)",
  },
  header: {
    marginBottom: 14,
  },
  kicker: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(31, 94, 115, 0.08)",
    color: "#1f5e73",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 14,
    color: "#1f1c19",
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  subtitle: {
    marginTop: 10,
    color: "#6f685f",
    fontSize: 15,
    lineHeight: 22,
  },
  connectionCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255, 252, 247, 0.86)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.55)",
  },
  connectionCompactCopy: {
    flex: 1,
  },
  connectionCompactLabel: {
    color: "#6f685f",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  connectionCompactValue: {
    marginTop: 6,
    color: "#1f1c19",
    fontSize: 14,
    fontWeight: "700",
  },
  connectionCompactButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#1f5e73",
  },
  connectionCompactButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  connectionCard: {
    marginBottom: 12,
    backgroundColor: "rgba(255, 252, 247, 0.8)",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.55)",
    shadowColor: "#1a1814",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  connectionLabel: {
    color: "#6f685f",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  connectionRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#fffaf4",
    paddingHorizontal: 16,
    color: "#1f1c19",
    fontSize: 15,
  },
  connectButton: {
    minWidth: 108,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#1f5e73",
  },
  connectButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  connectionHint: {
    marginTop: 12,
    color: "#6f685f",
    fontSize: 13,
    lineHeight: 18,
  },
  statusText: {
    marginTop: 10,
    color: "#1f1c19",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  topicRow: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8,
    alignItems: "center",
  },
  topicScroller: {
    flexGrow: 0,
    maxHeight: 56,
  },
  topicChip: {
    alignSelf: "center",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
  topicChipActive: {
    backgroundColor: "#1f5e73",
  },
  topicChipText: {
    color: "#1f1c19",
    fontSize: 13,
    fontWeight: "700",
  },
  topicChipTextActive: {
    color: "#ffffff",
  },
  feedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 12,
  },
  feedLabel: {
    color: "#1f1c19",
    fontSize: 17,
    fontWeight: "800",
  },
  feedMeta: {
    marginTop: 4,
    color: "#6f685f",
    fontSize: 13,
  },
  refreshButton: {
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#1f5e73",
  },
  refreshButtonDisabled: {
    opacity: 0.8,
  },
  refreshButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  feedList: {
    flex: 1,
  },
  feedContent: {
    paddingBottom: 18,
  },
  cardPage: {
    paddingBottom: 18,
  },
  card: {
    flex: 1,
    borderRadius: 32,
    padding: 22,
    overflow: "hidden",
    shadowColor: "#1a1814",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  cardGlowLarge: {
    position: "absolute",
    top: -12,
    right: -26,
    width: 190,
    height: 190,
    borderRadius: 999,
    opacity: 0.82,
  },
  cardGlowSmall: {
    position: "absolute",
    bottom: 110,
    left: -26,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardCategory: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.14)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cardSource: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.16)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  cardBody: {
    marginTop: 20,
    flex: 1,
    justifyContent: "center",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  cardSummary: {
    marginTop: 14,
    maxWidth: "92%",
    color: "rgba(255,255,255,0.92)",
    fontSize: 15,
    lineHeight: 23,
  },
  cardFooter: {
    gap: 12,
  },
  cardReason: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  cardCta: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyState: {
    minHeight: 300,
    borderRadius: 28,
    padding: 26,
    backgroundColor: "rgba(255, 252, 247, 0.86)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#1f1c19",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 12,
    color: "#6f685f",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  loadMoreButton: {
    marginTop: 4,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.84)",
  },
  loadMoreButtonDisabled: {
    opacity: 0.62,
  },
  loadMoreButtonText: {
    color: "#1f1c19",
    fontSize: 14,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 18, 16, 0.42)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: "#fffaf4",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalKicker: {
    color: "#1f5e73",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  modalClose: {
    color: "#1f1c19",
    fontSize: 14,
    fontWeight: "700",
  },
  modalTitle: {
    marginTop: 18,
    color: "#1f1c19",
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  modalSummary: {
    marginTop: 16,
    color: "#423d37",
    fontSize: 17,
    lineHeight: 25,
  },
  modalMeta: {
    marginTop: 14,
    color: "#6f685f",
    fontSize: 13,
    fontWeight: "600",
  },
  modalBody: {
    marginTop: 22,
    color: "#2f2a26",
    fontSize: 16,
    lineHeight: 27,
    paddingBottom: 18,
  },
});
