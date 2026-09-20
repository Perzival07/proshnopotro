import React from "react";
import { prisma } from "@/lib/prisma";
import { signedAnswerUrl } from "@/lib/cloudinary";
import { sanitizeAnnotations } from "@/lib/annotations";
import { AnnotationLayer } from "@/components/AnnotationLayer";

/**
 * A student's answer pages with their tutor's marks drawn over them, once the
 * copy has been returned. The photos are private: each is shown through a
 * signed link made for this page view.
 */
export async function MarkedSheets({ assignmentId }: { assignmentId: string }) {
  const [images, attempt] = await Promise.all([
    prisma.answerImage.findMany({ where: { assignmentId }, orderBy: { position: "asc" } }),
    prisma.assignment.findUnique({ where: { id: assignmentId }, select: { photosDeletedAt: true } }),
  ]);
  if (images.length === 0) {
    // The tutor cleared the photos to save space: say so, so their absence is
    // not mistaken for a fault. The marks and comments are all still here.
    return attempt?.photosDeletedAt ? (
      <p className="rounded-lg border border-brand-border bg-white p-3 text-xs text-brand-ink/70">
        Your tutor has removed your answer photos to save space. Your marks, comments and feedback are kept.
      </p>
    ) : null;
  }

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-base font-bold text-brand-navy">Your marked answer sheets</h2>
      <div className="space-y-4">
        {images.map((image, i) => {
          const width = image.width ?? 1200;
          const height = image.height ?? 1600;
          const url = signedAnswerUrl(image, 1600);
          const marks = sanitizeAnnotations(image.annotations, { width, height }) ?? [];
          return (
            <figure key={image.id} className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-xs">
              <div className="relative w-full" style={{ aspectRatio: `${width} / ${height}` }}>
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Answer page ${i + 1}`} loading="lazy" className="absolute inset-0 h-full w-full" />
                )}
                <AnnotationLayer annotations={marks} width={width} height={height} />
              </div>
              <figcaption className="border-t border-brand-border px-3 py-1.5 text-[11px] text-brand-ink/60">
                Page {i + 1}
                {marks.length > 0 ? " · marked" : ""}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
