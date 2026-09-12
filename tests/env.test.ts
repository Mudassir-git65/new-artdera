import { afterEach, describe, expect, it } from "vitest";

import { EnvironmentConfigurationError, getEnv, resetEnvForTests } from "../server/config/env";

const originalValues = {
  VERCEL: process.env.VERCEL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  NODE_ENV: process.env.NODE_ENV,
  MONGODB_URI: process.env.MONGODB_URI,
  AUTH_SECRET: process.env.AUTH_SECRET,
  DEMO_PAYMENT_MODE: process.env.DEMO_PAYMENT_MODE,
  SEED_DEMO_DATA: process.env.SEED_DEMO_DATA,
  APP_URL: process.env.APP_URL,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  API_PORT: process.env.API_PORT,
  UPLOAD_PROVIDER: process.env.UPLOAD_PROVIDER,
  UPLOAD_PUBLIC_BASE_URL: process.env.UPLOAD_PUBLIC_BASE_URL,
  MAX_ARTWORK_IMAGE_SIZE_MB: process.env.MAX_ARTWORK_IMAGE_SIZE_MB,
  MAX_PROFILE_IMAGE_SIZE_MB: process.env.MAX_PROFILE_IMAGE_SIZE_MB,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalValues)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEnvForTests();
});

describe("server environment parsing", () => {
  it("normalizes quoted and space-padded Vercel scalar values", () => {
    process.env.NODE_ENV = ' "production" ';
    process.env.APP_URL = "https://www.artdera.com";
    process.env.DEMO_PAYMENT_MODE = " 'false' ";
    resetEnvForTests();

    expect(getEnv()).toMatchObject({
      NODE_ENV: "production",
      DEMO_PAYMENT_MODE: false,
    });
  });

  it("safely disables development-only modes in production", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "https://www.artdera.com";
    process.env.DEMO_PAYMENT_MODE = "true";
    process.env.SEED_DEMO_DATA = "true";
    resetEnvForTests();

    expect(getEnv()).toMatchObject({
      NODE_ENV: "production",
      DEMO_PAYMENT_MODE: false,
      SEED_DEMO_DATA: false,
    });
  });

  it("uses safe defaults for malformed optional Vercel configuration", () => {
    process.env.VERCEL = "1";
    process.env.NODE_ENV = "unexpected";
    process.env.DEMO_PAYMENT_MODE = "true";
    process.env.APP_URL = "not-a-url";
    process.env.ALLOWED_ORIGINS = "not-a-url, https://www.artdera.com";
    process.env.API_PORT = "not-a-port";
    process.env.UPLOAD_PROVIDER = "local";
    process.env.UPLOAD_PUBLIC_BASE_URL = "not-a-url";
    process.env.MAX_ARTWORK_IMAGE_SIZE_MB = "huge";
    process.env.MAX_PROFILE_IMAGE_SIZE_MB = "huge";
    resetEnvForTests();

    expect(getEnv()).toMatchObject({
      NODE_ENV: "production",
      DEMO_PAYMENT_MODE: false,
      APP_URL: "https://www.artdera.com",
      ALLOWED_ORIGINS: ["https://www.artdera.com"],
      API_PORT: 3001,
      UPLOAD_PROVIDER: "mongodb",
      UPLOAD_PUBLIC_BASE_URL: undefined,
      MAX_ARTWORK_IMAGE_SIZE_MB: 10,
      MAX_PROFILE_IMAGE_SIZE_MB: 5,
    });
  });

  it("reserves startup failures for essential backend credentials", () => {
    delete process.env.MONGODB_URI;
    delete process.env.AUTH_SECRET;
    resetEnvForTests();

    try {
      getEnv();
      throw new Error("Expected required credential validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentConfigurationError);
      expect((error as EnvironmentConfigurationError).fields).toEqual([
        "MONGODB_URI",
        "AUTH_SECRET",
      ]);
    }
  });
});
