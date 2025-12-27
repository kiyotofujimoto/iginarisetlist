// ==============================
// HTMLエスケープ
// ==============================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39
/**
 * 検索用の正規化
 * - 大文字/小文字を区別しない
 * - 全角英数や記号の揺れを寄せる（NFKC）
 * - 前後空白除去
 */
function normalizeText(str) {
  return String(str ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}


// ==============================
// JSON 読み込み系
// ==============================

/**
 * data/index.json を読み込み
 * 例: { "years": [2025, 2026] }
 */
async function loadYears() {
  const res = await fetch("./data/index.json");
  if (!res.ok) throw new Error("index.json load failed");
  return await res.json();
}

/**
 * 指定した年のライブデータを読み込む
 * 例: data/2025.json
 */
async function loadLives(year) {
  const res = await fetch(`./data/${year}.json`);
  if (!res.ok) throw new Error(`${year}.json load failed`);
  return await res.json();
}

/**
 * 検索対象となるライブ一覧を取得
 * - year === "all" の場合は全年度分を結合
 * - それ以外は指定年のみ
 * 各ライブに year を付与する
 */
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

/**
 * 曲マスタ（songs.raw.json）を読み込む
 */
async function loadSongsRaw() {
  const res = await fetch("./data/songs.raw.json");
  if (!res.ok) throw new Error("songs.raw.json load failed");
  return await res.json();
}

// ==============================
// 曲名抽出ユーティリティ
// ==============================

/**
 * songs.raw.json の中身がどんな形でも
 * 「曲名らしき文字列配列」を取り出す
 */
function extractSongTitles(raw) {
  if (Array.isArray(raw)) return extractFromArray(raw);

  if (raw && typeof raw === "object") {
    const candidates =
      raw.songs ??
      raw.titles ??
      raw.items ??
      raw.data ??
      raw.list ??
      raw.results;

    if (Array.isArray(candidates)) return extractFromArray(candidates);

    // 1段ネストしている場合も拾う
    for (const v of Object.values(raw)) {
      if (Array.isArray(v)) return extractFromArray(v);
      if (v && typeof v === "object") {
        for (const vv of Object.values(v)) {
          if (Array.isArray(vv)) return extractFromArray(vv);
        }
      }
    }
  }

  return [];
}



/**
 * 配列から曲名を抽出
 * - string
 * - { title / name / song / label }
 */
function extractFromArray(arr) {
  const titles = [];

  for (const item of arr) {
    if (typeof item === "string") {
      titles.push(item);
      continue;
    }

    if (item && typeof item === "object") {
      const t = item.title ?? item.name ?? item.song ?? item.label;
      if (typeof t === "string") titles.push(t);
    }
  }

  return titles.filter(t => t.trim() !== "");
}

// ==============================
// インクリメンタルサーチ UI
// ==============================

/**
 * 曲名入力欄にインクリメンタルサーチを付与する
 * - 入力に応じて候補を表示
 * - キーボード / マウス操作対応
 */
function setupIncrementalSearch({ input, suggestBox, songMaster }) {
  let currentList = [];
  let activeIndex = -1;

  /** 候補UIを閉じる */
  function closeSuggest() {
    suggestBox.classList.remove("is-open");
    suggestBox.innerHTML = "";
    currentList = [];
    activeIndex = -1;
  }

  /** 候補UIを表示 */
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

  /** キーボード操作時のハイライト制御 */
  function highlightActive() {
    const nodes = suggestBox.querySelectorAll(".suggest-item");
    nodes.forEach(n => n.classList.remove("is-active"));

    if (activeIndex >= 0 && activeIndex < nodes.length) {
      nodes[activeIndex].classList.add("is-active");
      nodes[activeIndex].scrollIntoView({ block: "nearest" });
    }
  }

  // 入力時に候補を更新
    input.addEventListener("input", () => {
    const qRaw = input.value;
    const q = normalizeText(qRaw);

    // 空なら閉じる
    if (!q) {
      closeSuggest();
      return;
    }

    // 正規化した文字列同士で includes（最大20件）
    const items = [];
    for (const title of songMaster) {
      if (normalizeText(title).includes(q)) items.push(title);
      if (items.length >= 20) break;
    }

    openSuggest(items);
  });


  // 候補クリックで確定（mousedownでblur防止）
  suggestBox.addEventListener("mousedown", e => {
    const item = e.target.closest(".suggest-item");
    if (!item) return;

    e.preventDefault();
    input.value = currentList[item.dataset.idx];
    closeSuggest();
    input.focus();
  });

  // キーボード操作
  input.addEventListener("keydown", e => {
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
      if (activeIndex >= 0) {
        e.preventDefault();
        input.value = currentList[activeIndex];
        closeSuggest();
      }
    } else if (e.key === "Escape") {
      closeSuggest();
    }
  });

  // フォーカス外クリックで閉じる
  document.addEventListener("click", e => {
    if (e.target === input) return;
    if (suggestBox.contains(e.target)) return;
    closeSuggest();
  });

  return { closeSuggest };
}

// ==============================
// 検索結果描画
// ==============================

/**
 * 検索結果を画面に描画
 */
function renderResult(container, word, year, matched) {
  if (matched.length === 0) {
    container.innerHTML = "<p>該当するデータがありません</p>";
    return;
  }

  const label = year === "all" ? "全期間" : `${year}年`;

  container.innerHTML = `
    <h2>${label}「${escapeHtml(word)}」</h2>
    <p>ライブ披露回数：${matched.length}回</p>
    <ul>
      ${matched.map(item => `
        <li>${item.date} / ${item.title}</li>
      `).join("")}
    </ul>
  `;
}

// ==============================
// 初期化
// ==============================

/**
 * 画面起動時に一度だけ実行される
 * - 年度プルダウン生成
 * - 曲マスタ読み込み
 * - イベント登録
 */
async function init() {
  const yearSelect = document.getElementById("yearSelect");
  const songInput = document.getElementById("songInput");
  const searchButton = document.getElementById("searchButton");
  const result = document.getElementById("result");
  const suggestBox = document.getElementById("suggest");

  const { years } = await loadYears();
  years.sort((a, b) => b - a).forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });

  const raw = await loadSongsRaw();
  const songMaster = extractSongTitles(raw);

  const inc = setupIncrementalSearch({
    input: songInput,
    suggestBox,
    songMaster
  });

  async function runSearch() {
    inc.closeSuggest();

    const wordRaw = songInput.value;
    const word = normalizeText(wordRaw);
    if (normalizeText(song.title).includes(word)) {
      result.innerHTML = "<p>曲名を入力してください</p>";
      return;
    }

    const lives = await loadTargetLives(yearSelect.value);
    const matched = [];

    for (const live of lives) {
      for (const song of (live.setlist ?? [])) {
        if (song.title.includes(word)) {
          matched.push({
            date: live.date,
            title: live.title,
            venue: live.venue
          });
        }
      }
    }

    renderResult(result, word, yearSelect.value, matched);
  }

  searchButton.addEventListener("click", runSearch);
  songInput.addEventListener("keydown", e => {
    if (e.key === "Enter") setTimeout(runSearch, 0);
  });
}

init();
