import { HistoryItem } from "./types";

export function getBookmarksFromHTML(htmlContent: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  const bookmarks = [];

  // Find all <A> tags (bookmarks)
  const links = doc.getElementsByTagName("A");

  for (const link of links) {
    const url = link.getAttribute("HREF");
    const title = link.textContent.trim();

    if (url && title) {
      bookmarks.push({ url, title });
    }
  }

  return bookmarks;
}

export function getHistoryFromJSON(jsonContent: string): HistoryItem[] {
  const history = JSON.parse(jsonContent);
  return history.map((item) => ({
    id: item.id,
    isLocal: item.isLocal,
    referringVisitId: item.referringVisitId,
    transition: item.transition,
    visitId: item.visitId,
    visitTime: item.visitTime,
    title: item.title,
    lastVisitTime: item.lastVisitTime,
    typedCount: item.typedCount,
    url: item.url,
    visitCount: item.visitCount,
  }));
}
