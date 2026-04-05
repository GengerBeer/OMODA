import path from "node:path";

import dotenv from "dotenv";

import { ContentRepository } from "./content.repository";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.example"), override: false });

async function seed() {
  const repository = new ContentRepository();
  await repository.initialize();
  await repository.close();
  console.log("Seeded demo articles into PostgreSQL.");
}

seed().catch((error: unknown) => {
  console.error("Failed to seed demo articles", error);
  process.exit(1);
});
