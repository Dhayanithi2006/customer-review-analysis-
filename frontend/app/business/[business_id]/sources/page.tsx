"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileSpreadsheet,
  Smartphone,
  Apple,
  QrCode,
  FormInput,
  Star,
  Headset,
  Ticket,
  MessageSquare,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import {
  getBusiness,
  getBusinessAnalyses,
} from "@/lib/business-api";
import type { BusinessResponse, AnalysisVersion } from "@/lib/business-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { WorkspacePage } from "@/components/layout/workspace-page";

/* ── types ─────────────────────────────────────────────────────────────── */

type ConnectorStatus = "connected" | "available" | "coming_soon";

interface Connector {
  id: string;
  name: string;
  description: string;
  setup: string;
  status: ConnectorStatus;
  lastSync: string | null;
  icon: React.ReactNode;
  section: "connected" | "coming_soon";
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    external?: boolean;
  };
  detail?: React.ReactNode;
}

function formatSync(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function latestSourceSync(analyses: AnalysisVersion[], matchers: string[]) {
  const hit = analyses.find((a) => {
    const s = (a.source || "").toLowerCase();
    return matchers.some((m) => s.includes(m));
  });
  return hit ? formatSync(hit.created_at) : null;
}

function StatusBadge({ status }: { status: ConnectorStatus }) {
  if (status === "connected") {
    return (
      <Badge variant="success" className="gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Connected
      </Badge>
    );
  }
  if (status === "available") {
    return (
      <Badge variant="primary" className="gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8B7FF8]" />
        Available
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="gap-1.5">
      <CircleDashed size={10} />
      Coming Soon
    </Badge>
  );
}

function ConnectorCard({ connector }: { connector: Connector }) {
  const isSoon = connector.status === "coming_soon";

  return (
    <article
      className={cn(
        "rounded-[20px] border bg-surface p-5 md:p-6 flex flex-col",
        "shadow-[0_2px_12px_rgba(0,0,0,0.24)] transition-colors duration-200",
        isSoon
          ? "border-white/[0.05] opacity-80"
          : "border-border hover:border-white/[0.12]"
      )}
    >
      <div className="flex items-start gap-4 mb-4">
        <div
          className={cn(
            "w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0",
            isSoon
              ? "bg-surface-2 border-white/[0.05] text-slate-500"
              : "bg-primary/12 border-primary/25 text-primary-soft-2"
          )}
        >
          {connector.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <h3 className="text-sm font-bold text-white tracking-tight">
              {connector.name}
            </h3>
            <StatusBadge status={connector.status} />
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {connector.description}
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-5 flex-1">
        <div className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-3.5 py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-slate-600 font-bold mb-1">
            Setup
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">{connector.setup}</p>
        </div>

        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-[10px] uppercase tracking-[0.08em] text-slate-600 font-bold">
            Last sync
          </p>
          <p className="text-xs font-medium text-slate-400 font-mono">
            {isSoon
              ? "—"
              : connector.lastSync
              ? connector.lastSync
              : connector.status === "connected"
              ? "Ready"
              : "Never"}
          </p>
        </div>

        {connector.detail}
      </div>

      <div className="mt-auto pt-1">
        {isSoon ? (
          <Button variant="outline" size="sm" disabled className="w-full opacity-60">
            Coming Soon
          </Button>
        ) : connector.action?.href ? (
          <Button asChild size="sm" className="w-full" variant={connector.status === "connected" ? "secondary" : "default"}>
            <Link
              href={connector.action.href}
              target={connector.action.external ? "_blank" : undefined}
              rel={connector.action.external ? "noreferrer" : undefined}
            >
              {connector.action.label}
              {connector.action.external && <ExternalLink size={13} />}
            </Link>
          </Button>
        ) : connector.action?.onClick ? (
          <Button
            type="button"
            size="sm"
            className="w-full"
            variant={connector.status === "connected" ? "secondary" : "default"}
            onClick={connector.action.onClick}
          >
            {connector.action.label}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function FeedbackSourcesPage() {
  const params = useParams();
  const businessId = params.business_id as string;

  const [biz, setBiz] = useState<BusinessResponse | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"link" | "none">("none");

  useEffect(() => {
    const load = async () => {
      try {
        const [b, a] = await Promise.all([
          getBusiness(businessId),
          getBusinessAnalyses(businessId).catch(() => ({ analyses: [] as AnalysisVersion[] })),
        ]);
        setBiz(b);
        setAnalyses(a.analyses || []);
      } catch {
        setBiz(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId]);

  const copyLink = async () => {
    if (!biz?.feedback_url) return;
    try {
      await navigator.clipboard.writeText(biz.feedback_url);
      setCopied("link");
      setTimeout(() => setCopied("none"), 2000);
    } catch {
      /* ignore */
    }
  };

  const connectors = useMemo((): Connector[] => {
    if (!biz) return [];

    const method = (biz.feedback_method || "").toLowerCase();
    const hasQr =
      Boolean(biz.qr_code) ||
      biz.feedback_type === "qr" ||
      method === "qr";
    const hasForm = Boolean(biz.feedback_url);
    const csvSync = latestSourceSync(analyses, ["csv"]);
    const playSync = latestSourceSync(analyses, ["play", "google_play", "play_store"]);
    const appSync = latestSourceSync(analyses, ["app_store", "apple", "ios"]);

    const available: Connector[] = [
      {
        id: "csv",
        name: "CSV Upload",
        description:
          "Import exported reviews from any tool. Columns are auto-detected and normalized.",
        setup: "Upload a .csv from the analysis flow. Attach results to this workspace timeline.",
        status: csvSync ? "connected" : "available",
        lastSync: csvSync,
        icon: <FileSpreadsheet size={18} strokeWidth={1.75} />,
        section: "connected",
        action: { label: csvSync ? "Upload again" : "Connect", href: "/" },
      },
      {
        id: "google_play",
        name: "Google Play",
        description:
          "Pull live Android reviews by package ID through the Play Store scraper.",
        setup: "Enter a package ID (e.g. com.example.app) and run analysis.",
        status: playSync ? "connected" : "available",
        lastSync: playSync,
        icon: <Smartphone size={18} strokeWidth={1.75} />,
        section: "connected",
        action: { label: playSync ? "Sync again" : "Connect", href: "/" },
      },
      {
        id: "app_store",
        name: "App Store",
        description:
          "Fetch iOS customer reviews via Apple’s public RSS reviews feed.",
        setup: "Provide a numeric Apple App ID and ingest through the App Store adapter.",
        status: appSync ? "connected" : "available",
        lastSync: appSync,
        icon: <Apple size={18} strokeWidth={1.75} />,
        section: "connected",
        action: { label: appSync ? "Sync again" : "Connect", href: "/" },
      },
      {
        id: "qr",
        name: "QR Feedback Widget",
        description:
          "Printable QR that opens your workspace feedback surface for on-site collection.",
        setup: hasQr
          ? "QR is provisioned for this workspace. Print or share it at physical locations."
          : "Enable QR feedback during business registration or regenerate from settings.",
        status: hasQr ? "connected" : "available",
        lastSync: hasQr ? formatSync(biz.created_at) : null,
        icon: <QrCode size={18} strokeWidth={1.75} />,
        section: "connected",
        action: hasQr
          ? { label: "View setup", href: `#qr-detail` }
          : { label: "Connect", href: `/business/${businessId}/settings` },
        detail:
          hasQr && biz.qr_code ? (
            <div id="qr-detail" className="flex items-center gap-4 pt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={biz.qr_code}
                alt="Feedback QR code"
                className="w-24 h-24 rounded-2xl border border-white/[0.08] bg-white p-1.5"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Scan to open the feedback form for {biz.business_name}.
              </p>
            </div>
          ) : undefined,
      },
      {
        id: "form",
        name: "Feedback Form",
        description:
          "Hosted digital feedback form tied to this workspace’s collection URL.",
        setup: hasForm
          ? "Share the workspace feedback link with customers or embed it in your product."
          : "Feedback URL is created when the business workspace is registered.",
        status: hasForm ? "connected" : "available",
        lastSync: hasForm ? formatSync(biz.created_at) : null,
        icon: <FormInput size={18} strokeWidth={1.75} />,
        section: "connected",
        action: hasForm
          ? {
              label: copied === "link" ? "Copied" : "Copy link",
              onClick: copyLink,
            }
          : { label: "Connect", href: `/business/${businessId}/settings` },
        detail: hasForm ? (
          <div className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-3.5 py-2.5">
            <p className="text-[10px] text-slate-600 font-bold mb-1">Feedback URL</p>
            <p className="text-[11px] font-mono text-slate-400 break-all leading-relaxed">
              {biz.feedback_url}
            </p>
            <div className="flex gap-2 mt-2.5">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-soft hover:text-white transition-colors"
              >
                {copied === "link" ? <Check size={12} /> : <Copy size={12} />}
                {copied === "link" ? "Copied" : "Copy"}
              </button>
              <a
                href={biz.feedback_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors no-underline"
              >
                <ExternalLink size={12} /> Open
              </a>
            </div>
          </div>
        ) : undefined,
      },
    ];

    const comingSoon: Connector[] = [
      {
        id: "google_reviews",
        name: "Google Reviews",
        description:
          "Ingest Google Business Profile reviews into the same decision pipeline.",
        setup: "OAuth connect to Google Business Profile. Not available yet.",
        status: "coming_soon",
        lastSync: null,
        icon: <Star size={18} strokeWidth={1.75} />,
        section: "coming_soon",
      },
      {
        id: "zendesk",
        name: "Zendesk",
        description:
          "Sync support tickets and conversation themes as structured feedback.",
        setup: "API token + subdomain. Connector ships in a future release.",
        status: "coming_soon",
        lastSync: null,
        icon: <Headset size={18} strokeWidth={1.75} />,
        section: "coming_soon",
      },
      {
        id: "freshdesk",
        name: "Freshdesk",
        description:
          "Pull helpdesk tickets and categorize them alongside store reviews.",
        setup: "Freshdesk domain + API key. Planned — not connected today.",
        status: "coming_soon",
        lastSync: null,
        icon: <Ticket size={18} strokeWidth={1.75} />,
        section: "coming_soon",
      },
      {
        id: "intercom",
        name: "Intercom",
        description:
          "Convert customer conversations into issue clusters for the Decision Center.",
        setup: "Intercom workspace install. Planned — not connected today.",
        status: "coming_soon",
        lastSync: null,
        icon: <MessageSquare size={18} strokeWidth={1.75} />,
        section: "coming_soon",
      },
    ];

    return [...available, ...comingSoon];
  }, [biz, analyses, businessId, copied]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="md" label="Loading connectors…" />
      </div>
    );
  }

  if (!biz) {
    return (
      <div className="px-5 sm:px-8 py-10 max-w-lg mx-auto text-center">
        <p className="text-sm text-slate-400">Workspace not found.</p>
      </div>
    );
  }

  const live = connectors.filter((c) => c.section === "connected");
  const soon = connectors.filter((c) => c.section === "coming_soon");
  const connectedCount = live.filter((c) => c.status === "connected").length;

  return (
    <WorkspacePage>
      <div className="mb-10 md:mb-12">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
          Feedback Sources
        </p>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          Collection methods
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-xl leading-relaxed">
          Manage every way customer signal enters this workspace. Only real connectors
          can sync — future ones stay clearly marked.
        </p>

        <div className="flex flex-wrap items-center gap-4 mt-5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-400" />
            {connectedCount} connected
          </span>
          <span className="text-slate-700">·</span>
          <span>{live.length} available today</span>
          <span className="text-slate-700">·</span>
          <span>{soon.length} coming soon</span>
        </div>
      </div>

      {/* Connected / Available */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-sm font-bold text-white tracking-tight">Connected</h2>
          <p className="text-xs text-slate-500 mt-1">
            Live product connectors you can use right now.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {live.map((c) => (
            <ConnectorCard key={c.id} connector={c} />
          ))}
        </div>
      </section>

      {/* Coming Soon */}
      <section>
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-bold text-white tracking-tight">Coming Soon</h2>
            <Badge variant="default">Not available</Badge>
          </div>
          <p className="text-xs text-slate-500">
            These integrations are planned. They are not connected and cannot sync yet.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {soon.map((c) => (
            <ConnectorCard key={c.id} connector={c} />
          ))}
        </div>
      </section>
    </WorkspacePage>
  );
}
