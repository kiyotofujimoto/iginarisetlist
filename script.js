async function loadData() {
  const res = await fetch("setlist.json");
  return await res.json();
}

loadData().then(lives => {
  const select = document.getElementById("liveSelect");
  const result = document.getElementById("result");

  // 日付順 + 昼夜順に並べる
  lives.sort((a, b) => {
    if (a.date === b.date) {
      return a.slot.localeCompare(b.slot);
    }
    return a.date.localeCompare(b.date);
  });

  // プルダウン生成
  lives.forEach(live => {
    const opt = document.createElement("option");
    opt.value = live.id;
    opt.textContent = `${live.date} / ${live.title}`;
    select.appendChild(opt);
  });

  // 選択時
  select.addEventListener("change", () => {
    const id = select.value;
    if (!id) {
      result.innerHTML = "";
      return;
    }

    const live = lives.find(l => l.id === id);

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
  });
});
