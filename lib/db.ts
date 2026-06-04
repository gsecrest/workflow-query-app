import sql from "mssql";
import { spawnSync } from "child_process";

function resolvePassword(key: string): string {
  const encrypted = process.env[`DB_${key}_PASSWORD_ENCRYPTED`];
  if (encrypted) {
    const result = spawnSync(
      "powershell.exe",
      [
        "-NonInteractive",
        "-Command",
        "Add-Type -AssemblyName System.Security; [System.Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect([System.Convert]::FromBase64String($env:ENCRYPTED_PW), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))",
      ],
      { env: { ...process.env, ENCRYPTED_PW: encrypted }, encoding: "utf8" }
    );
    if (result.status === 0) return result.stdout.trim();
  }
  return process.env[`DB_${key}_PASSWORD`] ?? "";
}

export interface DbInfo {
  key: string;
  label: string;
}

export function getDatabases(): DbInfo[] {
  return (process.env.DB_NAMES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((key) => ({ key, label: process.env[`DB_${key}_LABEL`] ?? key }));
}

const pools = new Map<string, { pool: sql.ConnectionPool; connect: Promise<sql.ConnectionPool> }>();

export function getPool(key: string) {
  if (!pools.has(key)) {
    const config: sql.config = {
      server: process.env[`DB_${key}_SERVER`]!,
      database: process.env[`DB_${key}_DATABASE`]!,
      user: process.env[`DB_${key}_USER`]!,
      password: resolvePassword(key),
      port: parseInt(process.env[`DB_${key}_PORT`] ?? "1433"),
      requestTimeout: 60000,
      connectionTimeout: 30000,
      options: { encrypt: true, trustServerCertificate: true },
    };
    const pool = new sql.ConnectionPool(config);
    pools.set(key, { pool, connect: pool.connect() });
  }
  return pools.get(key)!;
}

export function defaultDbKey(): string {
  const first = (process.env.DB_NAMES ?? "").split(",")[0]?.trim();
  return first ?? "";
}
