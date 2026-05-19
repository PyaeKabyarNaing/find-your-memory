import { inject } from 'https://esm.sh/@vercel/analytics';
 
inject();

const DATA_URL = "data/entries.json";

function youtubeVideoId(watchUrl) {
  try {
    const u = new URL(watchUrl);
    if (u.hostname === "youtu.be") {
      return u.pathname.replace("/", "").split("?")[0] || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/^\/embed\/([^/]+)/);
      if (m) return m[1];
    }
  } catch {
    return null;
  }
  return null;
}

function youtubeEmbedUrl(watchUrl) {
  const id = youtubeVideoId(watchUrl);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

function parseIframeSrc(html) {
  const m = String(html).match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].trim());
  } catch {
    return m[1].trim();
  }
}

/** Resolve iframe src from entry / movie object. Supports embedSrc, iframe HTML, youtubeWatchUrl, and pasted embed snippets in youtubeWatchUrl. */
function getIframeSrc(block) {
  if (!block) return null;

  const embedSrc = block.embedSrc != null ? String(block.embedSrc).trim() : "";
  if (embedSrc) return embedSrc;

  const iframeHtml = block.iframe != null ? String(block.iframe).trim() : "";
  if (iframeHtml) {
    const fromTag = parseIframeSrc(iframeHtml);
    if (fromTag) return fromTag;
  }

  const watch =
    block.youtubeWatchUrl != null ? String(block.youtubeWatchUrl).trim() : "";
  if (!watch) return null;

  if (/<iframe/i.test(watch)) {
    const fromTag = parseIframeSrc(watch);
    if (fromTag) return fromTag;
  }

  try {
    const u = new URL(watch);
    if (u.pathname.toLowerCase().includes("/embed/")) {
      return u.href;
    }
  } catch {
    /* fall through */
  }

  const derived = youtubeEmbedUrl(watch);
  if (derived) return derived;

  try {
    const u = new URL(watch);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.href;
    }
  } catch {
    return null;
  }
  return null;
}

function makeEmbed(title, media) {
  const src = getIframeSrc(media);
  if (!src) {
    const p = document.createElement("p");
    p.className = "embed-missing";
    p.textContent = `Missing or invalid embed for “${title}” (use embedSrc, iframe, or youtubeWatchUrl).`;
    return p;
  }
  const wrap = document.createElement("div");
  wrap.className = "embed";
  const cap = document.createElement("p");
  cap.className = "embed-label";
  cap.textContent = title;
  const player = document.createElement("div");
  player.className = "embed-player";
  const frame = document.createElement("iframe");
  frame.title = title;
  frame.src = src;
  frame.setAttribute("allowfullscreen", "");
  frame.setAttribute(
    "allow",
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  );
  frame.loading = "lazy";
  player.append(frame);
  wrap.append(cap, player);
  return wrap;
}

function makeThumbnailPlaceholder() {
  const el = document.createElement("div");
  el.className = "song-card__placeholder";
  el.setAttribute("aria-hidden", "true");
  return el;
}

function renderHome(entries, root) {
  root.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "song-grid";
  for (const e of entries) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "song-card";
    a.href = `#${encodeURIComponent(e.id)}`;

    const media = document.createElement("div");
    media.className = "song-card__media";

    const thumbPath =
      e.thumbnail != null ? String(e.thumbnail).trim() : "";
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
    list.append(li);
  }
  root.append(list);
}

function renderDetail(entry, root) {
  root.innerHTML = "";
  const back = document.createElement("a");
  back.className = "back";
  back.href = "#";
  back.textContent = "← All songs";

  const h2 = document.createElement("h2");
  h2.className = "detail-title";
  h2.textContent = entry.name;

  const songSection = document.createElement("section");
  songSection.className = "detail-section";
  const songH = document.createElement("h3");
  songH.textContent = "Song";
  songSection.append(songH, makeEmbed(entry.name, entry));

  const moviesSection = document.createElement("section");
  moviesSection.className = "detail-section";
  const moviesH = document.createElement("h3");
  moviesH.textContent =
    entry.movies.length === 1 ? "In film" : "In films";
  moviesSection.append(moviesH);
  for (const m of entry.movies) {
    moviesSection.append(makeEmbed(m.name, m));
  }

  root.append(back, h2, songSection, moviesSection);
}

function getRouteId() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  return raw ? decodeURIComponent(raw) : null;
}

async function main() {
  const root = document.getElementById("app");
  if (!root) return;

  let entries;
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(String(res.status));
    entries = await res.json();
  } catch {
    root.innerHTML =
      "<p class=\"error\">Could not load song data. Serve this site over HTTP (e.g. a local dev server) so <code>data/entries.json</code> can load.</p>";
    return;
  }

  function route() {
    const id = getRouteId();
    if (!id) {
      renderHome(entries, root);
      document.title = "Find Your Memory";
      return;
    }
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      renderHome(entries, root);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    renderDetail(entry, root);
    document.title = `${entry.name} · Find Your Memory`;
  }

  window.addEventListener("hashchange", route);
  route();
}

main();
