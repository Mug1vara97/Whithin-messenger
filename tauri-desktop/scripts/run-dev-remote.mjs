import { spawn } from "node:child_process";

process.env.WEB_CLIENT_URL = "https://whithin.ru";

const child = spawn(
  "npx",
  ["tauri", "dev", "--config", "src-tauri/tauri.remote.conf.json"],
  {
    stdio: "inherit",
    shell: true,
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
