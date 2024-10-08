import OpenAI from "openai";
import { Bookmark } from "./types";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const embeddingCache = new Map<string, number[]>();

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const uncachedTexts = texts.filter((text) => !embeddingCache.has(text));

  if (uncachedTexts.length > 0) {
    console.log(
      "getting more embeddings for " + uncachedTexts.length + " items"
    );
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: uncachedTexts,
    });

    response.data.forEach((item, index) => {
      embeddingCache.set(uncachedTexts[index], item.embedding);
    });
  }

  return texts.map((text) => embeddingCache.get(text)!);
}

function getKey(bookmark: Bookmark) {
  return (
    bookmark.title +
    " " +
    bookmark.url
      .replaceAll("/", " ")
      .replaceAll("https:", " ")
      .replaceAll("-", " ")
  );
}

export async function initializeEmbeddings(
  bookmarks: Bookmark[]
): Promise<void> {
  const titles = bookmarks.map(getKey);
  for (let i = 0; i < titles.length; i += 100) {
    const chunk = titles.slice(i, i + 100);
    console.log(chunk);
    await getEmbeddings(chunk);
  }
}

export async function semanticSearch(
  query: string,
  bookmarks: Bookmark[],
  topK: number = 50
): Promise<Bookmark[]> {
  const [queryEmbedding, ...bookmarkEmbeddings] = await getEmbeddings([
    query,
    ...bookmarks.map(getKey),
  ]);

  const scoredBookmarks = bookmarks.map((bookmark, index) => {
    const similarity = cosineSimilarity(
      queryEmbedding,
      bookmarkEmbeddings[index]
    );
    return { ...bookmark, score: similarity };
  });

  scoredBookmarks.sort((a, b) => b.score - a.score);
  return scoredBookmarks.slice(0, topK);
}

function dotProduct(vecA: number[], vecB: number[]) {
  let product = 0;
  for (let i = 0; i < vecA.length; i++) {
    product += vecA[i] * vecB[i];
  }
  return product;
}

function magnitude(vec: number[]) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  return dotProduct(vecA, vecB) / (magnitude(vecA) * magnitude(vecB));
}

export async function rerank(
  query: string,
  results: Bookmark[]
): Promise<Bookmark[]> {
  console.log("doing reranking...");
  const prompt = `Query: "${query}"\n\nRank the following bookmarks based on their relevance to the query:\n\n${results
    .map((b, i) => `${i + 1}. ${getKey(b)}`)
    .join("\n")}\n\nProvide the ranking as a comma-separated list of numbers.`;

  const response = await openai.completions.create({
    model: "gpt-4o",
    prompt: prompt,
    max_tokens: 1000,
    temperature: 0.3,
  });

  const ranking = response.choices[0].text.trim().split(",").map(Number);
  return ranking.map((i) => results[i - 1]);
}
