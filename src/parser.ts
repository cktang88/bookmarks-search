export function getBookmarksFromHTML(htmlContent: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
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

// Usage example (you can remove this if not needed)
// async function fetchAndParseBookmarks(url: string) {
//   try {
//     const response = await fetch(url);
//     const htmlContent = await response.text();
//     const bookmarks = await getBookmarksFromHTML(htmlContent);
//     console.log(bookmarks);
//     console.log(bookmarks.length);
//   } catch (error) {
//     console.error("Error fetching or processing bookmarks:", error);
//   }
// }

// Uncomment the following line if you want to test the function
// fetchAndParseBookmarks("/bookmarks/bookmarks_9_24_24.html");
