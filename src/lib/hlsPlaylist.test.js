const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildPublicFirebaseMediaUrl,
  rewriteHlsPlaylistAbsolute,
} = require("./hlsPlaylist");

describe("hlsPlaylist", () => {
  it("builds public firebase media url without token", () => {
    expect(
      buildPublicFirebaseMediaUrl(
        "myrankapp-d62b9.firebasestorage.app",
        "posts/u1/v_hls/seg_000.ts"
      )
    ).toBe(
      "https://firebasestorage.googleapis.com/v0/b/myrankapp-d62b9.firebasestorage.app/o/posts%2Fu1%2Fv_hls%2Fseg_000.ts?alt=media"
    );
  });

  it("rewrites relative segment lines to absolute urls", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hls-test-"));
    const playlistPath = path.join(tmp, "master.m3u8");
    fs.writeFileSync(
      playlistPath,
      "#EXTM3U\n#EXTINF:1.0,\nseg_000.ts\n#EXTINF:1.0,\nseg_001.ts\n"
    );

    const hlsUrl = rewriteHlsPlaylistAbsolute(
      playlistPath,
      "posts/u1/v_hls",
      "myrankapp-d62b9.firebasestorage.app"
    );

    const content = fs.readFileSync(playlistPath, "utf8");
    expect(content).toContain(
      "https://firebasestorage.googleapis.com/v0/b/myrankapp-d62b9.firebasestorage.app/o/posts%2Fu1%2Fv_hls%2Fseg_000.ts?alt=media"
    );
    expect(hlsUrl).toContain("master.m3u8?alt=media");
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
