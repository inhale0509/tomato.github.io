require("dotenv").config();
const express = require("express");
const cors = require("cors");

const t0Router = require("./routes/t0");
const t1Router = require("./routes/t1");
const t2Router = require("./routes/t2");
const t3Router = require("./routes/t3");
const t6Router = require("./routes/t6");
const t7Router = require("./routes/t7");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/t0", t0Router);
app.use("/api/t1", t1Router);
app.use("/api/t2", t2Router);
app.use("/api/t3", t3Router);
app.use("/api/t6", t6Router);
app.use("/api/t7", t7Router);

// Centralized error handler — never leak internals like the API key or stack traces to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "서버 오류가 발생했어요. 잠시 후 다시 시도해주세요." });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("OPIC backend listening on port " + PORT));
