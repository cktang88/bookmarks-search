export type Bookmark = {
  title: string;
  url: string;
  keywords?: string[];
};

/*
format:
{
    "id": "40470",
    "isLocal": true,
    "referringVisitId": "0",
    "transition": "link",
    "visitId": "113547",
    "visitTime": 1729100713238.728,
    "title": "Export Chrome History - Chrome Web Store",
    "lastVisitTime": 1729100713238.728,
    "typedCount": 0,
    "url": "https://chromewebstore.google.com/detail/export-chrome-history/dihloblpkeiddiaojbagoecedbfpifdj",
    "visitCount": 14
  }
*/
export type HistoryItem = {
  id: string;
  isLocal: boolean;
  referringVisitId: string;
  transition: string;
  visitId: string;
  visitTime: number;
  title: string;
  lastVisitTime: number;
  typedCount: number;
  url: string;
  visitCount: number;
};
