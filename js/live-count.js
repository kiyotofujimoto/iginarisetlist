// ==============================
// HTMLエスケープ
// ==============================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 検索用の正規化
 * - 大文字/小文字を区別しない
 * - 全角英数や記号の揺れを寄せる（NFKC）
 * - 前後空白除去
 */
function normalizeText(str) {
  return String(str ?? "").normalize("NFKC").toLowerCase().trim();
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
      allLives.push(...lives.map((live) => ({ ...live, year: y })));
    }
    return allLives;
  }

  const lives = await loadLives(year);
  return lives.map((live) => ({ ...live, year }));
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
      raw.songs ?? raw.titles ?? raw.items ?? raw.data ?? raw.list ?? raw.results;

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

  return titles.filter((t) => t.trim() !== "");
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
      .map(
        (t, idx) => `
          <div class="suggest-item" data-idx="${idx}">
            ${escapeHtml(t)}
          </div>
        `
      )
      .join("");

    suggestBox.classList.add("is-open");
  }

  /** キーボード操作時のハイライト制御 */
  function highlightActive() {
    const nodes = suggestBox.querySelectorAll(".suggest-item");
    nodes.forEach((n) => n.classList.remove("is-active"));

    if (activeIndex >= 0 && activeIndex < nodes.length) {
      nodes[activeIndex].classList.add("is-active");
      nodes[activeIndex].scrollIntoView({ block: "nearest" });
    }
  }

// 入力時に候補を更新（前方一致のみ）
input.addEventListener("input", () => {
  const q = normalizeText(input.value);

  if (!q) {
    closeSuggest();
    return;
  }

  const items = [];
  for (const title of songMaster) {
    if (normalizeText(title).startsWith(q)) {
      items.push(title);
      if (items.length >= 20) break;
    }
  }

  openSuggest(items);
});



  // 候補クリックで確定（mousedownでblur防止）
  suggestBox.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".suggest-item");
    if (!item) return;

    e.preventDefault();
    input.value = currentList[item.dataset.idx];
    closeSuggest();
    input.focus();

    // 候補クリックで value が変わっても input イベントは発火しないので、
    // ボタン文言更新用にカスタムイベントを投げる（ロジックには影響なし）
    input.dispatchEvent(new Event("songvaluechange"));
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
      if (activeIndex >= 0) {
        e.preventDefault();
        input.value = currentList[activeIndex];
        closeSuggest();

        // Enterで確定した時も同様にボタン文言更新
        input.dispatchEvent(new Event("songvaluechange"));
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

  return { closeSuggest };
}

// ==============================
// 検索結果描画
// ==============================

/**
 * 披露回数（検索結果）を描画
 */
function renderResult(container, word, year, matched) {
  if (!matched || matched.length === 0) {
    container.innerHTML = `<p class="empty-message">該当するデータがありません</p>`;
    return;
  }

  const label = year === "all" ? "全期間" : `${year}年`;

  container.innerHTML = `
    <div class="result-card">
      <div class="result-title">
      <span class="result-tag">${escapeHtml(label)}</span>
      <span class="result-tag result-tag-song">${escapeHtml(word)}</span></div>
      <div class="result-count">ライブ披露回数：<span class="count-number">${matched.length}</span> 回</div>
      <ul class="result-list">
        ${matched
          .map(
            (item) => `
              <li class="result-item">
              <div class="result-date">${escapeHtml(item.date)}</div> <div class="result-live">${escapeHtml(item.title)}</div>
              </li>
            `).join("")}
      </ul>
    </div>
  `;
}

// ==============================
// ランキング描画（TOP10折りたたみ + 順位表示）
// ==============================

function renderRanking(container, year, ranking, opts = {}) {
  const {
    initialTop = 10,   // 初期表示
    expandedTop = 40,  // 展開時表示（多すぎると重いので40推奨）
  } = opts;

  if (!Array.isArray(ranking) || ranking.length === 0) {
    container.innerHTML = `<p class="empty-message">該当するデータがありません</p>`;
    return;
  }

  const label = (year === "all") ? "全期間" : `${year}年`;

  // 折りたたみ状態：デフォで閉じる
  let expanded = false;

  // ランキングの1行を作る（順位付き）
  const renderRows = (list) => {
    return list.map((item, idx) => {
      const name = escapeHtml(item.title);
      const count = Number(item.count) || 0;
      const rankNo = idx + 1;

      return `
        <li class="rank-item">
          <span class="rank-no">${rankNo}</span>
          <span class="rank-name">${name}</span>
          <span class="rank-count">${count}回</span>
        </li>
      `;
    }).join("");
  };

  // メイン描画関数（状態に応じて再描画）
  const paint = () => {
    const total = ranking.length;
    const showN = expanded ? Math.min(expandedTop, total) : Math.min(initialTop, total);
    const shown = ranking.slice(0, showN);

    const canToggle = total > initialTop;
    const toggleText = expanded ? "閉じる" : "もっと見る";
    const subText = expanded
      ? `上位${showN}曲 / 全${total}曲`
      : `上位${showN}曲 / 全${total}曲`;

    container.innerHTML = `
      <div class="result-card">
        <h2 class="result-title">${label} 楽曲ランキング</h2>
        <p class="result-count">${escapeHtml(subText)}</p>

        <ol class="rank-list">
          ${renderRows(shown)}
        </ol>

        ${canToggle ? `
          <button type="button" class="primary-button rank-toggle" data-action="toggle">
            ${toggleText}
          </button>
        ` : ""}
      </div>
    `;
  };

  // イベント委譲でトグル（毎回innerHTMLで作り直すから）
  const onClick = (e) => {
    const btn = e.target.closest(".rank-toggle");
    if (!btn) return;
    expanded = !expanded;
    paint();
  };

  // 既存ハンドラが二重登録されるのを避ける（同一containerを使い回す前提）
  container.removeEventListener("click", onClick);
  container.addEventListener("click", onClick);

  paint();
}


// ==============================
// 初期化
// ==============================

/**
 * 画面起動時に一度だけ実行される
 * - 年度プルダウン生成
 * - 曲マスタ読み込み
 * - インクリメンタル付与
 * - 検索/リセットのイベント登録
 * - ★検索ボタン文言の切り替え（追加）
 */
async function init() {
  const yearSelect = document.getElementById("yearSelect");
  const songInput = document.getElementById("songInput");
  const searchButton = document.getElementById("searchButton");
  const resetButton = document.getElementById("resetButton");
  const result = document.getElementById("result");
  const suggestBox = document.getElementById("suggest");

  // ============================
  // ★追加：ボタン文言の切り替え
  // ============================
  function updateSearchButtonLabel() {
    const q = normalizeText(songInput.value);
    searchButton.textContent = q ? "検索" : "ランキングを見る";
  }

  // 年度プルダウン生成
  const { years } = await loadYears();
  years
    .sort((a, b) => b - a)
    .forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });

  // 曲マスタ読み込み
  const raw = await loadSongsRaw();
  const songMaster = extractSongTitles(raw);

  // インクリメンタルセットアップ
  const inc = setupIncrementalSearch({
    input: songInput,
    suggestBox,
    songMaster,
  });

  // 条件リセットボタン
  resetButton.addEventListener("click", () => {
    yearSelect.value = "all"; // 全期間に戻す
    songInput.value = ""; // 曲名クリア
    inc.closeSuggest(); // 候補閉じる
    result.innerHTML = ""; // 結果消す
    window.scrollTo({ top: 0, behavior: "smooth" }); // 任意：上に戻す

    // ★追加：リセット後にボタン文言も更新
    updateSearchButtonLabel();
  });

  // 検索（曲名あり: 披露回数 / 曲名なし: ランキング）
  async function runSearch() {
    inc.closeSuggest();

    const year = yearSelect.value;
    const qRaw = songInput.value;
    const q = normalizeText(qRaw);

    const lives = await loadTargetLives(year);

    // 曲名が空 → ランキング
    if (!q) {
      const counts = new Map(); // key: 正規化, value: { title, count }

      for (const live of lives) {
        for (const song of live.setlist ?? []) {
          const title = String(song.title ?? "").trim();
          if (!title) continue;

          const key = normalizeText(title);
          if (!key) continue;

          const prev = counts.get(key);
          if (prev) {
            prev.count += 1;
          } else {
            counts.set(key, { title, count: 1 });
          }
        }
      }

      const ranking = Array.from(counts.values()).sort((a, b) => b.count - a.count);
      renderRanking(result, year, ranking, { initialTop: 10, expandedTop: 40 });
      return;
    }

    // 曲名あり （部分一致）
    const matched = [];
    for (const live of lives) {
      for (const song of live.setlist ?? []) {
        const t = String(song.title ?? "");
        if (normalizeText(t).includes(q)) {
          matched.push({
            date: live.date,
            title: live.title,
            venue: live.venue,
          });
        }
      }
    }

    renderResult(result, qRaw, year, matched);
  }

  // イベント登録
  searchButton.addEventListener("click", runSearch);
  songInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") setTimeout(runSearch, 0);
  });

  // ★追加：入力に応じてボタン文言を切り替え
  songInput.addEventListener("input", updateSearchButtonLabel);
  songInput.addEventListener("songvaluechange", updateSearchButtonLabel);

  // 初期表示時も反映
  updateSearchButtonLabel();
}

init();
