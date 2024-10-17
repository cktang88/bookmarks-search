import OpenAI from "openai";
import { Bookmark, HistoryItem } from "./types";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const embeddingCache = new Map<string, number[]>();

export async function enrichBookmarks(
  bookmarks: Bookmark[]
): Promise<Bookmark[]> {
  const enrichedBookmarks: Bookmark[] = [];
  const chunkSize = 100;

  for (let i = 0; i < bookmarks.length; i += chunkSize) {
    const chunk = bookmarks.slice(i, i + chunkSize);
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that provides relevant keywords for bookmarks. Respond with a raw JSON array, with one entry per bookmark, where each entry is an object containing the index of the bookmark and its keywords.",
          },
          {
            role: "user",
            content: `Provide a comma-separated list of 7-8 relevant targeted SEO keywords or short phrases for each of the following browser bookmarks. Consider both the site domain and the bookmark title for each.

${chunk
  .map(
    (bookmark, index) => `
${i + index + 1}. Title: ${bookmark.title}
   URL: ${bookmark.url}
`
  )
  .join("\n")}
`,
          },
        ],
      });

      const keywordsData = JSON.parse(
        response.choices[0]?.message?.content || "[]"
      );

      keywordsData?.bookmarks?.forEach(
        (item: { index: number; keywords: string[] }) => {
          const bookmarkIndex = i + item.index - 1;
          enrichedBookmarks[bookmarkIndex] = {
            ...bookmarks[bookmarkIndex],
            keywords: item.keywords,
          };
        }
      );
      console.log(enrichedBookmarks);
    } catch (error) {
      console.error("Error enriching bookmarks:", error);
      // Add the original bookmarks without keywords if there's an error
      chunk.forEach((bookmark, index) => {
        enrichedBookmarks[i + index] = bookmark;
      });
    }
  }

  return enrichedBookmarks;
}

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
  return (
    "Title: " + bookmark.title + ", Keywords: " + bookmark.keywords?.join(", ")
  );
}

function getKeyFromHistoryItem(historyItem: HistoryItem) {
  return (
    historyItem.title +
    " " +
    historyItem.url
      .replaceAll("/", " ")
      .replaceAll("https:", " ")
      .replaceAll("-", " ")
      .replaceAll("www.", " ")
  );
}

export async function initializeEmbeddings(
  bookmarks: Bookmark[]
): Promise<void> {
  const enrichedBookmarks = await enrichBookmarks(bookmarks);

  const titles = enrichedBookmarks.map(getKeyFromBookmark);
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
  const prompt = `Query: "${query}"\n\nRank the following browser bookmarks based on their relevance to the user's search query (most relevant first):\n\n${results
    .map((b, i) => `${i + 1}. ${getKeyFromBookmark(b)}`)
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
