import { inject } from "https://esm.sh/@vercel/analytics";

import { fetchEntries, showLoadError } from "./embed.js";

inject();

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 200;

function makeThumbnailPlaceholder() {
  const el = document.createElement("div");
  el.className = "song-card__placeholder";
  el.setAttribute("aria-hidden", "true");
  return el;
}

function getQueryFromUrl() {
  const q = new URLSearchParams(window.location.search).get("q");
  return q != null ? q.trim() : "";
}

function pageHref(page, query) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `index.html?${qs}` : "index.html";
}

function getPageFromUrl(totalPages, query) {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("page");
  let page = parseInt(raw, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  if (raw !== null && raw !== String(page)) {
    history.replaceState(null, "", pageHref(page, query));
  }
  return page;
}

function entryMatchesQuery(entry, query) {
  const q = query.toLowerCase();
  if (entry.name && entry.name.toLowerCase().includes(q)) return true;
  if (!Array.isArray(entry.movies)) return false;
  return entry.movies.some(
    (m) => m.name && m.name.toLowerCase().includes(q)
  );
}

function filterEntries(entries, query) {
  const trimmed = query.trim();
  if (!trimmed) return entries;
  return entries.filter((e) => entryMatchesQuery(e, trimmed));
}

function renderSongCard(e) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.className = "song-card";
  a.href = `song.html?id=${encodeURIComponent(e.id)}`;

  const media = document.createElement("div");
  media.className = "song-card__media";

  const thumbPath = e.thumbnail != null ? String(e.thumbnail).trim() : "";
  if (thumbPath) {
    const img = document.createElement("img");
    img.className = "song-card__thumb";
    img.src = thumbPath;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", () => {
      img.replaceWith(makeThumbnailPlaceholder());
    });
    media.append(img);
  } else {
    media.append(makeThumbnailPlaceholder());
  }

  const body = document.createElement("div");
  body.className = "song-card__body";
  const title = document.createElement("p");
  title.className = "song-card__title";
  title.textContent = e.name;

  body.append(title);
  a.append(media, body);
  li.append(a);
  return li;
}

function renderPagination(currentPage, totalPages, query) {
  const nav = document.createElement("nav");
  nav.className = "pagination";
  nav.setAttribute("aria-label", "Song list pages");

  const prev = document.createElement("a");
  prev.className = "pagination__btn";
  prev.textContent = "<<";
  if (currentPage <= 1) {
    prev.classList.add("pagination__btn--disabled");
    prev.setAttribute("aria-disabled", "true");
    prev.removeAttribute("href");
  } else {
    prev.href = pageHref(currentPage - 1, query);
  }

  const numbers = document.createElement("ol");
  numbers.className = "pagination__numbers";
  for (let p = 1; p <= totalPages; p++) {
    const li = document.createElement("li");
    if (p === currentPage) {
      const current = document.createElement("span");
      current.className = "pagination__num pagination__num--current";
      current.textContent = String(p);
      current.setAttribute("aria-current", "page");
      li.append(current);
    } else {
      const link = document.createElement("a");
      link.className = "pagination__num";
      link.href = pageHref(p, query);
      link.textContent = String(p);
      li.append(link);
    }
    numbers.append(li);
  }

  const next = document.createElement("a");
  next.className = "pagination__btn";
  next.textContent = ">>";
  if (currentPage >= totalPages) {
    next.classList.add("pagination__btn--disabled");
    next.setAttribute("aria-disabled", "true");
    next.removeAttribute("href");
  } else {
    next.href = pageHref(currentPage + 1, query);
  }

  nav.append(prev, numbers, next);
  return nav;
}

function renderSearchBar(query, onSearch) {
  const wrap = document.createElement("div");
  wrap.className = "search";

  const label = document.createElement("label");
  label.className = "search__label";
  label.htmlFor = "song-search";
  label.textContent = "Search by Song or Film";

  const input = document.createElement("input");
  input.type = "search";
  input.id = "song-search";
  input.className = "search__input";
  input.placeholder = "e.g. Mozart, Tom & Jerry …";
  input.value = query;
  input.autocomplete = "off";
  input.spellcheck = false;

  let debounceTimer;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onSearch(input.value), SEARCH_DEBOUNCE_MS);
  });

  input.addEventListener("search", () => {
    clearTimeout(debounceTimer);
    onSearch(input.value);
  });

  wrap.append(label, input);
  return wrap;
}

function renderResults(entries, query, resultsRoot, scrollToTop) {
  resultsRoot.innerHTML = "";

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = getPageFromUrl(totalPages, query);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageEntries = entries.slice(start, start + PAGE_SIZE);

  if (query && entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = `No songs matched “${query}”.`;
    resultsRoot.append(empty);
    return;
  }

  const list = document.createElement("ul");
  list.className = "song-grid";
  for (const e of pageEntries) {
    list.append(renderSongCard(e));
  }
  resultsRoot.append(list);

  if (totalPages > 1) {
    resultsRoot.append(renderPagination(currentPage, totalPages, query));
  }

  if (scrollToTop && currentPage > 1) {
    window.scrollTo(0, 0);
  }
}

function mountHome(allEntries, root) {
  root.innerHTML = "";

  const searchRoot = document.createElement("div");
  searchRoot.className = "search-wrap";
  const resultsRoot = document.createElement("div");
  resultsRoot.className = "home-results";

  root.append(searchRoot, resultsRoot);

  function update(scrollToTop = false) {
    const query = getQueryFromUrl();
    const filtered = filterEntries(allEntries, query);
    renderResults(filtered, query, resultsRoot, scrollToTop);
  }

  function onSearch(value) {
    const trimmed = value.trim();
    const next = pageHref(1, trimmed);
    history.pushState(null, "", next);
    update(false);
  }

  searchRoot.append(renderSearchBar(getQueryFromUrl(), onSearch));
  update(true);

  window.addEventListener("popstate", () => {
    const input = root.querySelector("#song-search");
    const query = getQueryFromUrl();
    if (input && input.value !== query) input.value = query;
    update(true);
  });
}

async function main() {
  const root = document.getElementById("app");
  if (!root) return;

  try {
    const entries = await fetchEntries();
    mountHome(entries, root);
  } catch {
    showLoadError(root);
  }
}

main();
