export const DATA_URL = "data/entries.json";

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

export function getIframeSrc(block) {
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

export function makeEmbed(title, media) {
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

export async function fetchEntries() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function showLoadError(root) {
  root.innerHTML =
    '<p class="error">Could not load song data. Serve this site over HTTP (e.g. a local dev server) so <code>data/entries.json</code> can load.</p>';
}
