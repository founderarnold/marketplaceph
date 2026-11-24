"use client";

import { Printer } from "lucide-react";
import { recordJobEvent } from "@/app/actions/jobs2";
import { Button } from "@/components/ui/button";

/** Plain print styles for the copied resume: black text, one column, system fonts (ATS- and printer-friendly). */
export const RESUME_PRINT_CSS = `
  @page { margin: 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11pt; line-height: 1.45; margin: 0; }
  h2 { font-size: 18pt; margin: 0 0 2pt; } h3 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #999; margin: 12pt 0 4pt; }
  p { margin: 0 0 3pt; } ul { list-style: none; padding: 0; margin: 0; } li { margin: 0 0 6pt; } .font-semibold, .font-bold { font-weight: 700; }
  .whitespace-pre-line { white-space: pre-line; }
`;

/**
 * Prints only the resume: its HTML is copied into a hidden frame with plain styles, so the site's menus never print.
 * "Save as PDF" in the print dialog makes the PDF on the device; nothing is uploaded.
 */
export function PrintButton({ label, targetId = "resume" }: { label: string; targetId?: string }) {
  const print = () => {
    recordJobEvent("resume_generated").catch(() => {});
    const src = document.getElementById(targetId);
    if (!src) return window.print();
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><html lang="${document.documentElement.lang || "en"}"><head><meta charset="utf-8"><title>${document.title}</title><style>${RESUME_PRINT_CSS}</style></head><body>${src.innerHTML}</body></html>`);
    doc.close();
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  return (
    <Button type="button" size="lg" className="w-full gap-2 sm:w-auto" onClick={print}>
      <Printer size={18} aria-hidden /> {label}
    </Button>
  );
}
