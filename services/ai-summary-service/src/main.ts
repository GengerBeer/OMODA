import "reflect-metadata";

import path from "node:path";

import dotenv from "dotenv";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { GrpcMethod, MicroserviceOptions, Transport } from "@nestjs/microservices";

import { SummaryRepository } from "./summary.repository";
import { summarizeArticle as generateSummary } from "./summarizer";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.example"), override: false });

const httpPort = Number(process.env.AI_SUMMARY_SERVICE_HTTP_PORT ?? 3104);
const grpcPort = Number(process.env.AI_SUMMARY_SERVICE_PORT ?? 50054);
const summaryRepository = new SummaryRepository();

@Controller()
class SummaryGrpcController {
  @GrpcMethod("SummaryService", "SummarizeArticle")
  async summarizeArticle(request: { articleId: string; title: string; body: string }) {
    const existingSummary = request.articleId
      ? await summaryRepository.findSummary(request.articleId)
      : null;

    if (existingSummary) {
      return existingSummary;
    }

    const summary = generateSummary(request.title, request.body);

    if (request.articleId) {
      await summaryRepository.upsertSummary(request.articleId, summary);
    }

    return summary;
  }
}

@Controller("health")
class HealthController {
  @Get()
  getHealth() {
    return {
      service: "ai-summary-service",
      status: "ready",
      transport: "grpc+http",
      httpPort,
      grpcPort,
    };
  }
}

@Module({
  controllers: [HealthController, SummaryGrpcController],
})
class AppModule {}

async function bootstrap() {
  await summaryRepository.initialize();

  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: "newstok.summary",
      protoPath: path.resolve(process.cwd(), "../../packages/proto/proto/summary.proto"),
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
  console.error("Failed to start ai-summary-service", error);
  process.exit(1);
});
