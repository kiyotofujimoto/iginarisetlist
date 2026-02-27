// ==============================
// グローバル状態
// ==============================

// 選択中の年度の「全ライブ一覧」
let lives = [];

// フィルタ・検索後のライブ一覧（liveSelect の候補）
let filteredLives = [];

// 現在選択中のライブ形態（未選択なら空文字）
let selectedType = "";

// 曲名検索ワード（未入力なら空文字）
let searchWord = "";

// ★追加：ライブ名検索ワード（未入力なら空文字）
let liveSearchWord = "";


// ==============================
// JSON読み込み系
// ==============================

/**
 * 年度一覧（index.json）を読み込む
 * 例: { "years": [2024, 2025, 2026] }
 */
async function loadYears() {
  const res = await fetch("./data/index.json");
  if (!res.ok) throw new Error("index.json load failed");
  return await res.json();
}

/**
 * 指定した年度のライブJSONを読み込む
 * 例: data/2025.json
 */
async function loadYear(year) {
  const res = await fetch(`./data/${year}.json`);
  if (!res.ok) throw new Error(`${year}.json load failed`);
  return await res.json();
}


// ==============================
// 文字列正規化ユーティリティ
// ==============================

/**
 * 文字列を検索用に正規化
 * - 大文字/小文字を無視
 * - 全角/半角を吸収（NFKC）
 * - 前後空白を除去
 */
function normalizeText(str) {
  return String(str ?? "").toLowerCase().normalize("NFKC").trim();
}


// ==============================
// 日付表示用ユーティリティ
// ==============================

/**
 * "2025.09.13" → "2025.09.13（土）"
 */
function formatDateWithDay(dateStr) {
  const formatted = dateStr.replace(/\./g, "-");
  const date = new Date(formatted);

  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const day = days[date.getDay()];

  return `${dateStr}（${day}）`;
}


// ==============================
// プルダウン描画系
// ==============================

/**
 * 形態プルダウンを生成する
 * lives に含まれる type を重複なしで抽出
 */
function renderTypeSelect() {
  const typeSelect = document.getElementById("typeSelect");
  typeSelect.innerHTML = `<option value="">-- 全て --</option>`;

  // typeが無いデータが混じっても落ちないように保険
  const types = [...new Set(lives.map((l) => l.type).filter(Boolean))];

  types.forEach((type) => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type;
    typeSelect.appendChild(opt);
  });
}

/**
 * ライブプルダウンを生成する
 * filteredLives を元に表示する
 */
function renderLiveSelect() {
  const select = document.getElementById("liveSelect");
  select.innerHTML = `<option value="">-- 選択してください --</option>`;

  filteredLives.forEach((live) => {
    const opt = document.createElement("option");
    opt.value = live.id;
    opt.textContent = `${live.date} / ${live.title}`;
    select.appendChild(opt);
  });
}


// ==============================
// フィルタ処理（超重要）
// ==============================

/**
 * 年度・形態・ライブ名検索・曲名検索をすべて AND 条件で適用する
 * - 結果は filteredLives に入り、liveSelect の候補になる
 */
function applyFilters() {
  const wordSong = normalizeText(searchWord);
  const wordLive = normalizeText(liveSearchWord);

  filteredLives = lives.filter((live) => {
    // 形態フィルタ
    if (selectedType && live.type !== selectedType) return false;

    // ★ライブ名検索（部分一致）
    if (wordLive) {
      const t = normalizeText(live.title);
      if (!t.includes(wordLive)) return false;
    }

    // 曲名検索（部分一致）
    if (wordSong) {
      return (live.setlist ?? []).some((song) =>
        normalizeText(song?.title).includes(wordSong)
      );
    }

    return true;
  });

  renderLiveSelect();
}


// ==============================
// ライブ詳細表示
// ==============================

/**
 * 選択されたライブのセットリストを表示
 */
function renderResult(live) {
  const result = document.getElementById("result");

  result.innerHTML = `
    <div class="live-card">
      <div class="live-date">${formatDateWithDay(live.date)}</div>
      <div class="live-title">${live.title}</div>

      <div class="live-meta">
        ${live.venue} ・ ${live.type}
      </div>

      <ol class="setlist">
        ${(live.setlist ?? [])
          .map(
            (song, index) => `
              <li>
                <span class="track-no">${index + 1}</span>
                <span class="track-title">${song.title}</span>
                ${song.note ? `<span class="note">（${song.note}）</span>` : ""}
              </li>
            `
          )
          .join("")}
      </ol>
    </div>
  `;
}


// ==============================
// 初期化・イベント設定
// ==============================

async function init() {
  const yearSelect = document.getElementById("yearSelect");
  const typeSelect = document.getElementById("typeSelect");
  const liveSelect = document.getElementById("liveSelect");
  const songSearch = document.getElementById("songSearch");
  const liveSearch = document.getElementById("liveSearch"); // ★追加
  const resetButton = document.getElementById("resetButton");
  const resultEl = document.getElementById("result");

  // --------------------------
  // 年度一覧を取得して select を作る
  // --------------------------
  const { years } = await loadYears();

  // yearSelect の中身を作り直す（念のため）
  yearSelect.innerHTML = "";

  // 新しい年を上に
  const sortedYears = [...years].sort((a, b) => b - a);
  sortedYears.forEach((year) => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });

  // --------------------------
  // 初期表示：最新年度
  // --------------------------
  const currentYear = sortedYears[0];
  yearSelect.value = currentYear;
  lives = await loadYear(currentYear);

  // 状態初期化
  selectedType = "";
  searchWord = "";
  liveSearchWord = "";

  // UI初期化
  typeSelect.value = "";
  songSearch.value = "";
  if (liveSearch) liveSearch.value = ""; // ★追加
  liveSelect.value = "";

  renderTypeSelect();
  applyFilters();
  resultEl.innerHTML = "";

  // --------------------------
  // 年度変更時
  // --------------------------
yearSelect.addEventListener("change", async () => {
  lives = await loadYear(yearSelect.value);

  // 入力中の検索条件は保持（入力欄から再取得）
  searchWord = songSearch.value.trim();
  liveSearchWord = liveSearch ? liveSearch.value.trim() : "";

  // typeの候補は年度で変わるので作り直し
  const prevType = typeSelect.value;
  renderTypeSelect();

  // 以前選んでたtypeが新年度に存在するなら維持、無ければ解除
  const exists = Array.from(typeSelect.options).some((o) => o.value === prevType);
  if (exists) {
    typeSelect.value = prevType;
    selectedType = prevType;
  } else {
    typeSelect.value = "";
    selectedType = "";
  }

  // ライブ選択は一旦クリア（内容が変わるから）
  liveSelect.value = "";
  applyFilters();
  resultEl.innerHTML = "";
});

  // --------------------------
  // 形態変更時
  // --------------------------
  typeSelect.addEventListener("change", () => {
    selectedType = typeSelect.value;
    applyFilters();
    resultEl.innerHTML = "";
  });

  // --------------------------
  // 曲名検索時（部分一致）
  // --------------------------
  songSearch.addEventListener("input", () => {
    searchWord = songSearch.value.trim();
    applyFilters();
    resultEl.innerHTML = "";
  });

  // --------------------------
  // ★ライブ名検索時（部分一致）
  // --------------------------
  if (liveSearch) {
    liveSearch.addEventListener("input", () => {
      liveSearchWord = liveSearch.value.trim();
      applyFilters();
      resultEl.innerHTML = "";
    });
  }

  // --------------------------
  // ライブ選択時
  // --------------------------
  liveSelect.addEventListener("change", () => {
    const id = liveSelect.value;
    if (!id) return;

    const live = filteredLives.find((l) => l.id === id);
    if (live) renderResult(live);
  });

  // --------------------------
  // 🔁 条件リセットボタン
  // --------------------------
  resetButton.addEventListener("click", async () => {
    // 年度を最新に戻す（初期の最新年に戻す仕様）
    yearSelect.value = currentYear;
    lives = await loadYear(currentYear);

    // 内部状態リセット
    selectedType = "";
    searchWord = "";
    liveSearchWord = "";

    // UIリセット
    typeSelect.value = "";
    songSearch.value = "";
    if (liveSearch) liveSearch.value = ""; // ★追加
    liveSelect.value = "";

    renderTypeSelect();
    applyFilters();

    // 表示クリア
    resultEl.innerHTML = "";
  });
}

// 初期化実行
init();
