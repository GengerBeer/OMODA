import { Pool } from "pg";

export type Category =
  | "world"
  | "technology"
  | "business"
  | "science"
  | "sports"
  | "culture";

export interface SummaryRecord {
  title: string;
  summaryShort: string;
  category: Category;
}

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    "postgres://newstok:newstok@127.0.0.1:5432/newstok"
  );
}

async function sleep(durationMs: number) {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}

export class SummaryRepository {
  private readonly pool = new Pool({
    connectionString: getDatabaseUrl(),
  });
  private useMemory = false;
  private readonly memorySummaries = new Map<string, SummaryRecord>();

  async initialize() {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.pool.query("SELECT 1");
        break;
      } catch (error) {
        if (attempt === 3) {
          this.useMemory = true;
          console.warn(
            "ai-summary-service: PostgreSQL unavailable, using in-memory summaries.",
          );
          return;
        }

        await sleep(800);
      }
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS article_summaries (
        article_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary_short TEXT NOT NULL,
        category TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async findSummary(articleId: string) {
    if (this.useMemory) {
      return this.memorySummaries.get(articleId) ?? null;
    }

    const result = await this.pool.query<{
      title: string;
      summary_short: string;
      category: Category;
    }>(
      `
        SELECT title, summary_short, category
        FROM article_summaries
        WHERE article_id = $1
        LIMIT 1;
      `,
      [articleId],
    );

    const row = result.rows[0];
    return row
      ? {
          title: row.title,
          summaryShort: row.summary_short,
          category: row.category,
        }
      : null;
  }

  async upsertSummary(articleId: string, summary: SummaryRecord) {
    if (this.useMemory) {
      this.memorySummaries.set(articleId, summary);
      return summary;
    }

    await this.pool.query(
      `
        INSERT INTO article_summaries (article_id, title, summary_short, category)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (article_id) DO UPDATE SET
          title = EXCLUDED.title,
          summary_short = EXCLUDED.summary_short,
          category = EXCLUDED.category,
          updated_at = NOW();
      `,
      [articleId, summary.title, summary.summaryShort, summary.category],
    );

    return summary;
  }
}
