async function loadData() {
  const res = await fetch("setlist.json");
  return await res.json();
}

loadData().then(lives => {
  const list = document.getElementById("list");

  // 日付順にソート
  lives.sort((a, b) => {
    if (a.date === b.date) {
      return a.slot.localeCompare(b.slot);
    }
    return a.date.localeCompare(b.date);
  });

  lives.forEach(live => {
    const div = document.createElement("div");
    div.className = "live";

    div.innerHTML = `
      <h2>${live.date}（${live.slot}）</h2>
      <div class="meta">
        ${live.type} / ${live.venue}<br>
        ${live.tour ? `ツアー：${live.tour}<br>` : ""}
        ${live.title}
      </div>

      <ol>
        ${live.setlist.map(song => `
          <li>
            ${song.title}
            ${song.note ? `<span class="note">（${song.note}）</span>` : ""}
          </li>
        `).join("")}
      </ol>
    `;

    list.appendChild(div);
  });
});
