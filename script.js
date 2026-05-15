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

function makeEmbed(title, watchUrl) {
  const src = youtubeEmbedUrl(watchUrl);
  if (!src) {
    const p = document.createElement("p");
    p.className = "embed-missing";
    p.textContent = `Missing or invalid YouTube URL for “${title}”.`;
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

function renderHome(entries, root) {
  root.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "song-list";
  for (const e of entries) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${encodeURIComponent(e.id)}`;
    a.textContent = e.name;
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
  songSection.append(songH, makeEmbed(entry.name, entry.youtubeWatchUrl));

  const moviesSection = document.createElement("section");
  moviesSection.className = "detail-section";
  const moviesH = document.createElement("h3");
  moviesH.textContent =
    entry.movies.length === 1 ? "In film" : "In films";
  moviesSection.append(moviesH);
  for (const m of entry.movies) {
    moviesSection.append(makeEmbed(m.name, m.youtubeWatchUrl));
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
