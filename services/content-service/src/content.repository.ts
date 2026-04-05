import { Pool } from "pg";

import { demoArticles, type Category, type DemoArticle } from "./demo-articles";

export interface ArticleSummaryRecord {
  title: string;
  summaryShort: string;
  category: Category;
}

export interface ArticleRecord {
  id: string;
  source: string;
  title: string;
  body: string;
  imageUrl: string;
  publishedAt: string;
  category: Category;
  summary?: ArticleSummaryRecord;
}

interface ArticleRow {
  id: string;
  source: string;
  title: string;
  body: string;
  image_url: string;
  published_at: Date | string;
  category: Category;
  summary_title: string | null;
  summary_short: string | null;
  summary_category: Category | null;
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

function firstSentence(text: string) {
  const [sentence] = text.split(". ");
  return sentence.trim().replace(/\.+$/, "");
}

function buildFallbackSummary(article: DemoArticle | ArticleRecord): ArticleSummaryRecord {
  const compact = firstSentence(article.body);
  const snippet = compact.length > 140 ? `${compact.slice(0, 137)}...` : `${compact}.`;

  return {
    title: article.title,
    summaryShort: snippet,
    category: article.category,
  };
}

function mapRow(row: ArticleRow): ArticleRecord {
  const baseRecord: ArticleRecord = {
    id: row.id,
    source: row.source,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    publishedAt:
      row.published_at instanceof Date
        ? row.published_at.toISOString()
        : new Date(row.published_at).toISOString(),
    category: row.category,
  };

  if (row.summary_title && row.summary_short && row.summary_category) {
    return {
      ...baseRecord,
      summary: {
        title: row.summary_title,
        summaryShort: row.summary_short,
        category: row.summary_category,
      },
    };
  }

  return {
    ...baseRecord,
    summary: buildFallbackSummary(baseRecord),
  };
}

export class ContentRepository {
  private readonly pool = new Pool({
    connectionString: getDatabaseUrl(),
  });
  private useMemory = false;
  private readonly memoryArticles: ArticleRecord[] = [...demoArticles]
    .sort((left, right) => {
      return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
    })
    .map((article) => ({
      id: article.id,
      source: article.source,
      title: article.title,
      body: article.body,
      imageUrl: article.imageUrl,
      publishedAt: article.publishedAt,
      category: article.category,
      summary: buildFallbackSummary(article),
    }));

  async initialize() {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.pool.query("SELECT 1");
        break;
      } catch (error) {
        if (attempt === 3) {
          this.useMemory = true;
          console.warn(
            "content-service: PostgreSQL unavailable, using in-memory demo articles.",
          );
          return;
        }

        await sleep(800);
      }
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        image_url TEXT NOT NULL,
        published_at TIMESTAMPTZ NOT NULL,
        category TEXT NOT NULL
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS article_summaries (
        article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        summary_short TEXT NOT NULL,
        category TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.seedDemoArticles();
  }

  async seedDemoArticles() {
    if (this.useMemory) {
      return;
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      for (const article of demoArticles) {
        await client.query(
          `
            INSERT INTO articles (
              id,
              source,
              title,
              body,
              image_url,
              published_at,
              category
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              source = EXCLUDED.source,
              title = EXCLUDED.title,
              body = EXCLUDED.body,
              image_url = EXCLUDED.image_url,
              published_at = EXCLUDED.published_at,
              category = EXCLUDED.category;
          `,
          [
            article.id,
            article.source,
            article.title,
            article.body,
            article.imageUrl,
            article.publishedAt,
            article.category,
          ],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listArticles(limit: number, cursor: string) {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20;
    const offset = Number.isFinite(Number(cursor)) ? Math.max(Number(cursor), 0) : 0;

    if (this.useMemory) {
      const items = this.memoryArticles.slice(offset, offset + safeLimit);
      const nextCursor =
        offset + items.length < this.memoryArticles.length ? String(offset + items.length) : "";

      return {
        items,
        nextCursor,
      };
    }

    const [{ rows }, { rows: countRows }] = await Promise.all([
      this.pool.query<ArticleRow>(
        `
          SELECT
            a.id,
            a.source,
            a.title,
            a.body,
            a.image_url,
            a.published_at,
            a.category,
            s.title AS summary_title,
            s.summary_short,
            s.category AS summary_category
          FROM articles a
          LEFT JOIN article_summaries s ON s.article_id = a.id
          ORDER BY a.published_at DESC
          LIMIT $1 OFFSET $2;
        `,
        [safeLimit, offset],
      ),
      this.pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM articles;`),
    ]);

    const total = Number(countRows[0]?.total ?? "0");
    const items = rows.map(mapRow);
    const nextCursor = offset + items.length < total ? String(offset + items.length) : "";

    return {
      items,
      nextCursor,
    };
  }

  async getArticle(articleId: string) {
    if (this.useMemory) {
      return this.memoryArticles.find((article) => article.id === articleId) ?? null;
    }

    const result = await this.pool.query<ArticleRow>(
      `
        SELECT
          a.id,
          a.source,
          a.title,
          a.body,
          a.image_url,
          a.published_at,
          a.category,
          s.title AS summary_title,
          s.summary_short,
          s.category AS summary_category
        FROM articles a
        LEFT JOIN article_summaries s ON s.article_id = a.id
        WHERE a.id = $1
        LIMIT 1;
      `,
      [articleId],
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async close() {
    if (this.useMemory) {
      return;
    }

    await this.pool.end();
  }
}
