import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

// Fallback user ID for demo purposes without complex auth integration
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

async function ensureDemoUser() {
  const user = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
  });
  if (!user) {
    await prisma.user.create({
      data: {
        id: DEMO_USER_ID,
        email: "demo@blogautowrite.com",
      },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and API Key are required" },
        { status: 400 }
      );
    }

    const upperProvider = provider.toUpperCase();

    // Ensure demo user exists in DB first
    await ensureDemoUser();

    // Encrypt the key safely (Secure Mode)
    const encryptedKey = encrypt(apiKey);

    // Upsert key
    await prisma.apiKey.upsert({
      where: {
        userId_provider: {
          userId: DEMO_USER_ID,
          provider: upperProvider,
        },
      },
      update: {
        encryptedKey,
      },
      create: {
        userId: DEMO_USER_ID,
        provider: upperProvider,
        encryptedKey,
      },
    });

    return NextResponse.json({ success: true, message: "API Key registered successfully" });
  } catch (error: any) {
    console.error("API Key registration error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureDemoUser();

    const keys = await prisma.apiKey.findMany({
      where: { userId: DEMO_USER_ID },
      select: {
        provider: true,
        updatedAt: true,
      },
    });

    // Map to readable form without exposing raw keys
    const result = keys.map((key) => ({
      provider: key.provider,
      hasKey: true,
      updatedAt: key.updatedAt.toISOString(),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Fetch API Keys error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
