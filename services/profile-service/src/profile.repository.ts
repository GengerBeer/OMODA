import { Pool } from "pg";

type Category =
  | "world"
  | "technology"
  | "business"
  | "science"
  | "sports"
  | "culture";

export interface ProfileRecord {
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

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    "postgres://newstok:newstok@127.0.0.1:5432/newstok"
  );
}

async function sleep(durationMs: number) {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}

function normalizeTopics(topics: string[]): Category[] {
  const uniqueTopics = new Set<Category>();

  for (const topic of topics) {
    if (allCategories.includes(topic as Category)) {
      uniqueTopics.add(topic as Category);
    }
  }

  if (uniqueTopics.size === 0) {
    return ["technology", "business", "science"];
  }

  return Array.from(uniqueTopics);
}

function buildInterestWeights(selectedTopics: Category[]): Record<Category, number> {
  const selected = new Set(selectedTopics);

  return allCategories.reduce<Record<Category, number>>((accumulator, category) => {
    accumulator[category] = selected.has(category) ? 1 : 0.35;
    return accumulator;
  }, {} as Record<Category, number>);
}

function mapRow(row: {
  user_id: string;
  selected_topics: string[] | null;
  interest_weights: Record<Category, number> | null;
}): ProfileRecord {
  const selectedTopics = normalizeTopics(row.selected_topics ?? []);

  return {
    userId: row.user_id,
    selectedTopics,
    interestWeights: row.interest_weights ?? buildInterestWeights(selectedTopics),
  };
}

export class ProfileRepository {
  private readonly pool = new Pool({
    connectionString: getDatabaseUrl(),
  });
  private useMemory = false;
  private readonly memoryProfiles = new Map<string, ProfileRecord>();

  async initialize() {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.pool.query("SELECT 1");
        break;
      } catch (error) {
        if (attempt === 3) {
          this.useMemory = true;
          console.warn(
            "profile-service: PostgreSQL unavailable, using in-memory demo profiles.",
          );
          await this.ensureDemoProfile();
          return;
        }

        await sleep(800);
      }
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id TEXT PRIMARY KEY,
        selected_topics TEXT[] NOT NULL,
        interest_weights JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.ensureDemoProfile();
  }

  async ensureDemoProfile() {
    const selectedTopics = normalizeTopics(["technology", "business", "science"]);
    const interestWeights = buildInterestWeights(selectedTopics);

    if (this.useMemory) {
      this.memoryProfiles.set("demo-user", {
        userId: "demo-user",
        selectedTopics,
        interestWeights,
      });
      return;
    }

    await this.pool.query(
      `
        INSERT INTO user_profiles (user_id, selected_topics, interest_weights)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET
          selected_topics = EXCLUDED.selected_topics,
          interest_weights = EXCLUDED.interest_weights,
          updated_at = NOW();
      `,
      ["demo-user", selectedTopics, JSON.stringify(interestWeights)],
    );
  }

  async getProfile(userId: string) {
    if (this.useMemory) {
      const existingProfile = this.memoryProfiles.get(userId);

      if (existingProfile) {
        return existingProfile;
      }

      const selectedTopics = normalizeTopics([]);
      const interestWeights = buildInterestWeights(selectedTopics);
      const profile = {
        userId,
        selectedTopics,
        interestWeights,
      };

      this.memoryProfiles.set(userId, profile);
      return profile;
    }

    const result = await this.pool.query<{
      user_id: string;
      selected_topics: string[] | null;
      interest_weights: Record<Category, number> | null;
    }>(
      `
        SELECT user_id, selected_topics, interest_weights
        FROM user_profiles
        WHERE user_id = $1
        LIMIT 1;
      `,
      [userId],
    );

    if (result.rows[0]) {
      return mapRow(result.rows[0]);
    }

    const selectedTopics = normalizeTopics([]);
    const interestWeights = buildInterestWeights(selectedTopics);

    await this.pool.query(
      `
        INSERT INTO user_profiles (user_id, selected_topics, interest_weights)
        VALUES ($1, $2, $3::jsonb);
      `,
      [userId, selectedTopics, JSON.stringify(interestWeights)],
    );

    return {
      userId,
      selectedTopics,
      interestWeights,
    };
  }

  async updateTopics(userId: string, topics: string[]) {
    const selectedTopics = normalizeTopics(topics);
    const interestWeights = buildInterestWeights(selectedTopics);

    if (this.useMemory) {
      const profile = {
        userId,
        selectedTopics,
        interestWeights,
      };
      this.memoryProfiles.set(userId, profile);
      return profile;
    }

    await this.pool.query(
      `
        INSERT INTO user_profiles (user_id, selected_topics, interest_weights)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET
          selected_topics = EXCLUDED.selected_topics,
          interest_weights = EXCLUDED.interest_weights,
          updated_at = NOW();
      `,
      [userId, selectedTopics, JSON.stringify(interestWeights)],
    );

    return {
      userId,
      selectedTopics,
      interestWeights,
    };
  }

  async close() {
    if (this.useMemory) {
      return;
    }

    await this.pool.end();
  }
}
