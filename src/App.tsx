import React, { useState, useEffect } from "react";
import { getBookmarksFromHTML } from "./parser";
import { Bookmark } from "./types";
import { semanticSearch, initializeEmbeddings } from "./semanticSearch";

// Updated SearchBar component
function SearchBar({
  onSearch,
  onClear,
}: {
  onSearch: (query: string) => void;
  onClear: () => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onSearch(inputValue);
    }
  };

  const handleClear = () => {
    setInputValue("");
    onClear();
  };

  return (
    <div className="search-container">
      <input
        type="text"
        placeholder="Search bookmarks..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress}
        className="search-bar"
      />
      <button onClick={handleClear} className="clear-button">
        See All Bookmarks
      </button>
    </div>
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
        const parsedBookmarks = getBookmarksFromHTML(html).slice(0, 100); // testing with N bookmarks
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

    setIsLoading(true);
    const results = await semanticSearch(query, bookmarks);
    setSearchResults(results);
    setIsLoading(false);
  };

  const handleClear = () => {
    setSearchResults([]);
  };

  if (isLoading) {
    return <div>Loading bookmarks...</div>;
  }

  return (
    <div className="App">
      <h1>Bookmark Search</h1>
      <SearchBar onSearch={handleSearch} onClear={handleClear} />
      <BookmarkList
        bookmarks={searchResults.length > 0 ? searchResults : bookmarks}
      />
    </div>
  );
}

export default App;
