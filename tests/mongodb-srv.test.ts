import { describe, expect, it } from "vitest";
import { buildMongoStandardUri } from "../server/lib/mongodb-srv";

const records = {
  srv: [
    { name: "db-b.example.mongodb.net", port: 27018, priority: 1, weight: 0 },
    { name: "db-a.example.mongodb.net", port: 27017, priority: 0, weight: 5 },
  ],
  txt: ["authSource=admin&replicaSet=atlas-example-shard-0"],
};

describe("MongoDB SRV fallback", () => {
  it("builds the standard replica-set URI without changing credentials", () => {
    const result = buildMongoStandardUri(
      "mongodb+srv://app-user:encoded%40password@cluster.example.mongodb.net/artdera?retryWrites=true",
      records,
    );
    expect(result).toContain(
      "mongodb://app-user:encoded%40password@db-a.example.mongodb.net:27017",
    );
    expect(result).toContain("db-b.example.mongodb.net:27018/artdera?");
    expect(result).toContain("authSource=admin");
    expect(result).toContain("replicaSet=atlas-example-shard-0");
    expect(result).toContain("retryWrites=true");
    expect(result).toContain("tls=true");
  });

  it("lets explicit URI options override TXT options case-insensitively", () => {
    const result = buildMongoStandardUri(
      "mongodb+srv://cluster.example.mongodb.net/?AUTHSOURCE=custom",
      records,
    );
    const options = new URLSearchParams(result.slice(result.indexOf("?") + 1));
    expect([...options.entries()].filter(([key]) => key.toLowerCase() === "authsource")).toEqual([
      ["AUTHSOURCE", "custom"],
    ]);
  });

  it("rejects an SRV target outside the source parent domain", () => {
    expect(() =>
      buildMongoStandardUri("mongodb+srv://cluster.example.mongodb.net/", {
        srv: [{ name: "attacker.invalid", port: 27017, priority: 0, weight: 0 }],
        txt: [],
      }),
    ).toThrow("outside the expected domain");
  });
});
