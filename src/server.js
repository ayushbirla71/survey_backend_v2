// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

// Now import app after env vars are loaded
import app from "./app.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
