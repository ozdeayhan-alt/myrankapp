const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseOpenGraphFromHtml } = require("./unfurlLink");

describe("parseOpenGraphFromHtml", () => {
  it("extracts og title, description and image", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Başlık &amp; Haber" />
          <meta property="og:description" content="Kısa özet metni" />
          <meta property="og:image" content="https://cdn.example.com/cover.jpg" />
        </head>
      </html>
    `;

    const parsed = parseOpenGraphFromHtml(html, "https://example.com/haber");
    assert.equal(parsed.linkTitle, "Başlık & Haber");
    assert.equal(parsed.linkDescription, "Kısa özet metni");
    assert.equal(parsed.linkImageUrl, "https://cdn.example.com/cover.jpg");
  });

  it("resolves relative image urls", () => {
    const html =
      '<meta property="og:image" content="/assets/photo.png" />';
    const parsed = parseOpenGraphFromHtml(html, "https://example.com/post");
    assert.equal(parsed.linkImageUrl, "https://example.com/assets/photo.png");
  });
});
