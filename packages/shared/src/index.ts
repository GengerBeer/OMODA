export type Category =
  | "world"
  | "technology"
  | "business"
  | "science"
  | "sports"
  | "culture";

export interface ArticleSummary {
  title: string;
  summaryShort: string;
  category: Category;
}

export interface Article {
  id: string;
  source: string;
  title: string;
  body: string;
  imageUrl: string;
  publishedAt: string;
  summary: ArticleSummary;
}

export interface FeedItem {
  articleId: string;
  score: number;
  reason: string;
  article: Article;
}

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface UserProfile {
  userId: string;
  selectedTopics: Category[];
  interestWeights: Record<Category, number>;
}
