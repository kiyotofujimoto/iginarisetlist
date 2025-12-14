let lives = [];

async function loadYears() {
  const res = await fetch("./data/index.json");
  return await res.json();
}

async function loadYear(year) {
  const res = await fetch(`./data/${year}.json`);
  return await res.json();
}

function renderLiveSelect() {
  const select = document.getElementById("liveSelect");
  select.innerHTML = `<option value="">-- 選択してください --</option>`;

  lives.forEach(live => {
    const opt = document.createElement("option");
    opt.value = live.id;
    opt.textContent = `${live.date} / ${live.title}`;
    select.appendChild(opt);
  });
}

function renderResult(live) {
  const result = document.getElementById("result");

  result.innerHTML = `
    <h2>${live.date}（${live.slot}）</h2>
    <p>
      <strong>形態：</strong>${live.type}<br>
      <strong>会場：</strong>${live.venue}<br>
      ${live.tour ? `<strong>ツアー：</strong>${live.tour}<br>` : ""}
      <strong>イベント名：</strong>${live.title}
    </p>
    <ol>
      ${live.setlist.map(song => `
        <li>
          ${song.title}
          ${song.note ? `<span class="note">（${song.note}）</span>` : ""}
        </li>
      `).join("")}
    </ol>
  `;
}

async function init() {
  const yearSelect = document.getElementById("yearSelect");
  const liveSelect = document.getElementById("liveSelect");

  // 年度一覧取得
  const { years } = await loadYears();

  // 年度プルダウン生成（新しい年を上に）
  years.sort((a, b) => b - a).forEach(year => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });

  // 初期表示：最新年
  const currentYear = years.sort((a, b) => b - a)[0];
  lives = await loadYear(currentYear);
  renderLiveSelect();

  // 年度切替
  yearSelect.addEventListener("change", async () => {
    const year = yearSelect.value;
    lives = await loadYear(year);
    renderLiveSelect();
    document.getElementById("result").innerHTML = "";
  });

  // ライブ選択
  liveSelect.addEventListener("change", () => {
    const id = liveSelect.value;
    if (!id) return;
    const live = lives.find(l => l.id === id);
    renderResult(live);
  });
}

init();
