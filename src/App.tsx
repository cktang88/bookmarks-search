import { useState, useEffect } from "react";
import "./App.css";

import { getBookmarksFromHTML } from "./parser";
import { debouncedSemanticSearch, rerank } from "./semanticSearch";
import { Bookmark } from "./types";

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

// Main App component
function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchResults, setSearchResults] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Load bookmarks from HTML file
    fetch("/bookmarks/bookmarks_9_24_24.html")
      .then((response) => response.text())
      .then((html) => {
        const parsedBookmarks = getBookmarksFromHTML(html);
        setBookmarks(parsedBookmarks);
      })
      .catch((error) => console.error("Error loading bookmarks:", error));
  }, []);

  const handleSearch = async (query: string) => {
    if (query.trim() === "") {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const semanticResults = await debouncedSemanticSearch(query, bookmarks);
      console.log(semanticResults);
      if (semanticResults) {
        const rerankedResults = await rerank(query, semanticResults);
        console.log(rerankedResults);
        setSearchResults(rerankedResults);
      }
    } catch (error) {
      console.error("Error during semantic search:", error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <h1>Bookmarks</h1>
      <SearchBar onSearch={handleSearch} />
      {isLoading ? (
        <p>Searching...</p>
      ) : (
        <BookmarkList
          bookmarks={searchResults.length > 0 ? searchResults : bookmarks}
        />
      )}
    </div>
  );
}

export default App;
