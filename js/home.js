import { inject } from "https://esm.sh/@vercel/analytics";

import { fetchEntries, showLoadError } from "./embed.js";

inject();

const PAGE_SIZE = 12;

function makeThumbnailPlaceholder() {
  const el = document.createElement("div");
  el.className = "song-card__placeholder";
  el.setAttribute("aria-hidden", "true");
  return el;
}

function pageHref(page) {
  return page <= 1 ? "index.html" : `index.html?page=${page}`;
}

function getPageFromUrl(totalPages) {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("page");
  let page = parseInt(raw, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  if (raw !== null && raw !== String(page)) {
    history.replaceState(null, "", pageHref(page));
  }
  return page;
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

function renderPagination(currentPage, totalPages) {
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
    prev.href = pageHref(currentPage - 1);
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
      link.href = pageHref(p);
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
    next.href = pageHref(currentPage + 1);
  }

  nav.append(prev, numbers, next);
  return nav;
}

function renderHome(entries, root) {
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = getPageFromUrl(totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageEntries = entries.slice(start, start + PAGE_SIZE);

  root.innerHTML = "";

  const list = document.createElement("ul");
  list.className = "song-grid";
  for (const e of pageEntries) {
    list.append(renderSongCard(e));
  }
  root.append(list);

  if (totalPages > 1) {
    root.append(renderPagination(currentPage, totalPages));
  }

  if (currentPage > 1) {
    window.scrollTo(0, 0);
  }
}

async function main() {
  const root = document.getElementById("app");
  if (!root) return;

  try {
    const entries = await fetchEntries();
    renderHome(entries, root);
  } catch {
    showLoadError(root);
  }
}

main();
