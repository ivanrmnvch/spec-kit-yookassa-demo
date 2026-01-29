import express from "express";

import { env } from "./config/env";
import { correlationIdMiddleware } from "./middlewares/correlation-id";
import { requestLoggerMiddleware } from "./middlewares/request-logger";

const app = express();

app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const port = env.PORT;

app.listen(port, () => {
  console.log(`Server listening on :${port}`);
});
