import express from "express";

const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 3000);

if (!Number.isFinite(port)) {
  throw new Error("PORT must be a number");
}

app.listen(port, () => {
  console.log(`Server listening on :${port}`);
});
