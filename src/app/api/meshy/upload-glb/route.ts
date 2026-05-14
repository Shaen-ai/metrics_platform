import { NextRequest, NextResponse } from "next/server";
import { MAX_MODEL_UPLOAD_BYTES, MAX_MODEL_UPLOAD_LABEL } from "@/lib/uploadLimits";
import { getPublicApiUrl } from "@/lib/publicEnv";


const API_URL = getPublicApiUrl();

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const incomingForm = await request.formData();
    const file = incomingForm.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".glb") && !file.name.endsWith(".gltf")) {
      return NextResponse.json(
        { error: "Only .glb and .gltf files are accepted" },
        { status: 400 }
      );
    }

    if (file.size > MAX_MODEL_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File must be ${MAX_MODEL_UPLOAD_LABEL} or smaller` },
        { status: 413 }
      );
    }

    const fd = new FormData();
    fd.append("model", file, file.name);
    fd.append("filename", file.name);

    const res = await fetch(`${API_URL}/upload-model`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authHeader,
      },
      body: fd,
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Upload failed" },
        { status: res.status }
      );
    }

    return NextResponse.json({ modelPath: data.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
