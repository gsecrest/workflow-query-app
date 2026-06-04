import { NextResponse } from "next/server";
import { getDatabases } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ databases: getDatabases() });
}
