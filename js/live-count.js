// ==============================
// ユーティリティ
// ==============================
function normalizeText(str) {
  return String(str ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// デバウンス（入力のたびに重い処理しない）
function debounce(fn, wait = 120) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// ==============================
// JSON 読み込み
// ==============================
async function loadYears() {
  const res = await fetch("./data/index.json");
  return await res.json();
}

async function loadLives(year) {
  const res = await fetch(`./data/${year}.json`);
  return await res.json();
}

async function loadTargetLives(year) {
  if (year === "all") {
    const { years } = await loadYears();
    const allLives = [];
    for (const y of years) {
      const lives = await loadLives(y);
      allLives.push(...lives.map(live => ({ ...live, year: y })));
    }
    return allLives;
  }
  const lives = await loadLives(year);
  return lives.map(live => ({ ...live, year }));
}

// songs.raw.json を読む（配列ならOK）
async function loadSongsRaw() {
  const res = await fetch("./data/songs.raw.json");
  return await res.json();
}

// songs.raw.json の形が
// - ["曲名", ...]
// - [{title:"曲名"}, ...]
// - [{name:"曲名"}, ...]
// どれでも拾えるようにする
function extractSongTitles(raw) {
  if (!Array.isArray(raw)) return [];

  const titles = [];
  for (const item of raw) {
    if (typeof item === "string") {
      titles.push(item);
      continue;
    }
    if (item && typeof item === "object") {
      const t = item.title ?? item.name ?? item.song ?? item.label;
      if (typeof t === "string") titles.push(t);
    }
  }
  // 重複排除（表示用は元の表記で）
  const seen = new Set();
  const uniq = [];
  for (const t of titles) {
    const key = normalizeText(t);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(t);
  }
  return uniq;
}

// ==============================
// インクリメンタルサーチ（候補UI）
// ==============================
function setupIncrementalSearch({ input, suggestBox, songMaster }) {
  let activeIndex = -1;
  let currentList = [];

  function closeSuggest() {
    suggestBox.classList.remove("is-open");
    suggestBox.innerHTML = "";
    activeIndex = -1;
    currentList = [];
  }

  function openSuggest(items) {
    currentList = items;
    activeIndex = -1;

    if (items.length === 0) {
      suggestBox.innerHTML = `<div class="suggest-empty">候補なし</div>`;
      suggestBox.classList.add("is-open");
      return;
    }

    suggestBox.innerHTML = items
      .map((t, idx) => `
        <div class="suggest-item" data-idx="${idx}">
          ${escapeHtml(t)}
        </div>
      `)
      .join("");

    suggestBox.classList.add("is-open");
  }

  function highlightActive() {
    const nodes = suggestBox.querySelectorAll(".suggest-item");
    nodes.forEach(n => n.classList.remove("is-active"));
    if (activeIndex >= 0 && activeIndex < nodes.length) {
      nodes[activeIndex].classList.add("is-active");
      nodes[activeIndex].scrollIntoView({ block: "nearest" });
    }
  }

  const update = debounce(() => {
    const q = normalizeText(input.value);
    if (!q) {
      closeSuggest();
      return;
    }

    // 前方一致優先 → 部分一致
    const starts = [];
    const includes = [];

    for (const title of songMaster) {
      const n = normalizeText(title);
      if (!n) continue;

      if (n.startsWith(q)) starts.push(title);
      else if (n.includes(q)) includes.push(title);

      if (starts.length + includes.length >= 20) break;
    }

    openSuggest([...starts, ...includes].slice(0, 20));
  }, 120);

  input.addEventListener("input", update);

  // 候補クリックで確定
  suggestBox.addEventListener("click", (e) => {
    const item = e.target.closest(".suggest-item");
    if (!item) return;
    const idx = Number(item.dataset.idx);
    const title = currentList[idx];
    if (!title) return;
    input.value = title;
    closeSuggest();
    input.focus();
  });

  // キーボード操作
  input.addEventListener("keydown", (e) => {
    if (!suggestBox.classList.contains("is-open")) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentList.length - 1);
      highlightActive();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightActive();
    } else if (e.key === "Enter") {
      // 候補が選択されてたら確定してから検索させたい
      if (activeIndex >= 0 && currentList[activeIndex]) {
        e.preventDefault();
        input.value = currentList[activeIndex];
        closeSuggest();
      }
    } else if (e.key === "Escape") {
      closeSuggest();
    }
  });

  // フォーカス外クリックで閉じる
  document.addEventListener("click", (e) => {
    if (e.target === input) return;
    if (suggestBox.contains(e.target)) return;
    closeSuggest();
  });

  // フォーカス時に再表示（入力があれば）
  input.addEventListener("focus", () => {
    if (normalizeText(input.value)) update();
  });

  return { closeSuggest };
}

// ==============================
// 結果描画
// ==============================
function renderResult(container, keyword, year, matched) {
  if (matched.length === 0) {
    container.innerHTML = "<p>該当するデータがありません</p>";
    return;
  }

  const headerLabel = year === "all" ? "全期間" : `${year}年`;

  container.innerHTML = `
    <h2>${escapeHtml(headerLabel)}「${escapeHtml(keyword)}」</h2>
    <p>ライブ披露回数：${matched.length}回</p>
    <ul>
      ${matched.map(item => `
        <li>
          ${escapeHtml(item.date)} / ${escapeHtml(item.title)}（${escapeHtml(item.venue)}）
        </li>
      `).join("")}
    </ul>
  `;
}

// ==============================
// 初期化
// ==============================
async function init() {
  const yearSelect   = document.getElementById("yearSelect");
  const songInput    = document.getElementById("songInput");
  const searchButton = document.getElementById("searchButton");
  const result       = document.getElementById("result");
  const suggestBox   = document.getElementById("suggest");

  // 年度プルダウン生成
  const { years } = await loadYears();
  years.sort((a, b) => b - a).forEach(year => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });

  // songs.raw.json 読み込み → インクリメンタル用マスタ
  const raw = await loadSongsRaw();
  const songMaster = extractSongTitles(raw);

  // インクリメンタルセットアップ
  const inc = setupIncrementalSearch({
    input: songInput,
    suggestBox,
    songMaster
  });

  async function runSearch() {
    const year = yearSelect.value;
    const wordRaw = songInput.value;
    const word = normalizeText(wordRaw);

    // 候補は閉じる
    inc.closeSuggest();

    if (!word) {
      result.innerHTML = "<p>曲名を入力してください</p>";
      return;
    }

    const lives = await loadTargetLives(year);

    const matched = [];
    lives.forEach(live => {
      live.setlist?.forEach(song => {
        if (normalizeText(song.title).includes(word)) {
          matched.push({
            date: live.date,
            title: live.title,
            venue: live.venue,
            year: live.year
          });
        }
      });
    });

    renderResult(result, wordRaw, year, matched);
  }

  // クリック検索
  searchButton.addEventListener("click", runSearch);

  // Enter でも検索（入力欄）
  songInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      // 候補選択中に Enter 押したときは候補確定が優先される（setup側で preventDefault してる）
      // その場合ここに来る可能性もあるので、少しだけ遅延して検索
      setTimeout(() => runSearch(), 0);
    }
  });
}

init();
