// ==============================
// グローバル状態
// ==============================

// 選択中の年度の「全ライブ」
let lives = [];

// 形態などで絞り込んだ後のライブ一覧
let filteredLives = [];


// ==============================
// JSON読み込み系
// ==============================

// 年度一覧（index.json）を読み込む
async function loadYears() {
  const res = await fetch("./data/index.json");
  return await res.json();
}

// 指定した年度のライブJSONを読み込む
async function loadYear(year) {
  const res = await fetch(`./data/${year}.json`);
  return await res.json();
}


// ==============================
// プルダウン描画系
// ==============================

// 形態プルダウンを生成する
// lives に含まれる type を重複なしで抽出
function renderTypeSelect() {
  const typeSelect = document.getElementById("typeSelect");
  typeSelect.innerHTML = `<option value="">-- 全て --</option>`;

  const types = [...new Set(lives.map(l => l.type))];

  types.forEach(type => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type;
    typeSelect.appendChild(opt);
  });
}

// ライブプルダウンを生成する
// filteredLives を元に表示する
function renderLiveSelect() {
  const select = document.getElementById("liveSelect");
  select.innerHTML = `<option value="">-- 選択してください --</option>`;

  filteredLives.forEach(live => {
    const opt = document.createElement("option");
    opt.value = live.id;
    opt.textContent = `${live.date}${live.slot} / ${live.title}`;
    select.appendChild(opt);
  });
}


// ==============================
// ライブ詳細表示
// ==============================

// 選択されたライブのセットリストを表示
function renderResult(live) {
  const result = document.getElementById("result");
result.innerHTML = `
  <div class="live-card">
    <div class="live-date">${live.date}</div>
    <div class="live-title">${live.title}</div>

    <div class="live-meta">
      ${live.venue} ・ ${live.type}
    </div>

    <ol class="setlist">
      ${live.setlist.map((song, index) => `
  <li>
    <span class="track-no">${index + 1}</span>
    <span class="track-title">${song.title}</span>
    ${song.note ? `<span class="note">（${song.note}）</span>` : ""}
  </li>
`).join("")}
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

  // 年度一覧を取得
  const { years } = await loadYears();

  // 年度プルダウン生成（新しい年を上に）
  years.sort((a, b) => b - a).forEach(year => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });

  // 初期表示：最新年度
  const currentYear = years.sort((a, b) => b - a)[0];
  lives = await loadYear(currentYear);
  filteredLives = lives;

  renderTypeSelect();
  renderLiveSelect();

  // --------------------------
  // 年度変更時
  // --------------------------
  yearSelect.addEventListener("change", async () => {
    const year = yearSelect.value;

    lives = await loadYear(year);
    filteredLives = lives;

    renderTypeSelect();
    renderLiveSelect();

    // 状態リセット
    typeSelect.value = "";
    document.getElementById("result").innerHTML = "";
  });

  // --------------------------
  // 形態変更時
  // --------------------------
  typeSelect.addEventListener("change", () => {
    const type = typeSelect.value;

    // 形態未選択なら全件
    filteredLives = type
      ? lives.filter(l => l.type === type)
      : lives;

    renderLiveSelect();
    document.getElementById("result").innerHTML = "";
  });

  // --------------------------
  // ライブ選択時
  // --------------------------
  liveSelect.addEventListener("change", () => {
    const id = liveSelect.value;
    if (!id) return;

    const live = filteredLives.find(l => l.id === id);
    renderResult(live);
  });
}

// 初期化実行
init();
