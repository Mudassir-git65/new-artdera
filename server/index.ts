import { createApp } from "./app";
import { getEnv } from "./config/env";
import { connectDatabase } from "./db";
import { releaseExpiredReservations } from "./services/reservations";
import { refreshPromotionStates } from "./services/sponsored";

const DATABASE_RETRY_DELAY_MS = 2_000;

async function connectDatabaseUntilReady() {
  try {
    await connectDatabase();
    process.stdout.write("ArtDera database ready.\n");
  } catch {
    process.stderr.write(
      "ArtDera database is temporarily unavailable; the API will retry automatically.\n",
    );
    const retryTimer = setTimeout(() => {
      void connectDatabaseUntilReady();
    }, DATABASE_RETRY_DELAY_MS);
    retryTimer.unref();
  }
}

function main() {
  const env = getEnv();
  const app = createApp();
  const reservationTimer = setInterval(() => {
    void Promise.all([releaseExpiredReservations(), refreshPromotionStates()]).catch(() => {
      process.stderr.write("ArtDera marketplace maintenance could not complete.\n");
    });
  }, 60_000);
  reservationTimer.unref();
  app.listen(env.API_PORT, () => {
    process.stdout.write(`ArtDera API listening on port ${env.API_PORT}\n`);
  });
  void connectDatabaseUntilReady();
}

try {
  main();
} catch {
  process.stderr.write(
    "ArtDera API startup failed. Check the server environment configuration.\n",
  );
  process.exitCode = 1;
}
