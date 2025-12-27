const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "../data");

const index = JSON.parse(
  fs.readFileSync(path.join(dataDir, "index.json"), "utf-8")
);

const songSet = new Set();

index.years.forEach(year => {
  const lives = JSON.parse(
    fs.readFileSync(path.join(dataDir, `${year}.json`), "utf-8")
  );

  lives.forEach(live => {
    live.setlist?.forEach(song => {
      if (song.title) {
        songSet.add(song.title);
      }
    });
  });
});

const songs = Array.from(songSet).sort();

const output = {
  songs
};

fs.writeFileSync(
  path.join(dataDir, "songs.raw.json"),
  JSON.stringify(output, null, 2),
  "utf-8"
);

console.log(`抽出完了：${songs.length}曲`);
