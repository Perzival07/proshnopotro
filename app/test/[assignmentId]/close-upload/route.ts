import { closeAnswerUpload } from "../actions";

/**
 * Closes the answer upload as the student leaves the page.
 *
 * A route rather than a server action because it is called with
 * `navigator.sendBeacon`, the one request a browser still delivers while the
 * page is being torn down.
 */
export async function POST(
  request: Request,
  { params }: { params: { assignmentId: string } }
) {
  // Only this site's own pages may close an upload.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }

  await closeAnswerUpload(params.assignmentId);
  return new Response(null, { status: 204 });
}
