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

async function loadSongsRaw() {
  const res = await fetch("./data/songs.raw.json");
  return await res.json();
}

// songs.raw.json の形が
// - ["曲名", ...]
// - [{title:"曲名"}, ...]
// - [{name:"曲名"}, ...]
// どれでも拾う（ここでは「そのまま」拾うだけ）
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
  return titles; // 重複排除しない
}

// ==============================
// インクリメンタルサーチ（候補UI）
// ==============================
function setupIncrementalSearch({ input, suggestBox, songMaster }) {
  let currentList = [];
  let activeIndex = -1;

  function closeSuggest() {
    suggestBox.classList.remove("is-open");
    suggestBox.innerHTML = "";
    currentList = [];
    activeIndex = -1;
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
          ${t}
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

  input.addEventListener("input", () => {
    const q = input.value;

    // 空なら閉じる
    if (!q) {
      closeSuggest();
      return;
    }

    // そのまま includes で候補抽出（最大20件）
    const items = [];
    for (const title of songMaster) {
      if (String(title).includes(q)) items.push(title);
      if (items.length >= 20) break;
    }

    openSuggest(items);
  });

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

  // キーボード操作（上下/Enter/Esc）
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
      if (activeIndex >= 0 && currentList[activeIndex]) {
        e.preventDefault();
        input.value = currentList[activeIndex];
        closeSuggest();
      }
    } else if (e.key === "Escape") {
      closeSuggest();
    }
  });

  // 外クリックで閉じる
  document.addEventListener("click", (e) => {
    if (e.target === input) return;
    if (suggestBox.contains(e.target)) return;
    closeSuggest();
  });

  return { closeSuggest };
}

// ==============================
// 結果描画
// ==============================
function renderResult(container, word, year, matched) {
  if (matched.length === 0) {
    container.innerHTML = "<p>該当するデータがありません</p>";
    return;
  }

  const headerLabel = year === "all" ? "全期間" : `${year}年`;

  container.innerHTML = `
    <h2>${headerLabel}「${word}」</h2>
    <p>ライブ披露回数：${matched.length}回</p>
    <ul>
      ${matched.map(item => `
        <li>${item.date} / ${item.title}（${item.venue}）</li>
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

  // songs.raw.json 読み込み
  const raw = await loadSongsRaw();
  const songMaster = extractSongTitles(raw);

  // ★動作確認用ログ（まずここ見て）
  console.log("songs.raw.json count:", Array.isArray(raw) ? raw.length : raw);
  console.log("songMaster count:", songMaster.length);
  console.log("songMaster sample:", songMaster.slice(0, 10));

  // インクリメンタルセットアップ
  const inc = setupIncrementalSearch({
    input: songInput,
    suggestBox,
    songMaster
  });

  async function runSearch() {
    const year = yearSelect.value;
    const word = songInput.value;

    inc.closeSuggest();

    if (!word) {
      result.innerHTML = "<p>曲名を入力してください</p>";
      return;
    }

    const lives = await loadTargetLives(year);

    const matched = [];
    lives.forEach(live => {
      live.setlist?.forEach(song => {
        if (String(song.title).includes(word)) {
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
  }

  searchButton.addEventListener("click", runSearch);

  songInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      setTimeout(() => runSearch(), 0);
    }
  });
}

init();
