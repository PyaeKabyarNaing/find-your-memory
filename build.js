const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, "data", "entries.json");
const SITE_URL = (process.env.SITE_URL || "https://findyourmemory.com").replace(/\/+$/, "");
const PAGE_SIZE = 12;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function toJsonLd(value) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

function absoluteUrl(urlPath) {
  if (!urlPath) return SITE_URL;
  if (/^https?:\/\//i.test(urlPath)) return urlPath;
  return `${SITE_URL}/${String(urlPath).replace(/^\/+/, "")}`;
}

function songPath(entry) {
  return `song/${encodeURIComponent(entry.id)}/`;
}

function movieNames(entry) {
  return Array.isArray(entry.movies)
    ? entry.movies.map((movie) => movie.name).filter(Boolean)
    : [];
}

function descriptionForEntry(entry) {
  const names = movieNames(entry);
  if (names.length === 0) {
    return `Listen to ${entry.name} and explore where this classical piece appears in film and media.`;
  }
  const sample = names.slice(0, 3).join(", ");
  const suffix = names.length > 3 ? ", and more" : "";
  return `Listen to ${entry.name} and see scenes where it appears, including ${sample}${suffix}.`;
}

function youtubeVideoId(watchUrl) {
  try {
    const url = new URL(watchUrl);
    if (url.hostname === "youtu.be") {
      return url.pathname.replace("/", "").split("?")[0] || null;
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      if (id) return id;
      const match = url.pathname.match(/^\/embed\/([^/]+)/);
      if (match) return match[1];
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
  const match = String(html).match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

function getIframeSrc(block) {
  if (!block) return null;

  const embedSrc = block.embedSrc != null ? String(block.embedSrc).trim() : "";
  if (embedSrc) return embedSrc;

  const iframeHtml = block.iframe != null ? String(block.iframe).trim() : "";
  if (iframeHtml) {
    const fromTag = parseIframeSrc(iframeHtml);
    if (fromTag) return fromTag;
  }

  const watch = block.youtubeWatchUrl != null ? String(block.youtubeWatchUrl).trim() : "";
  if (!watch) return null;

  if (/<iframe/i.test(watch)) {
    const fromTag = parseIframeSrc(watch);
    if (fromTag) return fromTag;
  }

  try {
    const url = new URL(watch);
    if (url.pathname.toLowerCase().includes("/embed/")) {
      return url.href;
    }
  } catch {
    // Fall through to YouTube ID extraction.
  }

  const derived = youtubeEmbedUrl(watch);
  if (derived) return derived;

  try {
    const url = new URL(watch);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}

function renderEmbed(title, media) {
  const src = getIframeSrc(media);
  if (!src) {
    return `<p class="embed-missing">Missing or invalid embed for "${escapeHtml(title)}" (use embedSrc, iframe, or youtubeWatchUrl).</p>`;
  }
  return `<div class="embed">
        <p class="embed-label">${escapeHtml(title)}</p>
        <div class="embed-player"><iframe title="${escapeAttr(title)}" src="${escapeAttr(src)}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" loading="lazy"></iframe></div>
      </div>`;
}

function renderHead({ title, description, canonicalPath, imagePath, jsonLd }) {
  const canonical = absoluteUrl(canonicalPath);
  const image = absoluteUrl(imagePath || "favicon.png");
  return `<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(description)}">
    <link rel="canonical" href="${escapeAttr(canonical)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Find Your Memory">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:url" content="${escapeAttr(canonical)}">
    <meta property="og:image" content="${escapeAttr(image)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${escapeAttr(image)}">
    <link rel="icon" type="image/png" href="favicon.png">
    <link rel="stylesheet" href="styles.css">
    ${jsonLd ? `<script type="application/ld+json">${toJsonLd(jsonLd)}</script>` : ""}
</head>`;
}

function renderSongCard(entry, prefix = "") {
  const thumb = entry.thumbnail ? String(entry.thumbnail).trim() : "";
  const media = thumb
    ? `<img class="song-card__thumb" src="${escapeAttr(prefix + thumb)}" alt="${escapeAttr(`${entry.name} thumbnail`)}" loading="lazy" decoding="async">`
    : '<div class="song-card__placeholder" aria-hidden="true"></div>';
  return `<li>
          <a class="song-card" href="${escapeAttr(prefix + songPath(entry))}">
            <div class="song-card__media">${media}</div>
            <div class="song-card__body"><p class="song-card__title">${escapeHtml(entry.name)}</p></div>
          </a>
        </li>`;
}

function renderPagination(currentPage, totalPages) {
  if (totalPages <= 1) return "";
  const prev =
    currentPage <= 1
      ? '<a class="pagination__btn pagination__btn--disabled" aria-disabled="true">&lt;&lt;</a>'
      : `<a class="pagination__btn" href="index.html${currentPage === 2 ? "" : `?page=${currentPage - 1}`}">&lt;&lt;</a>`;
  const next =
    currentPage >= totalPages
      ? '<a class="pagination__btn pagination__btn--disabled" aria-disabled="true">&gt;&gt;</a>'
      : `<a class="pagination__btn" href="index.html?page=${currentPage + 1}">&gt;&gt;</a>`;
  const numbers = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    if (page === currentPage) {
      return `<li><span class="pagination__num pagination__num--current" aria-current="page">${page}</span></li>`;
    }
    return `<li><a class="pagination__num" href="index.html${page === 1 ? "" : `?page=${page}`}">${page}</a></li>`;
  }).join("\n            ");
  return `<nav class="pagination" aria-label="Song list pages">
          ${prev}
          <ol class="pagination__numbers">
            ${numbers}
          </ol>
          ${next}
        </nav>`;
}

function renderIndex(entries) {
  const title = "Find Your Memory | Music In Movies";
  const description =
    "Explore classical music and discover the films and scenes where you may have heard each piece.";

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const firstPageEntries = entries.slice(0, PAGE_SIZE);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${absoluteUrl("/")}#website`,
        url: absoluteUrl("/"),
        name: "Find Your Memory",
        alternateName: "FindYourMemory"
      },
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl("/")}#webpage`,
        url: absoluteUrl("/"),
        name: title,
        description,
        isPartOf: {
          "@id": `${absoluteUrl("/")}#website`
        },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: entries.map((entry, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(songPath(entry)),
            name: entry.name
          }))
        }
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title, description, canonicalPath: "/", imagePath: "favicon.png", jsonLd })}
<body>
    <h1>Find Your Memory</h1>

    <img src="pile.svg" class="pile" alt="">

    <main class="container" id="app">
      <div class="search-wrap">
        <div class="search">
          <label class="search__label" for="song-search">Search by Song or Film</label>
          <input type="search" id="song-search" class="search__input" placeholder="e.g. Mozart, Tom & Jerry ..." autocomplete="off" spellcheck="false">
        </div>
      </div>
      <div class="home-results">
        <ul class="song-grid">
        ${firstPageEntries.map((entry) => renderSongCard(entry)).join("\n        ")}
        </ul>
        ${renderPagination(1, totalPages)}
      </div>
    </main>
    <script type="module" src="js/home.js"></script>
</body>
</html>
`;
}

function renderSongPage(entry) {
  const title = `${entry.name} · Find Your Memory`;
  const description = descriptionForEntry(entry);
  const canonicalPath = songPath(entry);
  const movies = Array.isArray(entry.movies) ? entry.movies : [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicComposition",
    name: entry.name,
    url: absoluteUrl(canonicalPath),
    image: entry.thumbnail ? absoluteUrl(entry.thumbnail) : undefined,
    video: getIframeSrc(entry)
      ? {
          "@type": "VideoObject",
          name: entry.name,
          description,
          embedUrl: getIframeSrc(entry),
          thumbnailUrl: entry.thumbnail ? absoluteUrl(entry.thumbnail) : undefined,
        }
      : undefined,
    workExample: movies.map((movie) => ({
      "@type": "VideoObject",
      name: movie.name,
      embedUrl: getIframeSrc(movie) || undefined,
    })),
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(description)}">
    <link rel="canonical" href="${escapeAttr(absoluteUrl(canonicalPath))}">
    <meta property="og:type" content="video.other">
    <meta property="og:site_name" content="Find Your Memory">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:url" content="${escapeAttr(absoluteUrl(canonicalPath))}">
    <meta property="og:image" content="${escapeAttr(absoluteUrl(entry.thumbnail || "favicon.png"))}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${escapeAttr(absoluteUrl(entry.thumbnail || "favicon.png"))}">
    <link rel="icon" type="image/png" href="../../favicon.png">
    <link rel="stylesheet" href="../../styles.css">
    <script type="application/ld+json">${toJsonLd(jsonLd)}</script>
</head>
<body>
    <h1>Find Your Memory</h1>

    <img src="../../pile.svg" class="pile" alt="">

    <main class="container" id="app">
      <a class="back" href="../../index.html">← All songs</a>
      <h2 class="detail-title">${escapeHtml(entry.name)}</h2>
      <section class="detail-section">
        <h3>Song</h3>
        ${renderEmbed(entry.name, entry)}
      </section>
      <section class="detail-section">
        <h3>${movies.length === 1 ? "In film" : "In films"}</h3>
        ${movies.map((movie) => renderEmbed(movie.name, movie)).join("\n        ")}
      </section>
    </main>
    <script type="module" src="../../js/song.js"></script>
</body>
</html>
`;
}

function renderLegacySongPage() {
  const title = "Find Your Memory";
  const description = "Explore classical music and discover the films and scenes where you may have heard each piece.";
  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title, description, canonicalPath: "/song.html", imagePath: "favicon.png" })}
<body>
    <h1>Find Your Memory</h1>

    <img src="pile.svg" class="pile" alt="">

    <main class="container" id="app"></main>
    <script type="module" src="js/song.js"></script>
</body>
</html>
`;
}

function renderSitemap(entries) {
  const urls = ["/", ...entries.map((entry) => songPath(entry))];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeHtml(absoluteUrl(url))}</loc>
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /
Sitemap: ${absoluteUrl("sitemap.xml")}
`;
}

function removeGeneratedSongPages() {
  const songDir = path.join(ROOT, "song");
  if (fs.existsSync(songDir)) {
    fs.rmSync(songDir, { recursive: true, force: true });
  }
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

const PUBLIC = path.join(ROOT, "public");

const DEPLOY_ITEMS = [
  "index.html",
  "song.html",
  "sitemap.xml",
  "robots.txt",
  "styles.css",
  "favicon.png",
  "pile.svg",
  "js",
  "data",
  "img",
  "song",
];

function syncToPublic() {
  if (fs.existsSync(PUBLIC)) {
    fs.rmSync(PUBLIC, { recursive: true, force: true });
  }
  fs.mkdirSync(PUBLIC, { recursive: true });

  for (const item of DEPLOY_ITEMS) {
    const src = path.join(ROOT, item);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing deploy asset: ${item}`);
    }
    fs.cpSync(src, path.join(PUBLIC, item), { recursive: true });
  }
}

function main() {
  const entries = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  removeGeneratedSongPages();
  writeFile(path.join(ROOT, "index.html"), renderIndex(entries));
  writeFile(path.join(ROOT, "song.html"), renderLegacySongPage());
  for (const entry of entries) {
    writeFile(path.join(ROOT, "song", entry.id, "index.html"), renderSongPage(entry));
  }
  writeFile(path.join(ROOT, "sitemap.xml"), renderSitemap(entries));
  writeFile(path.join(ROOT, "robots.txt"), renderRobots());
  syncToPublic();
  console.log(`Generated ${entries.length} song pages with SITE_URL=${SITE_URL}`);
}

main();
