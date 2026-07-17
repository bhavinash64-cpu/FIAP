/** Building and handing out the parent-facing survey link. */

export function surveyUrl(slug: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/s/${slug}`;
}

/** The message that travels with the link on every channel. */
export function shareText(intro: string, url: string): string {
  return `${intro}\n\n${url}`;
}

export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * iOS wants `sms:&body=`, Android wants `sms:?body=`. `sms:?&body=` is the form
 * both parse, and it is what every cross-platform share sheet settles on.
 */
export function smsHref(text: string): string {
  return `sms:?&body=${encodeURIComponent(text)}`;
}

export function mailtoHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Web Share API — the native sheet on a phone, absent on most desktops. */
export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function nativeShare(title: string, text: string, url: string): Promise<boolean> {
  if (!canNativeShare()) return false;
  try {
    await navigator.share({ title, text, url });
    return true;
  } catch {
    // A cancelled share sheet rejects; that isn't a failure worth surfacing.
    return false;
  }
}

/**
 * Pull the PNG out of a rendered <QRCodeCanvas>.
 *
 * The canvas is found by query rather than a forwarded ref: qrcode.react's ref
 * forwarding has moved between majors, and a querySelector on a wrapper we own
 * can't be broken by an upgrade.
 */
export function downloadQrPng(container: HTMLElement | null, filename: string): boolean {
  const canvas = container?.querySelector("canvas");
  if (!canvas) return false;
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

/** Filesystem-safe, human-recognisable file name for a survey's QR. */
export function qrFileName(title: string, slug: string): string {
  const stem =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "survey";
  return `qr-${stem}-${slug}`;
}

/**
 * Print only the element carrying `.print-sheet`.
 *
 * `body.printing > *:not(.print-sheet)` (see index.css) needs the sheet to be a
 * direct child of body, which is why <PrintSheet> portals. The body class is
 * removed on afterprint — and on a timer as well, because Safari has never
 * reliably fired afterprint and a stuck class would blank the admin console on
 * the next Ctrl+P.
 */
export function printSheetOnly() {
  if (typeof document === "undefined") return;
  document.body.classList.add("printing");
  const cleanup = () => {
    document.body.classList.remove("printing");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.setTimeout(cleanup, 60_000);
  window.print();
}
