import type { SrvRecord } from "node:dns";
import { Resolver } from "node:dns/promises";

const NATIVE_DNS_TIMEOUT_MS = 2_500;
const DOH_TIMEOUT_MS = 5_000;
const GOOGLE_DOH_ENDPOINT = "https://dns.google/resolve";
const ALLOWED_TXT_OPTIONS = new Set(["authsource", "replicaset"]);

type DnsJsonAnswer = { data?: string; type?: number };
type DnsJsonResponse = { Answer?: DnsJsonAnswer[]; Status?: number };

export type MongoSrvRecords = {
  srv: SrvRecord[];
  txt: string[];
};

export type MongoSrvResolution = {
  source: "direct" | "native-dns" | "dns-over-https";
  uri: string;
};

function isMissingDnsRecord(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENODATA" || code === "ENOTFOUND" || code === "ESERVFAIL";
}

async function nativeRecords(hostname: string): Promise<MongoSrvRecords> {
  const srvName = `_mongodb._tcp.${hostname}`;
  const resolver = new Resolver();
  return new Promise<MongoSrvRecords>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolver.cancel();
      reject(new Error("MongoDB DNS lookup timed out"));
    }, NATIVE_DNS_TIMEOUT_MS);
    timer.unref();
    const txtPromise = resolver.resolveTxt(hostname).catch((error: unknown) => {
      if (isMissingDnsRecord(error)) return [];
      throw error;
    });
    void Promise.all([resolver.resolveSrv(srvName), txtPromise])
      .then(([srv, txt]) => resolve({ srv, txt: txt.map((record) => record.join("")) }))
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

async function dnsJson(name: string, type: "SRV" | "TXT", allowEmpty = false) {
  const query = new URL(GOOGLE_DOH_ENDPOINT);
  query.searchParams.set("name", name);
  query.searchParams.set("type", type);
  const response = await fetch(query, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(DOH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Secure DNS returned HTTP ${response.status}`);
  const body = (await response.json()) as DnsJsonResponse;
  if (body.Status !== 0 && !(allowEmpty && body.Status === 3))
    throw new Error(`Secure DNS returned status ${body.Status ?? "unknown"}`);
  return body.Answer ?? [];
}

function decodeDnsTxt(value: string) {
  const matches = [...value.matchAll(/"((?:\\.|[^"\\])*)"/g)];
  if (!matches.length) return value.trim();
  return matches
    .map((match) => (match[1] ?? "").replace(/\\"/g, '"').replace(/\\\\/g, "\\"))
    .join("");
}

async function secureDnsRecords(hostname: string): Promise<MongoSrvRecords> {
  const [srvAnswers, txtAnswers] = await Promise.all([
    dnsJson(`_mongodb._tcp.${hostname}`, "SRV"),
    dnsJson(hostname, "TXT", true),
  ]);
  const srv = srvAnswers
    .filter((answer) => answer.type === 33 && answer.data)
    .map((answer) => {
      const parts = answer.data!.trim().split(/\s+/);
      if (parts.length !== 4) throw new Error("Secure DNS returned an invalid SRV record");
      const [priority, weight, port, name] = parts;
      return {
        name: name!.replace(/\.$/, ""),
        port: Number(port),
        priority: Number(priority),
        weight: Number(weight),
      } satisfies SrvRecord;
    });
  const txt = txtAnswers
    .filter((answer) => answer.type === 16 && answer.data)
    .map((answer) => decodeDnsTxt(answer.data!));
  return { srv, txt };
}

function setOption(options: URLSearchParams, name: string, value: string) {
  for (const key of [...options.keys()]) {
    if (key.toLowerCase() === name.toLowerCase()) options.delete(key);
  }
  options.set(name, value);
}

function hasOption(options: URLSearchParams, name: string) {
  return [...options.keys()].some((key) => key.toLowerCase() === name.toLowerCase());
}

export function buildMongoStandardUri(uri: string, records: MongoSrvRecords) {
  if (!uri.toLowerCase().startsWith("mongodb+srv://")) return uri;
  const parsed = new URL(uri);
  const hostname = parsed.hostname.toLowerCase();
  const firstDot = hostname.indexOf(".");
  if (firstDot <= 0 || firstDot === hostname.length - 1)
    throw new Error("MongoDB SRV hostname must contain a parent domain");
  const parentDomain = hostname.slice(firstDot);
  if (!records.srv.length) throw new Error("MongoDB SRV lookup returned no database hosts");
  const hosts = [...records.srv]
    .sort((left, right) => left.priority - right.priority || right.weight - left.weight)
    .map((record) => {
      const target = record.name.replace(/\.$/, "").toLowerCase();
      if (!target.endsWith(parentDomain) || target === parentDomain.slice(1))
        throw new Error("MongoDB SRV lookup returned a host outside the expected domain");
      if (!Number.isInteger(record.port) || record.port < 1 || record.port > 65_535)
        throw new Error("MongoDB SRV lookup returned an invalid port");
      return `${target}:${record.port}`;
    });

  if (records.txt.length > 1) throw new Error("MongoDB DNS returned multiple TXT records");
  const options = new URLSearchParams();
  if (records.txt[0]) {
    for (const [key, value] of new URLSearchParams(records.txt[0])) {
      if (!ALLOWED_TXT_OPTIONS.has(key.toLowerCase()))
        throw new Error(`MongoDB DNS returned unsupported TXT option: ${key}`);
      setOption(options, key, value);
    }
  }
  for (const [key, value] of parsed.searchParams) setOption(options, key, value);
  if (!hasOption(options, "tls") && !hasOption(options, "ssl")) options.set("tls", "true");

  const credentials = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
    : "";
  const path = parsed.pathname || "/";
  const query = options.toString();
  return `mongodb://${credentials}${hosts.join(",")}${path}${query ? `?${query}` : ""}`;
}

export async function resolveMongoConnectionUri(uri: string): Promise<MongoSrvResolution> {
  if (!uri.toLowerCase().startsWith("mongodb+srv://")) return { uri, source: "direct" };
  const hostname = new URL(uri).hostname;
  try {
    return { uri: buildMongoStandardUri(uri, await nativeRecords(hostname)), source: "native-dns" };
  } catch {
    return {
      uri: buildMongoStandardUri(uri, await secureDnsRecords(hostname)),
      source: "dns-over-https",
    };
  }
}
