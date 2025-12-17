let lives = [];
let filteredLives = [];

async function loadYears() {
  const res = await fetch("./data/index.json");
  return await res.json();
}

async function loadYear(year) {
  const res = await fetch(`./data/${year}.json`);
  return await res.json();
}

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

function renderLiveSelect() {
    console.log("RENDER LIVE SELECT:", lives);

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
    <h2>${live.date}　${live.slot}</h2>
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
  const typeSelect = document.getElementById("typeSelect");
  const liveSelect = document.getElementById("liveSelect");

  const { years } = await loadYears();

  years.sort((a, b) => b - a).forEach(year => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });

  // 初期表示：最新年
  const currentYear = years.sort((a, b) => b - a)[0];
  lives = await loadYear(currentYear);
  filteredLives = lives;

  renderTypeSelect();
  renderLiveSelect();

  // 年度切替
  yearSelect.addEventListener("change", async () => {
    const year = yearSelect.value;
    lives = await loadYear(year);
    filteredLives = lives;

    renderTypeSelect();
    renderLiveSelect();

    typeSelect.value = "";
    document.getElementById("result").innerHTML = "";
  });

  // 形態切替
  typeSelect.addEventListener("change", () => {
    const type = typeSelect.value;

    filteredLives = type
      ? lives.filter(l => l.type === type)
      : lives;

    renderLiveSelect();
    document.getElementById("result").innerHTML = "";
  });

  // ライブ選択
  liveSelect.addEventListener("change", () => {
    const id = liveSelect.value;
    if (!id) return;

    const live = filteredLives.find(l => l.id === id);
    renderResult(live);
  });
}


init();
