// ==============================
// ユーティリティ
// ==============================

function normalizeText(str) {
  return str
    .toLowerCase()
    .normalize("NFKC")
    .trim();
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
      allLives.push(
        ...lives.map(live => ({ ...live, year: y }))
      );
    }
    return allLives;
  }

  const lives = await loadLives(year);
  return lives.map(live => ({ ...live, year }));
}

// ==============================
// 初期化
// ==============================

async function init() {
  const yearSelect   = document.getElementById("yearSelect");
  const songInput    = document.getElementById("songInput");
  const searchButton = document.getElementById("searchButton");
  const result       = document.getElementById("result");

  // 年度プルダウン生成
  const { years } = await loadYears();
  years
    .sort((a, b) => b - a)
    .forEach(year => {
      const opt = document.createElement("option");
      opt.value = year;
      opt.textContent = year;
      yearSelect.appendChild(opt);
    });

  // 検索処理
  searchButton.addEventListener("click", async () => {
    const year = yearSelect.value;
    const word = normalizeText(songInput.value);

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

    renderResult(result, word, year, matched);
  });
}

// ==============================
// 結果描画
// ==============================

function renderResult(container, word, year, matched) {
  if (matched.length === 0) {
    container.innerHTML = "<p>該当するデータがありません</p>";
    return;
  }

  const headerLabel = year === "all"
    ? "全期間"
    : `${year}年`;

  container.innerHTML = `
    <h2>${headerLabel}「${word}」</h2>
    <p>ライブ披露回数：${matched.length}回</p>

    <ul>
      ${matched.map(item => `
        <li>
          ${item.date} / ${item.title}（${item.venue}）
        </li>
      `).join("")}
    </ul>
  `;
}

// ==============================
// 実行
// ==============================

init();
