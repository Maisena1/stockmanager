import "dotenv/config";
import os from "os";
import app from "./app";

const PORT = process.env.PORT || 2060;

function getNetworkIP(): string | undefined {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return undefined;
}

app.listen(PORT, "0.0.0.0", () => {
  const ip = getNetworkIP();
  console.log(`API running on http://localhost:${PORT}`);
  if (ip) console.log(`Accessible on the network at http://${ip}:${PORT}`);
});
