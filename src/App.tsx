import { useState, useEffect } from "react";
import "./App.css";

import { getBookmarksFromHTML } from "./parser";

// Bookmark type definition
type Bookmark = {
  title: string;
  url: string;
};

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
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    // Load bookmarks from HTML file
    fetch("/bookmarks/bookmarks_9_24_24.html")
      .then((response) => response.text())
      .then((html) => {
        console.log(html);
        const parsedBookmarks = getBookmarksFromHTML(html);
        setBookmarks(parsedBookmarks);
      })
      .catch((error) => console.error("Error loading bookmarks:", error));
  }, []);

  const filteredBookmarks = bookmarks.filter((bookmark) =>
    bookmark.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="app">
      <h1>Bookmarks</h1>
      <SearchBar onSearch={handleSearch} />
      <BookmarkList bookmarks={filteredBookmarks} />
    </div>
  );
}

export default App;
