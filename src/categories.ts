// puts bookmarks and history items into categories

import { Bookmark, HistoryItem } from "./types";
import OpenAI from "openai";

const fixedCategories = [
  "Movies",
  "Books",
  "Music",
  "Podcasts",
  "Games",
  "News",
  "Twitter",
  "Youtube",
  "Productivity",
];

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

async function getCategoriesForBookmark(bookmark: Bookmark): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that categorizes bookmarks.",
        },
        {
          role: "user",
          content: `Categorize the following bookmark into one or more of these categories: ${fixedCategories.join(
            ", "
          )}. Respond with only the category names, separated by commas.

Title: ${bookmark.title}
URL: ${bookmark.url}`,
        },
      ],
    });

    const categories = response.choices[0]?.message?.content?.split(",") || [];
    return categories
      .map((category) => category.trim())
      .filter((category) => fixedCategories.includes(category));
  } catch (error) {
    console.error("Error categorizing bookmark:", error);
    return [];
  }
}

export async function categorizeBookmarks(
  bookmarks: Bookmark[]
): Promise<Map<string, Bookmark[]>> {
  const categories = new Map<string, Bookmark[]>();

  for (const bookmark of bookmarks) {
    const bookmarkCategories = await getCategoriesForBookmark(bookmark);

    for (const category of bookmarkCategories) {
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)?.push(bookmark);
    }
  }

  return categories;
}
