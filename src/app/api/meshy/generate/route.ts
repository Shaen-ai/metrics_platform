import { NextRequest, NextResponse } from "next/server";
import { getPublicApiUrl } from "@/lib/publicEnv";


const MESHY_BASE_URL = "https://api.meshy.ai/openapi/v1";
const LARAVEL_API = getPublicApiUrl();

async function consumeImage3dSlot(authHeader: string, consume: boolean) {
  const res = await fetch(`${LARAVEL_API.replace(/\/$/, "")}/usage/consume`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ feature: "image3d", consume }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    message?: string;
    entitlements?: unknown;
  };
  return { ok: res.ok, status: res.status, data };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Image-to-3D is not configured on this server. Add MESHY_API_KEY to the admin app environment." },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Sign in is required to use Image-to-3D (plan limits apply)." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { imageBase64, mimeType, texturePrompt } = body as {
      imageBase64: string;
      mimeType: string;
      texturePrompt?: string;
    };

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "imageBase64 and mimeType are required" },
        { status: 400 },
      );
    }

    const quota = await consumeImage3dSlot(auth, false);
    if (!quota.ok) {
      return NextResponse.json(
        {
          error: quota.data.message || "Image-to-3D quota exceeded for your plan.",
          entitlements: quota.data.entitlements,
        },
        { status: quota.status >= 400 ? quota.status : 429 },
      );
    }

    const imageUrl = `data:${mimeType};base64,${imageBase64}`;

    const payload: Record<string, unknown> = {
      image_url: imageUrl,
      should_texture: true,
      enable_pbr: false,
      should_remesh: true,
      topology: "triangle",
      target_polycount: 5000,
      target_formats: ["glb"],
    };

    if (texturePrompt && texturePrompt.trim()) {
      payload.texture_prompt = texturePrompt.slice(0, 600);
    }

    const response = await fetch(`${MESHY_BASE_URL}/image-to-3d`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Meshy API error: ${response.status} - ${errorText}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const jobId = data.result;
    if (!jobId) {
      return NextResponse.json(
        { error: "Meshy did not return a generation job id." },
        { status: 502 },
      );
    }

    const consumed = await consumeImage3dSlot(auth, true);
    if (!consumed.ok) {
      return NextResponse.json(
        {
          error: consumed.data.message || "Image-to-3D quota exceeded for your plan.",
          entitlements: consumed.data.entitlements,
        },
        { status: consumed.status >= 400 ? consumed.status : 429 },
      );
    }

    return NextResponse.json({
      jobId,
      entitlements: consumed.data.entitlements,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
