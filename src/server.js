const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

const { initializeDatabase } = require("./db/database");
const apiRouter = require("./routes/api");

dotenv.config();

async function startServer() {
  await initializeDatabase();

  const app = express();
  const port = Number(process.env.PORT || 3000);
  const publicDir = path.join(__dirname, "..", "public");

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", apiRouter);
  app.use(express.static(publicDir));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
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
