import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ShareLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/s/${slug}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-5">
        <div className="rounded-xl border border-border/70 p-3 bg-white shrink-0">
          <QRCodeSVG value={url} size={128} bgColor="transparent" fgColor="hsl(226, 64%, 24%)" />
        </div>
        <div className="flex-1 min-w-0 w-full">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Shareable link</div>
          <div className="mt-1.5 rounded-lg bg-muted/60 border border-border/60 px-3 py-2.5 font-mono text-xs sm:text-sm break-all">{url}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={copy} className="rounded-lg">
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button size="sm" variant="outline" asChild className="rounded-lg">
              <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Open</a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
