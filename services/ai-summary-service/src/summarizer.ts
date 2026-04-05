import type { Category, SummaryRecord } from "./summary.repository";

const categoryKeywords: Record<Category, string[]> = {
  world: ["border", "global", "port", "regional", "international", "agency"],
  technology: ["ai", "chip", "device", "software", "sensor", "platform", "data"],
  business: ["market", "capital", "finance", "startup", "revenue", "investment"],
  science: ["research", "lab", "battery", "chemistry", "telescope", "study"],
  sports: ["league", "club", "player", "coach", "match", "season"],
  culture: ["museum", "film", "art", "culture", "studio", "performance"],
};

function inferCategory(input: string): Category {
  const normalized = input.toLowerCase();
  let bestMatch: Category = "world";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(categoryKeywords) as Array<
    [Category, string[]]
  >) {
    const score = keywords.reduce((total, keyword) => {
      return total + (normalized.includes(keyword) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = category;
    }
  }

  return bestMatch;
}

function truncateWords(text: string, count: number) {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length <= count) {
    return text.trim();
  }

  return `${words.slice(0, count).join(" ")}...`;
}

export function summarizeArticle(title: string, body: string): SummaryRecord {
  const normalizedTitle = title.trim();
  const normalizedBody = body.trim();
  const category = inferCategory(`${normalizedTitle} ${normalizedBody}`);
  const firstSentence = normalizedBody.split(". ")[0]?.replace(/\.+$/, "") ?? normalizedBody;

  return {
    title: normalizedTitle,
    summaryShort: truncateWords(firstSentence, 20),
    category,
  };
}
