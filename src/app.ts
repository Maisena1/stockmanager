import express from "express";
const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});
app.get('/', (_req, res) => {
    res.json({ message: 'Welcome to the API' });
});

export default app;