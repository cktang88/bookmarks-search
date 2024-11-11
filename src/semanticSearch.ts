import OpenAI from "openai";
import { Bookmark } from "./types";
import { enrichBookmarks } from "./scraper";

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

function getKeyFromBookmark(bookmark: Bookmark) {
  return "Title: " + bookmark.title + ", Summary: " + bookmark.summary;
}

export async function initializeEmbeddings(
  bookmarks: Bookmark[]
): Promise<void> {
  const enrichedBookmarks = await enrichBookmarks(bookmarks);

  const titles = enrichedBookmarks.map(getKeyFromBookmark);
  console.log(titles);
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
    ...bookmarks.map(getKeyFromBookmark),
  ]);

  const scoredBookmarks = bookmarks.map((bookmark, index) => {
    const similarity = cosineSimilarity(
      queryEmbedding,
      bookmarkEmbeddings[index]
    );
    return { ...bookmark, score: similarity };
  });

  scoredBookmarks.sort((a, b) => b.score - a.score);

  const topResults = scoredBookmarks.slice(
    0,
    Math.min(topK * 2, scoredBookmarks.length)
  );

  console.log("Reranking top results...");
  const rerankedResults = await rerank(query, topResults);

  return rerankedResults.slice(0, topK);
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

async function rerank(query: string, results: Bookmark[]): Promise<Bookmark[]> {
  console.log("Reranking with LLM...");
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that ranks bookmarks based on their relevance to a search query. Return a JSON object with a 'ranking' array containing the indices of the bookmarks in order of relevance (most relevant first).",
      },
      {
        role: "user",
        content: `Query: "${query}"

Rank these bookmarks based on their relevance to the search query:

${results
  .map(
    (b, i) => `${i + 1}. Title: ${b.title}
   Summary: ${b.summary}`
  )
  .join("\n\n")}

Provide the ranking as a JSON object with a 'ranking' array containing bookmark indices (1-based).`,
      },
    ],
  });

  const rankingData = JSON.parse(response.choices[0]?.message?.content || "{}");
  const ranking = rankingData.ranking || [];

  const rerankedResults = ranking.map((i) => results[i - 1]).filter(Boolean);

  const rankedIndices = new Set(ranking.map((i) => i - 1));
  const unrankedBookmarks = results.filter((_, i) => !rankedIndices.has(i));

  return [...rerankedResults, ...unrankedBookmarks];
}
