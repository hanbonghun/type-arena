// apps/ws-server/src/config.ts
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(__dirname, "../../../.env") });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  WS_PORT: parseInt(process.env.WS_PORT ?? "8080", 10),
  CORS_ORIGIN: process.env.WS_CORS_ORIGIN ?? "http://localhost:3000",
  WS_JWT_SECRET: required("WS_JWT_SECRET"),
  DATABASE_URL: required("DATABASE_URL"),
};
