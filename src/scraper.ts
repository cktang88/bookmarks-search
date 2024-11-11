import FirecrawlApp from "@mendable/firecrawl-js";
import OpenAI from "openai";
import { Bookmark } from "./types";
import {
  getCachedData,
  setCachedData,
  ScrapedDataCacheEntry,
} from "./cache/scrapedDataCache";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const firecrawl = new FirecrawlApp({
  apiKey: import.meta.env.VITE_FIRECRAWL_API_KEY,
});

// NOTE: firecrawl can't scrape social media
const UNSCRAPABLE_DOMAINS = ["twitter.com", "youtube.com"];

interface ScrapedResult {
  url: string;
  markdown: string;
}

async function batchScrapeUrls(
  urls: string[]
): Promise<ScrapedDataCacheEntry[]> {
  const results: ScrapedDataCacheEntry[] = [];

  // First, fill in cached and unscrapable results
  urls.forEach((url, index) => {
    if (UNSCRAPABLE_DOMAINS.some((domain) => url.includes(domain))) {
      results[index] = {
        url,
        markdown: "This content cannot be scraped",
        lastScraped: new Date().toISOString(),
      };
    } else {
      const cachedData = getCachedData(url);
      if (cachedData) {
        results[index] = cachedData;
      }
    }
  });

  // Collect URLs that need scraping
  const urlsToScrape = urls.filter((url, index) => {
    return (
      !results[index] &&
      !UNSCRAPABLE_DOMAINS.some((domain) => url.includes(domain))
    );
  });

  // If we have URLs to scrape
  if (urlsToScrape.length > 0) {
    try {
      const scrapedData = await firecrawl.batchScrapeUrls(urlsToScrape, {
        formats: ["markdown"],
        onlyMainContent: true,
        excludeTags: ["script", "style", "header", "footer", "nav", "aside"],
        timeout: 5000,
      });

      if (!scrapedData.success) {
        throw new Error(`Failed to scrape batch: ${scrapedData.error}`);
      }

      // Create a map of URL to scraped content for easy lookup
      const scrapedMap = new Map<string, string>();
      scrapedData.data.forEach((result: ScrapedResult) => {
        if (result.markdown) {
          scrapedMap.set(result.url, result.markdown);
        }
      });

      // Fill in the scraped results in the correct positions
      urls.forEach((url, index) => {
        if (!results[index] && scrapedMap.has(url)) {
          const entry: ScrapedDataCacheEntry = {
            url,
            markdown: scrapedMap.get(url)!,
            lastScraped: new Date().toISOString(),
          };
          results[index] = entry;
          setCachedData(entry);
        }
      });
    } catch (error) {
      console.error("Error in batch scraping:", error);
      throw error;
    }
  }

  // Fill any remaining gaps with placeholder content
  urls.forEach((url, index) => {
    if (!results[index]) {
      results[index] = {
        url,
        markdown: "Failed to scrape content",
        lastScraped: new Date().toISOString(),
      };
    }
  });

  return results;
}

export async function enrichBookmarks(
  bookmarks: Bookmark[]
): Promise<Bookmark[]> {
  const enrichedBookmarks: Bookmark[] = [];
  const chunkSize = 10;

  for (let i = 0; i < bookmarks.length; i += chunkSize) {
    const chunk = bookmarks.slice(i, i + chunkSize);
    try {
      const urls = chunk.map((bookmark) => bookmark.url);
      console.log("Processing batch", Math.floor(i / chunkSize) + 1);

      // Get scraped data (from cache or fresh)
      const scrapedResults = await batchScrapeUrls(urls);

      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that summarizes scraped pages for bookmarks. Respond with a JSON object containing a 'bookmarks' array, where each entry has the index and summary extracted from the scraped content.",
          },
          {
            role: "user",
            content: `Generate a short SEO paragraph summary of the content of the following scraped pages. Be sure to include all subpoints and if it has many different topics (eg. a blog), then be sure to note all the different topics:

${scrapedResults
  .map(
    (result, index) => `
${index + 1}. URL: ${result.url}
Content: ${result.markdown}
`
  )
  .join("\n")}`,
          },
        ],
      });

      const summaryData = JSON.parse(
        gptResponse.choices[0]?.message?.content || "[]"
      );

      summaryData?.bookmarks?.forEach(
        (item: { index: number; summary: string }) => {
          const bookmarkIndex = i + (item.index - 1);
          enrichedBookmarks[bookmarkIndex] = {
            ...bookmarks[bookmarkIndex],
            summary: item.summary,
          };
        }
      );

      console.log(
        `Processed batch ${Math.floor(i / chunkSize) + 1}, enriched ${
          chunk.length
        } bookmarks`
      );
    } catch (error) {
      console.error("Error processing batch:", error);
      chunk.forEach((bookmark, index) => {
        enrichedBookmarks[i + index] = bookmark;
      });
    }

    // Rate limiting delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return enrichedBookmarks;
}
