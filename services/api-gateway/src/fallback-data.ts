type Category =
  | "world"
  | "technology"
  | "business"
  | "science"
  | "sports"
  | "culture";

interface Summary {
  title: string;
  summaryShort: string;
  category: Category;
}

interface Article {
  id: string;
  source: string;
  title: string;
  body: string;
  imageUrl: string;
  publishedAt: string;
  category: Category;
}

interface Profile {
  userId: string;
  selectedTopics: Category[];
  interestWeights: Record<Category, number>;
}

const allCategories: Category[] = [
  "world",
  "technology",
  "business",
  "science",
  "sports",
  "culture",
];

const fallbackArticles: Article[] = [
  {
    id: "article-001",
    source: "Signal Daily",
    title: "AI chips are reshaping the next wave of mobile devices",
    body: "Phone makers are redesigning flagship roadmaps around on-device AI workloads. New silicon designs are targeting private inference, longer battery life and faster image generation without depending on cloud round-trips. Analysts say the shift could become as important to premium devices as camera systems were in the last upgrade cycle.",
    imageUrl: "",
    publishedAt: "2026-04-03T08:00:00Z",
    category: "technology",
  },
  {
    id: "article-002",
    source: "Market Notebook",
    title: "European climate startups find momentum in industrial software",
    body: "A growing class of industrial software startups is attracting capital by helping manufacturers track emissions, model energy use and automate compliance reporting. Investors say the next wave of climate technology may be less about hardware and more about operational software embedded inside factories.",
    imageUrl: "",
    publishedAt: "2026-04-03T09:15:00Z",
    category: "business",
  },
  {
    id: "article-003",
    source: "Orbit Weekly",
    title: "A compact telescope design could widen access to deep-space imaging",
    body: "Researchers are testing a lighter mirror assembly and a simplified tracking system aimed at lowering the cost of high-resolution space imaging. Universities and smaller observatories say the approach could make deep-space observation programs far more attainable over the next few years.",
    imageUrl: "",
    publishedAt: "2026-04-03T10:30:00Z",
    category: "science",
  },
  {
    id: "article-004",
    source: "World Brief",
    title: "Port upgrades speed up trade routes across the eastern Mediterranean",
    body: "Several major ports have completed logistics upgrades that reduce cargo turnaround times and improve customs processing. Shipping firms say the changes are already shortening delays for regional trade lanes and making alternative routes more resilient during peak demand periods.",
    imageUrl: "",
    publishedAt: "2026-04-03T11:10:00Z",
    category: "world",
  },
  {
    id: "article-005",
    source: "Studio Ledger",
    title: "Indie film houses lean on smaller crews and faster release windows",
    body: "Independent studios are reorganizing production schedules around shorter shoots and tighter release windows. Producers say the model helps them respond to audience trends more quickly while preserving room for experimental storytelling and lower-budget risk-taking.",
    imageUrl: "",
    publishedAt: "2026-04-03T11:40:00Z",
    category: "culture",
  },
  {
    id: "article-006",
    source: "Touchline Report",
    title: "Clubs are using recovery analytics to extend peak seasons for players",
    body: "Elite clubs are expanding the use of sleep, hydration and movement tracking to manage player fatigue. Performance teams say recovery data is becoming a decisive edge during compressed schedules because it helps coaches rotate lineups without losing structure.",
    imageUrl: "",
    publishedAt: "2026-04-03T12:05:00Z",
    category: "sports",
  },
];

const profiles = new Map<string, Profile>();

function normalizeTopics(topics: string[]): Category[] {
  const selected = topics.filter((topic): topic is Category => {
    return allCategories.includes(topic as Category);
  });

  return selected.length > 0 ? Array.from(new Set(selected)) : ["technology", "business", "science"];
}

function buildInterestWeights(selectedTopics: Category[]) {
  const selected = new Set(selectedTopics);

  return allCategories.reduce<Record<Category, number>>((accumulator, category) => {
    accumulator[category] = selected.has(category) ? 1 : 0.35;
    return accumulator;
  }, {} as Record<Category, number>);
}

function getOrCreateProfile(userId: string): Profile {
  const existing = profiles.get(userId);
  if (existing) {
    return existing;
  }

  const selectedTopics = normalizeTopics([]);
  const profile = {
    userId,
    selectedTopics,
    interestWeights: buildInterestWeights(selectedTopics),
  };
  profiles.set(userId, profile);
  return profile;
}

function summarize(article: Article): Summary {
  const sentence = article.body.split(". ")[0]?.replace(/\.+$/, "") ?? article.body;
  return {
    title: article.title,
    summaryShort: sentence.length > 140 ? `${sentence.slice(0, 137)}...` : `${sentence}.`,
    category: article.category,
  };
}

function recencyScore(publishedAt: string) {
  const hoursOld = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60));
  return Math.max(0.2, 1 - hoursOld / 72);
}

function rankForProfile(profile: Profile) {
  return [...fallbackArticles]
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
    .map((article) => {
      const summary = summarize(article);
      const categoryWeight = profile.interestWeights[article.category] ?? 0.35;
      const score = Number((categoryWeight * 0.72 + recencyScore(article.publishedAt) * 0.28).toFixed(4));
      const reason = profile.selectedTopics.includes(article.category)
        ? `Because you follow ${article.category} stories`
        : `Because this is rising in your ${profile.selectedTopics[0] ?? "daily"} mix`;

      return {
        articleId: article.id,
        score,
        reason,
        article: {
          ...article,
          summary,
        },
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function getFallbackFeed(userId: string, limit: number, cursor: string) {
  const profile = getOrCreateProfile(userId);
  const offset = Math.max(Number(cursor || "0") || 0, 0);
  const safeLimit = Math.min(Math.max(limit || 4, 1), 8);
  const ranked = rankForProfile(profile);
  const items = ranked.slice(offset, offset + safeLimit);

  return {
    userId,
    items,
    nextCursor: offset + items.length < ranked.length ? String(offset + items.length) : null,
  };
}

export function getFallbackArticle(articleId: string) {
  const article = fallbackArticles.find((candidate) => candidate.id === articleId);

  if (!article) {
    return null;
  }

  return {
    ...article,
    summary: summarize(article),
  };
}

export function getFallbackProfile(userId: string) {
  return getOrCreateProfile(userId);
}

export function updateFallbackTopics(userId: string, topics: string[]) {
  const selectedTopics = normalizeTopics(topics);
  const profile = {
    userId,
    selectedTopics,
    interestWeights: buildInterestWeights(selectedTopics),
  };

  profiles.set(userId, profile);
  return profile;
}
