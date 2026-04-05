import "reflect-metadata";

import path from "node:path";

import dotenv from "dotenv";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { GrpcMethod, MicroserviceOptions, Transport } from "@nestjs/microservices";

import { ProfileRepository } from "./profile.repository";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.example"), override: false });

const httpPort = Number(process.env.PROFILE_SERVICE_HTTP_PORT ?? 3102);
const grpcPort = Number(process.env.PROFILE_SERVICE_PORT ?? 50052);
const profileRepository = new ProfileRepository();

@Controller()
class ProfileGrpcController {
  @GrpcMethod("ProfileService", "GetProfile")
  async getProfile(request: { userId: string }) {
    const profile = await profileRepository.getProfile(request.userId || "demo-user");

    return {
      userId: profile.userId,
      selectedTopics: profile.selectedTopics,
      interestWeights: Object.entries(profile.interestWeights).map(([category, score]) => ({
        category,
        score,
      })),
    };
  }

  @GrpcMethod("ProfileService", "UpdateTopics")
  async updateTopics(request: { userId: string; selectedTopics: string[] }) {
    const profile = await profileRepository.updateTopics(
      request.userId || "demo-user",
      request.selectedTopics ?? [],
    );

    return {
      userId: profile.userId,
      selectedTopics: profile.selectedTopics,
      interestWeights: Object.entries(profile.interestWeights).map(([category, score]) => ({
        category,
        score,
      })),
    };
  }
}

@Controller("health")
class HealthController {
  @Get()
  getHealth() {
    return {
      service: "profile-service",
      status: "ready",
      transport: "grpc+http",
      httpPort,
      grpcPort,
    };
  }
}

@Module({
  controllers: [HealthController, ProfileGrpcController],
})
class AppModule {}

async function bootstrap() {
  await profileRepository.initialize();

  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: "newstok.profile",
      protoPath: path.resolve(process.cwd(), "../../packages/proto/proto/profile.proto"),
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
  console.error("Failed to start profile-service", error);
  process.exit(1);
});
