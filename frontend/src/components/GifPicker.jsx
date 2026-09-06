import { useEffect, useRef, useState } from "react";
import { SearchIcon, LoaderIcon } from "lucide-react";

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY;

// Embedded mode renders only the results grid + the required GIPHY attribution;
// AttachmentPicker owns the outer panel and drives search through `query`.
// Standalone mode keeps its own box, search form, and Close button.
function GifPicker({ onSelect, onClose, embedded = false, query: externalQuery = "" }) {
  const [localQuery, setLocalQuery] = useState("");
  const query = embedded ? externalQuery : localQuery;
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // Guards against a slow earlier request landing after a newer one and
  // overwriting fresher results with stale ones.
  const requestId = useRef(0);

  const search = async (q) => {
    if (!GIPHY_KEY) return;
    const id = ++requestId.current;
    setIsLoading(true);
    try {
      const endpoint = q.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(
            q
          )}&limit=18&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=18&rating=pg-13`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (id === requestId.current) setResults(data.data || []);
    } catch {
      if (id === requestId.current) setResults([]);
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  };

  // Trending loads on open so the picker is never a blank panel. Runs once.
  useEffect(() => {
    search("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search as you type, debounced so a burst of keystrokes fires one request —
  // same 300ms feel as the add-people typeahead. Driven by the local input in
  // standalone mode and by the shared search bar in embedded mode.
  useEffect(() => {
    if (!GIPHY_KEY) return;
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const noKey = (
    <div className="p-4 text-sm text-slate-400">
      GIF search needs a free Giphy API key. Get one at{" "}
      <a
        href="https://developers.giphy.com/"
        target="_blank"
        rel="noreferrer"
        className="text-cyan-400 underline"
      >
        developers.giphy.com
      </a>{" "}
      and set it as <code className="text-cyan-300">VITE_GIPHY_API_KEY</code> in your frontend
      .env file.
    </div>
  );

  const resultsGrid = (
    <div className="flex-1 overflow-y-auto p-2">
      {isLoading ? (
        <div className="flex items-center justify-center h-full text-slate-500">
          <LoaderIcon className="w-5 h-5 animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">
          {query.trim() ? "No GIFs found. Try another search." : "No trending GIFs right now."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {results.map((gif) => (
            <button
              key={gif.id}
              type="button"
              onClick={() => onSelect(gif.images.fixed_height.url)}
              className="rounded overflow-hidden bg-slate-900/40 hover:opacity-80 transition-opacity"
            >
              <img
                src={gif.images.fixed_height_small.url}
                alt={gif.title || "GIF"}
                loading="lazy"
                className="w-full h-20 object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="h-full flex flex-col">
        {!GIPHY_KEY ? (
          noKey
        ) : (
          <>
            {resultsGrid}
            {/* Giphy's API terms require visible attribution wherever their
                content is shown. */}
            <div className="px-3 py-1.5 border-t border-slate-700">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                Powered by GIPHY
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 left-0 w-80 h-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 flex flex-col">
      {!GIPHY_KEY ? (
        noKey
      ) : (
        <>
          <form
            className="p-2 border-b border-slate-700 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search(localQuery);
            }}
          >
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                autoFocus
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search GIFs…"
                className="w-full bg-slate-900/60 text-sm text-slate-200 rounded pl-7 pr-2 py-1 outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </form>

          {resultsGrid}

          {/* Giphy's API terms require visible attribution wherever their
              content is shown. */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Powered by GIPHY
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default GifPicker;
