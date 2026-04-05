import "reflect-metadata";

import path from "node:path";

import dotenv from "dotenv";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { GrpcMethod, MicroserviceOptions, Transport } from "@nestjs/microservices";

import { ContentRepository } from "./content.repository";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.example"), override: false });

const httpPort = Number(process.env.CONTENT_SERVICE_HTTP_PORT ?? 3101);
const grpcPort = Number(process.env.CONTENT_SERVICE_PORT ?? 50051);
const contentRepository = new ContentRepository();

@Controller()
class ContentGrpcController {
  @GrpcMethod("ContentService", "ListArticles")
  async listArticles(request: { limit?: number; cursor?: string }) {
    const response = await contentRepository.listArticles(
      request.limit ?? 20,
      request.cursor ?? "0",
    );

    return {
      items: response.items.map((article) => ({
        id: article.id,
        source: article.source,
        title: article.title,
        body: article.body,
        imageUrl: article.imageUrl,
        publishedAt: article.publishedAt,
        summary: article.summary,
      })),
      nextCursor: response.nextCursor,
    };
  }

  @GrpcMethod("ContentService", "GetArticle")
  async getArticle(request: { articleId: string }) {
    const article = await contentRepository.getArticle(request.articleId);

    if (!article) {
      return {
        id: "",
        source: "",
        title: "",
        body: "",
        imageUrl: "",
        publishedAt: "",
      };
    }

    return {
      id: article.id,
      source: article.source,
      title: article.title,
      body: article.body,
      imageUrl: article.imageUrl,
      publishedAt: article.publishedAt,
      summary: article.summary,
    };
  }
}

@Controller("health")
class HealthController {
  @Get()
  getHealth() {
    return {
      service: "content-service",
      status: "ready",
      transport: "grpc+http",
      httpPort,
      grpcPort,
    };
  }
}

@Module({
  controllers: [HealthController, ContentGrpcController],
})
class AppModule {}

async function bootstrap() {
  await contentRepository.initialize();

  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: "newstok.content",
      protoPath: path.resolve(process.cwd(), "../../packages/proto/proto/content.proto"),
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
  console.error("Failed to start content-service", error);
  process.exit(1);
});
