import { NextRequest, NextResponse } from "next/server";
import { getPublicApiUrl } from "@/lib/publicEnv";


const MESHY_BASE_URL = "https://api.meshy.ai/openapi/v1";
const BACKEND_API_URL = getPublicApiUrl();

const STATUS_MAP: Record<string, string> = {
  PENDING: "queued",
  IN_PROGRESS: "processing",
  SUCCEEDED: "done",
  FAILED: "failed",
};

async function persistEntityModelFields(
  entityType: string,
  entityId: string,
  authHeader: string,
  fields: { model_url?: string; model_status: string; model_error?: string | null }
): Promise<void> {
  const path =
    entityType === "module"
      ? `/modules/${entityId}`
      : `/catalog-items/${entityId}`;
  const body: Record<string, unknown> = { model_status: fields.model_status };
  if (fields.model_url !== undefined) body.model_url = fields.model_url;
  if (fields.model_error !== undefined) body.model_error = fields.model_error;

  const res = await fetch(`${BACKEND_API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to persist model (${res.status}): ${text.slice(0, 200)}`
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "MESHY_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const { jobId } = await params;
  const entityId =
    request.nextUrl.searchParams.get("entityId") ??
    request.nextUrl.searchParams.get("catalogItemId");
  const entityType =
    request.nextUrl.searchParams.get("entityType") ?? "catalog";
  const authHeader = request.headers.get("authorization");

  try {
    const response = await fetch(`${MESHY_BASE_URL}/image-to-3d/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Meshy API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const providerStatus = data.status ?? "unknown";
    const status = STATUS_MAP[providerStatus] ?? "processing";
    const glbUrl = data.model_urls?.glb ?? data.model_url ?? null;

    if (status === "done" && glbUrl && entityId && authHeader) {
      try {
        const modelPath = await downloadAndUploadGlb(glbUrl, entityId, authHeader);
        try {
          await persistEntityModelFields(entityType, entityId, authHeader, {
            model_url: modelPath,
            model_status: "done",
            model_error: null,
          });
        } catch (persistErr) {
          console.error("[meshy/status] persist done:", persistErr);
        }
        return NextResponse.json({ status, modelPath });
      } catch (downloadErr) {
        const msg =
          downloadErr instanceof Error
            ? downloadErr.message
            : "GLB download failed";
        try {
          await persistEntityModelFields(entityType, entityId, authHeader, {
            model_status: "failed",
            model_error: msg,
          });
        } catch (persistErr) {
          console.error("[meshy/status] persist download failure:", persistErr);
        }
        return NextResponse.json({ status, glbUrl, downloadError: msg });
      }
    }

    const errorMessage =
      status === "failed"
        ? data.task_error?.message || data.error || "Generation failed"
        : undefined;

    if (status === "failed" && entityId && authHeader) {
      try {
        await persistEntityModelFields(entityType, entityId, authHeader, {
          model_status: "failed",
          model_error: errorMessage ?? "Generation failed",
        });
      } catch (persistErr) {
        console.error("[meshy/status] persist failed:", persistErr);
      }
    }

    return NextResponse.json({ status, glbUrl, error: errorMessage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function downloadAndUploadGlb(
  glbUrl: string,
  entityId: string,
  authHeader: string
): Promise<string> {
  const filename = `${entityId}.glb`;

  const res = await fetch(`${BACKEND_API_URL}/download-remote-model`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ url: glbUrl, filename }),
    signal: AbortSignal.timeout(120000),
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Backend returned non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to download GLB to storage");
  }

  return data.url;
}
