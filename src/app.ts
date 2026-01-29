import express from "express";

import { env } from "./config/env";
import { correlationIdMiddleware } from "./middlewares/correlation-id";
import { errorHandlerMiddleware } from "./middlewares/error-handler";
import { requestLoggerMiddleware } from "./middlewares/request-logger";

const app = express();

app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Error handler must be last middleware
app.use(errorHandlerMiddleware);

const port = env.PORT;

app.listen(port, () => {
  console.log(`Server listening on :${port}`);
});
