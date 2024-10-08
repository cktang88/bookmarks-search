import OpenAI from "openai";
import { debounce } from "lodash";
import { Bookmark } from "./types";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const embeddingCache = new Map<string, number[]>();

export async function getEmbedding(text: string): Promise<number[]> {
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text)!;
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const embedding = response.data[0].embedding;
  embeddingCache.set(text, embedding);
  return embedding;
}

export async function semanticSearch(
  query: string,
  bookmarks: Bookmark[],
  topK: number = 10
): Promise<Bookmark[]> {
  const queryEmbedding = await getEmbedding(query);
  console.log(queryEmbedding);

  const scoredBookmarks = await Promise.all(
    bookmarks.map(async (bookmark) => {
      const bookmarkEmbedding = await getEmbedding(bookmark.title);
      console.log(bookmarkEmbedding);
      const similarity = cosineSimilarity(queryEmbedding, bookmarkEmbedding);
      return { ...bookmark, score: similarity };
    })
  );

  scoredBookmarks.sort((a, b) => b.score - a.score);
  return scoredBookmarks.slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, _, i) => sum + a[i] * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function rerank(
  query: string,
  results: Bookmark[]
): Promise<Bookmark[]> {
  const prompt = `Query: "${query}"\n\nRank the following bookmarks based on their relevance to the query:\n\n${results
    .map((b, i) => `${i + 1}. ${b.title}`)
    .join("\n")}\n\nProvide the ranking as a comma-separated list of numbers.`;

  const response = await openai.completions.create({
    model: "gpt-4o-mini",
    prompt: prompt,
    max_tokens: 1000,
    temperature: 0.3,
  });

  const ranking = response.choices[0].text.trim().split(",").map(Number);
  return ranking.map((i) => results[i - 1]);
}

export const debouncedSemanticSearch = debounce(semanticSearch, 1000);
