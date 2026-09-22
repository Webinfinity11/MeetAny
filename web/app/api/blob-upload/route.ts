// Thin Route Handler wrapper around ../../lib/blob-upload-handler.js (ported from
// site/api/blob-upload.js unchanged).
import handler from "../../lib/blob-upload-handler.js";

export async function POST(request: Request) {
  return handler.fetch(request);
}

export async function DELETE(request: Request) {
  return handler.fetch(request);
}
