import "reflect-metadata";

import path from "node:path";

import dotenv from "dotenv";
import {
  Body,
  Controller,
  Get,
  Header,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ClientGrpc, ClientProxyFactory, Transport } from "@nestjs/microservices";
import { lastValueFrom, type Observable } from "rxjs";

import {
  getFallbackArticle,
  getFallbackFeed,
  getFallbackProfile,
  updateFallbackTopics,
} from "./fallback-data";
import { renderPreviewPage } from "./preview-page";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.example"), override: false });

const gatewayPort = Number(process.env.API_GATEWAY_PORT ?? 3000);
const contentServicePort = Number(process.env.CONTENT_SERVICE_PORT ?? 50051);
const profileServicePort = Number(process.env.PROFILE_SERVICE_PORT ?? 50052);
const feedServicePort = Number(process.env.FEED_SERVICE_PORT ?? 50053);
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
  summary?: SummaryMessage;
}

interface FeedServiceClient {
  getFeed(request: {
    userId: string;
    limit: number;
    cursor: string;
  }): Observable<{
    items: Array<{
      articleId: string;
      score: number;
      reason: string;
      article: ArticleMessage & { summary: SummaryMessage };
    }>;
    nextCursor: string;
  }>;
}

interface ContentServiceClient {
  getArticle(request: { articleId: string }): Observable<ArticleMessage>;
}

interface ProfileServiceClient {
  getProfile(request: { userId: string }): Observable<{
    userId: string;
    selectedTopics: string[];
    interestWeights: Array<{ category: string; score: number }>;
  }>;
  updateTopics(request: {
    userId: string;
    selectedTopics: string[];
  }): Observable<{
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

function normalizeCursor(cursor?: string) {
  const numeric = Number(cursor ?? "0");
  if (!Number.isFinite(numeric) || numeric < 0) {
    return "0";
  }

  return String(numeric);
}

function normalizeLimit(limit?: string) {
  const numeric = Number(limit ?? "4");
  if (!Number.isFinite(numeric) || numeric < 1) {
    return 4;
  }

  return Math.min(Math.max(Math.trunc(numeric), 1), 8);
}

function mapProfile(response: {
  userId: string;
  selectedTopics: string[];
  interestWeights: Array<{ category: string; score: number }>;
}) {
  return {
    userId: response.userId,
    selectedTopics: response.selectedTopics,
    interestWeights: response.interestWeights.reduce<Record<string, number>>(
      (accumulator, entry) => {
        accumulator[entry.category] = entry.score;
        return accumulator;
      },
      {},
    ),
  };
}

class GatewayOrchestrator {
  private feedGrpc = createGrpcClient("newstok.feed", "feed.proto", `127.0.0.1:${feedServicePort}`);
  private contentGrpc = createGrpcClient(
    "newstok.content",
    "content.proto",
    `127.0.0.1:${contentServicePort}`,
  );
  private profileGrpc = createGrpcClient(
    "newstok.profile",
    "profile.proto",
    `127.0.0.1:${profileServicePort}`,
  );
  private summaryGrpc = createGrpcClient(
    "newstok.summary",
    "summary.proto",
    `127.0.0.1:${summaryServicePort}`,
  );

  private feedService!: FeedServiceClient;
  private contentService!: ContentServiceClient;
  private profileService!: ProfileServiceClient;
  private summaryService!: SummaryServiceClient;

  async initialize() {
    this.feedService = this.feedGrpc.getService<FeedServiceClient>("FeedService");
    this.contentService = this.contentGrpc.getService<ContentServiceClient>("ContentService");
    this.profileService = this.profileGrpc.getService<ProfileServiceClient>("ProfileService");
    this.summaryService = this.summaryGrpc.getService<SummaryServiceClient>("SummaryService");
  }

  async getFeed(userId: string, cursor?: string, limit?: string) {
    const normalizedCursor = normalizeCursor(cursor);
    const normalizedLimit = normalizeLimit(limit);

    try {
      const response = await lastValueFrom(
        this.feedService.getFeed({
          userId,
          cursor: normalizedCursor,
          limit: normalizedLimit,
        }),
      );

      return {
        userId,
        items: response.items,
        nextCursor: response.nextCursor || null,
      };
    } catch (error) {
      console.warn("api-gateway: falling back to in-memory feed", error);
      return getFallbackFeed(userId, normalizedLimit, normalizedCursor);
    }
  }

  async getArticle(articleId: string) {
    try {
      const article = await lastValueFrom(this.contentService.getArticle({ articleId }));

      if (!article.id) {
        throw new NotFoundException(`Article ${articleId} was not found.`);
      }

      const summary =
        article.summary ??
        (await lastValueFrom(
          this.summaryService.summarizeArticle({
            articleId,
            title: article.title,
            body: article.body,
          }),
        ));

      return {
        ...article,
        summary,
      };
    } catch (error) {
      console.warn("api-gateway: falling back to in-memory article", error);
      const article = getFallbackArticle(articleId);

      if (!article) {
        throw new NotFoundException(`Article ${articleId} was not found.`);
      }

      return article;
    }
  }

  async getProfile(userId: string) {
    try {
      const response = await lastValueFrom(this.profileService.getProfile({ userId }));
      return mapProfile(response);
    } catch (error) {
      console.warn("api-gateway: falling back to in-memory profile", error);
      return getFallbackProfile(userId);
    }
  }

  async updateTopics(userId: string, selectedTopics: string[]) {
    try {
      const response = await lastValueFrom(
        this.profileService.updateTopics({
          userId,
          selectedTopics,
        }),
      );

      return mapProfile(response);
    } catch (error) {
      console.warn("api-gateway: falling back to in-memory topic update", error);
      return updateFallbackTopics(userId, selectedTopics);
    }
  }
}

const gatewayOrchestrator = new GatewayOrchestrator();

@Controller("health")
class HealthController {
  @Get()
  getHealth() {
    return {
      service: "api-gateway",
      status: "ready",
      transport: "rest",
      port: gatewayPort,
    };
  }
}

@Controller()
class PreviewController {
  @Get()
  @Header("Content-Type", "text/html; charset=utf-8")
  getHome() {
    return renderPreviewPage();
  }

  @Get("preview")
  @Header("Content-Type", "text/html; charset=utf-8")
  getPreview() {
    return renderPreviewPage();
  }
}

@Controller("v1")
class GatewayController {
  @Get("feed")
  async getFeed(
    @Query("userId") userId = "demo-user",
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return gatewayOrchestrator.getFeed(userId, cursor, limit);
  }

  @Get("articles/:id")
  async getArticle(@Param("id") id: string) {
    return gatewayOrchestrator.getArticle(id);
  }

  @Get("profile/:userId")
  async getProfile(@Param("userId") userId: string) {
    return gatewayOrchestrator.getProfile(userId);
  }

  @Post("profile/:userId/topics")
  async updateTopics(
    @Param("userId") userId: string,
    @Body() body: { selectedTopics?: string[] },
  ) {
    return gatewayOrchestrator.updateTopics(userId, body.selectedTopics ?? []);
  }
}

@Module({
  controllers: [HealthController, PreviewController, GatewayController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await gatewayOrchestrator.initialize();
  app.enableCors();
  await app.listen(gatewayPort, "0.0.0.0");
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start api-gateway", error);
  process.exit(1);
});
