import { inject } from "https://esm.sh/@vercel/analytics";

import { fetchEntries, makeEmbed, showLoadError } from "./embed.js";

inject();

function getSongId() {
  const id = new URLSearchParams(window.location.search).get("id");
  return id ? id.trim() : null;
}

function renderDetail(entry, root) {
  root.innerHTML = "";
  const back = document.createElement("a");
  back.className = "back";
  back.href = "index.html";
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
  moviesH.textContent = entry.movies.length === 1 ? "In film" : "In films";
  moviesSection.append(moviesH);
  for (const m of entry.movies) {
    moviesSection.append(makeEmbed(m.name, m));
  }

  root.append(back, h2, songSection, moviesSection);
}

function renderNotFound(root) {
  root.innerHTML = "";
  const back = document.createElement("a");
  back.className = "back";
  back.href = "index.html";
  back.textContent = "← All songs";
  const p = document.createElement("p");
  p.className = "error";
  p.textContent = "Song not found.";
  root.append(back, p);
  document.title = "Not found · Find Your Memory";
}

async function main() {
  const root = document.getElementById("app");
  if (!root) return;

  const id = getSongId();
  if (!id) {
    renderNotFound(root);
    return;
  }

  let entries;
  try {
    entries = await fetchEntries();
  } catch {
    showLoadError(root);
    return;
  }

  const entry = entries.find((e) => e.id === id);
  if (!entry) {
    renderNotFound(root);
    return;
  }

  renderDetail(entry, root);
  document.title = `${entry.name} · Find Your Memory`;
}

main();
