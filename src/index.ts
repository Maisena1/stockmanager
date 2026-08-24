import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT || 2060;
app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});