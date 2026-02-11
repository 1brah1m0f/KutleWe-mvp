const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

// .env faylini her zaman repo root-undan oxu
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { initializeDatabase } = require("./db/database");
const apiRouter = require("./routes/api");

async function startServer() {
  await initializeDatabase();

  const app = express();
  const port = Number(process.env.PORT || 3000);
  const publicDir = path.join(__dirname, "..", "public");

  // CORS - Vercel frontend + Render backend ucun lazimdir
  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Static fayllar (CSS, JS, images) - API-den EVVEL olmalidir
  app.use(express.static(publicDir));

  app.use("/api", apiRouter);

  // HTML sehifeleri ucun fallback - yalniz .html uzantili ve ya uzantisiz yollara cavab ver
  app.get("*", (req, res, next) => {
    // API sorğularını buraxma
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Fayl uzantisi olan amma movcud olmayan resurslara 404 ver (css, js, img vs)
    if (path.extname(req.path)) {
      return next();
    }

    // HTML sehife axtar
    const htmlPath = req.path === "/" ? "/index.html" : req.path + ".html";
    const filePath = path.join(publicDir, htmlPath);
    res.sendFile(filePath, (err) => {
      if (err) {
        // Fayl tapilmadisa index.html gonder
        res.sendFile(path.join(publicDir, "index.html"), (err2) => {
          if (err2) next();
        });
      }
    });
  });

  app.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: `Bu endpoint tapilmadi: ${req.method} ${req.originalUrl}`
    });
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Server daxilinde xeta bas verdi."
    });
  });

  app.listen(port, () => {
    console.log(`KutleWe serveri isleyir: http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Server basladilarken xeta:", error);
  process.exit(1);
});
