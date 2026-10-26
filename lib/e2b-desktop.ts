import { E2B } from "@e2b/desktop";

export function getDesktopSandbox() {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new Error("E2B_API_KEY is not configured");
  }

  return new E2B({ apiKey }).Sandbox;
}
