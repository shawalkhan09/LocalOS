import { bootstrapOwnerAccount } from "./bootstrap.js";
import { createApp } from "./app.js";

const app = createApp();
const port = Number(process.env.PORT ?? 3000);

await bootstrapOwnerAccount();

const server = app.listen(port, () => {
  console.log(`api listening on :${port}`);
});
server.on("error", (err) => {
  console.error("api failed to start:", err.message);
  process.exit(1);
});

