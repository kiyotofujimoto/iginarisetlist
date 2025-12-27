// ==============================
// JSON 読み込み
// ==============================
async function loadYears() {
  const res = await fetch("./data/index.json");
  if (!res.ok) throw new Error(`index.json load failed: ${res.status}`);
  return await res.json();
}

async function loadLives(year) {
  const res = await fetch(`./data/${year}.json`);
  if (!res.ok) throw new Error(`${year}.json load failed: ${res.status}`);
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
  if (!res.ok) throw new Error(`songs.raw.json load failed: ${res.status}`);
  return await res.json();
}

// ==============================
// songs.raw.json から曲名配列を抽出（形が何でも吸う）
// ==============================
function extractSongTitles(raw) {
  // rawが配列ならそのまま
  if (Array.isArray(raw)) return extractFromArray(raw);

  // rawがオブジェクトなら、ありがちなキーを探す
  if (raw && typeof raw === "object") {
    const candidates =
      raw.songs ??
      raw.titles ??
      raw.items ??
      raw.data ??
      raw.list ??
      raw.results;

    if (Array.isArray(candidates)) return extractFromArray(candidates);

    // ネストが深いパターンも雑に救う（1段だけ）
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
  // 空文字とかnullっぽいのは落とす
  return titles.filter(t => typeof t === "string" && t.trim() !== "");
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

  function buildCandidates(q) {
    const items = [];
    for (const title of songMaster) {
      if (String(title).includes(q)) items.push(title);
      if (items.length >= 20) break;
    }
    return items;
  }

  input.addEventListener("input", () => {
    const q = input.value;

    if (!q) {
      closeSuggest();
      return;
    }
    openSuggest(buildCandidates(q));
  });

  // clickだと blur/input と競合しがちなので mousedown で確定する
  suggestBox.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".suggest-item");
    if (!item) return;

    e.preventDefault(); // 先にblurするのを防ぐ
    const idx = Number(item.dataset.idx);
    const title = currentList[idx];
    if (!title) return;

    input.value = title;
    closeSuggest();
    input.focus();
  });

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
        // Enterは「候補確定」を優先（検索はinit側のEnterで走らせる）
        e.preventDefault();
        input.value = currentList[activeIndex];
        closeSuggest();
      }
    } else if (e.key === "Escape") {
      closeSuggest();
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target === input) return;
    if (suggestBox.contains(e.target)) return;
    closeSuggest();
  });

  return { closeSuggest };
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    <h2>${headerLabel}「${escapeHtml(word)}」</h2>
    <p>ライブ披露回数：${matched.length}回</p>
    <ul>
      ${matched
        .map(
          item => `<li>${escapeHtml(item.date)} / ${escapeHtml(item.title)}）</li>`
        )
        .join("")}
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

  try {
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

    // 動作確認ログ
    console.log("songs.raw.json type:", Array.isArray(raw) ? "array" : typeof raw);
    console.log("songMaster count:", songMaster.length);
    console.log("songMaster sample:", songMaster.slice(0, 10));

    // ここで0なら songs.raw.json の中身が「曲名っぽい文字列/オブジェクト」を含んでない
    if (songMaster.length === 0) {
      console.warn("songMaster is empty. songs.raw.json structure or keys are unexpected.");
    }

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
      for (const live of lives) {
        for (const song of (live.setlist ?? [])) {
          if (String(song.title).includes(word)) {
            matched.push({
              date: live.date,
              title: live.title,
              venue: live.venue,
              year: live.year
            });
          }
        }
      }

      renderResult(result, word, year, matched);
    }

    searchButton.addEventListener("click", runSearch);

    // Enterで検索（候補確定Enterと競合するので setTimeout で後に回す）
    songInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        setTimeout(() => runSearch(), 0);
      }
    });
  } catch (err) {
    console.error(err);
    result.innerHTML = `<p>初期化に失敗しました：${escapeHtml(err.message)}</p>`;
  }
}

init();
