const { LEGAL_PAGES, renderLegalHtml } = require("../legal/publicDocuments");

function registerLegalRoutes(app) {
  app.get("/privacy", (_req, res) => {
    res.type("html").send(renderLegalHtml(LEGAL_PAGES.privacy));
  });

  app.get("/terms", (_req, res) => {
    res.type("html").send(renderLegalHtml(LEGAL_PAGES.terms));
  });

  app.get("/moderation", (_req, res) => {
    res.type("html").send(renderLegalHtml(LEGAL_PAGES.moderation));
  });

  app.get("/child-safety", (_req, res) => {
    res.type("html").send(renderLegalHtml(LEGAL_PAGES.childSafety));
  });
}

module.exports = { registerLegalRoutes };
