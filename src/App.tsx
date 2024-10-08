import React, { useState, useEffect } from "react";
import { getBookmarksFromHTML } from "./parser";
import { Bookmark } from "./types";
import {
  semanticSearch,
  initializeEmbeddings,
  debouncedSemanticSearch,
} from "./semanticSearch";

// SearchBar component
function SearchBar({ onSearch }: { onSearch: (query: string) => void }) {
  return (
    <input
      type="text"
      placeholder="Search bookmarks..."
      onChange={(e) => onSearch(e.target.value)}
      className="search-bar"
    />
  );
}

// BookmarkItem component
function BookmarkItem({ bookmark }: { bookmark: Bookmark }) {
  return (
    <li className="bookmark-item">
      <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
        {bookmark.title}
      </a>
    </li>
  );
}

// BookmarkList component
function BookmarkList({ bookmarks }: { bookmarks: Bookmark[] }) {
  return (
    <ul className="bookmark-list">
      {bookmarks.map((bookmark, index) => (
        <BookmarkItem key={index} bookmark={bookmark} />
      ))}
    </ul>
  );
}
function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchResults, setSearchResults] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadBookmarks() {
      try {
        const response = await fetch("/bookmarks/bookmarks_9_24_24.html");
        const html = await response.text();
        const parsedBookmarks = getBookmarksFromHTML(html);
        setBookmarks(parsedBookmarks);

        console.log("getting initial embeddings...");

        // Initialize embeddings for all bookmarks
        await initializeEmbeddings(parsedBookmarks);

        setIsLoading(false);
      } catch (error) {
        console.error("Error loading bookmarks:", error);
        setIsLoading(false);
      }
    }

    loadBookmarks();
  }, []);

  const handleSearch = async (query: string) => {
    if (query.trim() === "") {
      setSearchResults([]);
      return;
    }

    const results = await debouncedSemanticSearch(query, bookmarks);
    setSearchResults(results);
  };

  if (isLoading) {
    return <div>Loading bookmarks...</div>;
  }

  return (
    <div className="App">
      <h1>Bookmark Search</h1>
      <SearchBar onSearch={handleSearch} />
      <BookmarkList
        bookmarks={searchResults?.length > 0 ? searchResults : bookmarks}
      />
    </div>
  );
}

export default App;
