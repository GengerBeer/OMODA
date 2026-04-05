import "reflect-metadata";

import path from "node:path";

import dotenv from "dotenv";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  ClientGrpc,
  ClientProxyFactory,
  GrpcMethod,
  MicroserviceOptions,
  Transport,
} from "@nestjs/microservices";
import { createClient, type RedisClientType } from "redis";
import { lastValueFrom, type Observable } from "rxjs";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.example"), override: false });

const httpPort = Number(process.env.FEED_SERVICE_HTTP_PORT ?? 3103);
const grpcPort = Number(process.env.FEED_SERVICE_PORT ?? 50053);
const contentServicePort = Number(process.env.CONTENT_SERVICE_PORT ?? 50051);
const profileServicePort = Number(process.env.PROFILE_SERVICE_PORT ?? 50052);
const summaryServicePort = Number(process.env.AI_SUMMARY_SERVICE_PORT ?? 50054);

type Category =
  | "world"
  | "technology"
  | "business"
  | "science"
  | "sports"
  | "culture";

interface SummaryMessage {
  title: string;
  summaryShort: string;
  category: Category;
}

interface ArticleMessage {
  id: string;
  source: string;
  title: string;
  body: string;
  imageUrl: string;
  publishedAt: string;
  category?: Category;
  summary?: SummaryMessage;
}

interface FeedItemMessage {
  articleId: string;
  score: number;
  reason: string;
  article: ArticleMessage & { summary: SummaryMessage };
}

interface ContentServiceClient {
  listArticles(request: { limit: number; cursor: string }): Observable<{
    items: ArticleMessage[];
    nextCursor: string;
  }>;
}

interface ProfileServiceClient {
  getProfile(request: { userId: string }): Observable<{
    userId: string;
    selectedTopics: string[];
    interestWeights: Array<{ category: string; score: number }>;
  }>;
}

interface SummaryServiceClient {
  summarizeArticle(request: {
    articleId: string;
    title: string;
    body: string;
  }): Observable<SummaryMessage>;
}

function createGrpcClient(packageName: string, protoFile: string, url: string) {
  return ClientProxyFactory.create({
    transport: Transport.GRPC,
    options: {
      package: packageName,
      protoPath: path.resolve(process.cwd(), `../../packages/proto/proto/${protoFile}`),
      url,
      loader: {
        keepCase: false,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        arrays: true,
        objects: true,
      },
    },
  }) as ClientGrpc;
}

function clampLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) {
    return 4;
  }

  return Math.min(Math.max(limit, 1), 8);
}

function parseCursor(cursor?: string) {
  const offset = Number(cursor ?? "0");
  if (!Number.isFinite(offset) || offset < 0) {
    return 0;
  }

  return offset;
}

function mapWeights(entries: Array<{ category: string; score: number }>) {
  return entries.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.category] = entry.score;
    return accumulator;
  }, {});
}

function getCategory(article: ArticleMessage, summary: SummaryMessage): Category {
  return summary.category ?? article.category ?? "world";
}

function computeRecencyScore(publishedAt: string) {
  const hoursOld = Math.max(
    0,
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60),
  );

  return Math.max(0.2, 1 - hoursOld / 72);
}

function computeArticleScore(
  article: ArticleMessage,
  summary: SummaryMessage,
  weights: Record<string, number>,
) {
  const categoryScore = weights[getCategory(article, summary)] ?? 0.45;
  const recencyScore = computeRecencyScore(article.publishedAt);

  return Number((categoryScore * 0.72 + recencyScore * 0.28).toFixed(4));
}

function buildReason(category: Category, selectedTopics: string[]) {
  if (selectedTopics.includes(category)) {
    return `Because you follow ${category} stories`;
  }

  return `Because this is rising in your ${selectedTopics[0] ?? "daily"} mix`;
}

class FeedOrchestrator {
  private contentGrpc!: ClientGrpc;
  private profileGrpc!: ClientGrpc;
  private summaryGrpc!: ClientGrpc;

  private contentService!: ContentServiceClient;
  private profileService!: ProfileServiceClient;
  private summaryService!: SummaryServiceClient;

  private redisClient: RedisClientType | null = null;

  async initialize() {
    this.contentGrpc = createGrpcClient(
      "newstok.content",
      "content.proto",
      `127.0.0.1:${contentServicePort}`,
    );
    this.profileGrpc = createGrpcClient(
      "newstok.profile",
      "profile.proto",
      `127.0.0.1:${profileServicePort}`,
    );
    this.summaryGrpc = createGrpcClient(
      "newstok.summary",
      "summary.proto",
      `127.0.0.1:${summaryServicePort}`,
    );

    this.contentService = this.contentGrpc.getService<ContentServiceClient>("ContentService");
    this.profileService = this.profileGrpc.getService<ProfileServiceClient>("ProfileService");
    this.summaryService = this.summaryGrpc.getService<SummaryServiceClient>("SummaryService");

    const redisUrl =
      process.env.REDIS_URL ??
      `redis://${process.env.REDIS_HOST ?? "127.0.0.1"}:${process.env.REDIS_PORT ?? "6379"}`;

    const client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: () => false,
      },
    });
    client.on("error", (error) => {
      console.warn("Redis cache unavailable for feed-service", error);
    });

    try {
      await client.connect();
      this.redisClient = client;
    } catch (error) {
      console.warn("Continuing feed-service without Redis cache", error);
      this.redisClient = null;
    }
  }

  async getFeed(request: { userId?: string; limit?: number; cursor?: string }) {
    const userId = request.userId || "demo-user";
    const limit = clampLimit(request.limit);
    const cursor = parseCursor(request.cursor);
    const cacheKey = `feed:${userId}:${limit}:${cursor}`;

    if (this.redisClient) {
      const cached = await this.redisClient.get(cacheKey);

      if (cached) {
        return JSON.parse(cached) as { items: FeedItemMessage[]; nextCursor: string };
      }
    }

    const [profile, contentResponse] = await Promise.all([
      lastValueFrom(this.profileService.getProfile({ userId })),
      lastValueFrom(this.contentService.listArticles({ limit: 50, cursor: "0" })),
    ]);

    const weights = mapWeights(profile.interestWeights);

    const enrichedItems = await Promise.all(
      contentResponse.items.map(async (article) => {
        const summary = await lastValueFrom(
          this.summaryService.summarizeArticle({
            articleId: article.id,
            title: article.title,
            body: article.body,
          }),
        );

        const category = getCategory(article, summary);

        return {
          articleId: article.id,
          score: computeArticleScore(article, summary, weights),
          reason: buildReason(category, profile.selectedTopics),
          article: {
            ...article,
            summary,
          },
        };
      }),
    );

    const rankedItems = enrichedItems.sort((left, right) => right.score - left.score);
    const pageItems = rankedItems.slice(cursor, cursor + limit);
    const nextCursor =
      cursor + pageItems.length < rankedItems.length ? String(cursor + pageItems.length) : "";

    const response = {
      items: pageItems,
      nextCursor,
    };

    if (this.redisClient) {
      await this.redisClient.set(cacheKey, JSON.stringify(response), {
        EX: 90,
      });
    }

    return response;
  }
}

const feedOrchestrator = new FeedOrchestrator();

@Controller()
class FeedGrpcController {
  @GrpcMethod("FeedService", "GetFeed")
  async getFeed(request: { userId?: string; limit?: number; cursor?: string }) {
    return feedOrchestrator.getFeed(request);
  }
}

@Controller("health")
class HealthController {
  @Get()
  getHealth() {
    return {
      service: "feed-service",
      status: "ready",
      transport: "grpc+http",
      httpPort,
      grpcPort,
    };
  }
}

@Module({
  controllers: [HealthController, FeedGrpcController],
})
class AppModule {}

async function bootstrap() {
  await feedOrchestrator.initialize();
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: "newstok.feed",
      protoPath: path.resolve(process.cwd(), "../../packages/proto/proto/feed.proto"),
      url: `0.0.0.0:${grpcPort}`,
      loader: {
        keepCase: false,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        arrays: true,
        objects: true,
      },
    },
  });
  await app.startAllMicroservices();
  await app.listen(httpPort, "0.0.0.0");
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start feed-service", error);
  process.exit(1);
});
