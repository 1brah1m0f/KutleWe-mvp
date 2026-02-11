const path = require("path");
const dotenv = require("dotenv");

// .env faylini repo root-undan oxu
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const { initializeDatabase } = require("../src/db/database");
const apiRouter = require("../src/routes/api");

const app = express();

// CORS
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

// Lazy DB init - serverless function her soyuq baslanqicda DB yaradir
let dbPromise = null;
app.use(async (req, res, next) => {
  try {
    if (!dbPromise) {
      dbPromise = initializeDatabase();
    }
    await dbPromise;
    next();
  } catch (err) {
    dbPromise = null;
    next(err);
  }
});

// API router - /api prefix ile
app.use("/api", apiRouter);

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    error: "Server xetasi",
    message: err.message
  });
});

module.exports = app;
