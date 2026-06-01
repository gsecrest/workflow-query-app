import { execSync } from "child_process";

function resolveDbPassword(): string {
  const encrypted = process.env.DB_PASSWORD_ENCRYPTED;
  if (encrypted) {
    return execSync(
      `powershell -Command "[System.Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect([System.Convert]::FromBase64String('${encrypted}'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))"`
    )
      .toString()
      .trim();
  }
  return process.env.DB_PASSWORD ?? "";
}

export const dbPassword = resolveDbPassword();
