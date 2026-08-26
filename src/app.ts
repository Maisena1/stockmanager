import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import articlesRoutes from "./routes/articles.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/articles", articlesRoutes);

app.use(notFound);
app.use(errorHandler);

function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("ERROR:", err.message);
  res.status(500).json({ error: err.message });
}

export default app;
