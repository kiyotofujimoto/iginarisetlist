listasync function loadData() {
  const res = await fetch("setlist.json");
  return await res.json();
}

loadData().then(data => {
  const dateSelect = document.getElementById("dateSelect");
  const result = document.getElementById("result");
  const songSelect = document.getElementById("songSelect");
  const songResult = document.getElementById("songResult");

  // =====================================
  // ① 日付プルダウン生成（既存機能）
  // =====================================
  Object.keys(data).sort().forEach(date => {
    const opt = document.createElement("option");
    opt.value = date;
    opt.textContent = date;
    dateSelect.appendChild(opt);
  });

  dateSelect.addEventListener("change", () => {
    const selected = dateSelect.value;
    if (!selected) {
      result.innerHTML = "";
      return;
    }

    const songs = data[selected];
    result.innerHTML = `
      <h3>${selected} のセットリスト</h3>
      <ol>${songs.map(s => `<li>${s}</li>`).join("")}</ol>
    `;
  });

  // =====================================
  // ② 曲名 → その曲をやった日付一覧の生成
  // =====================================

  // 曲名リストを抽出（重複排除）
  const songSet = new Set();
  for (const date in data) {
    data[date].forEach(song => songSet.add(song));
  }

  // 曲名プルダウン生成
  [...songSet].sort().forEach(song => {
    const opt = document.createElement("option");
    opt.value = song;
    opt.textContent = song;
    songSelect.appendChild(opt);
  });

  // 曲名選択時の処理
  songSelect.addEventListener("change", () => {
    const selectedSong = songSelect.value;
    if (!selectedSong) {
      songResult.innerHTML = "";
      return;
    }

    // その曲をやった日付を抽出
    const dates = Object.keys(data).filter(date =>
      data[date].includes(selectedSong)
    );

    songResult.innerHTML = `
      <h3>「${selectedSong}」をやった日</h3>
      <ul>${dates.map(d => `<li>${d}</li>`).join("")}</ul>
    `;
  });

});
