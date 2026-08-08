"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileSpreadsheet,
  QrCode,
  FormInput,
  Database,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  getBusiness,
  getBusinessAnalyses,
  regenerateQr,
  loadSampleData,
} from "@/lib/business-api";
import type { BusinessResponse, AnalysisVersion } from "@/lib/business-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { WorkspacePage } from "@/components/layout/workspace-page";

/* ── types ─────────────────────────────────────────────────────────────── */

type ConnectorStatus = "connected" | "available";

interface Connector {
  id: string;
  name: string;
  description: string;
  setup: string;
  status: ConnectorStatus;
  lastSync: string | null;
  icon: React.ReactNode;
  section: "collect" | "import";
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    external?: boolean;
    loading?: boolean;
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
  return (
    <Badge variant="primary" className="gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-[#8B7FF8]" />
      Available
    </Badge>
  );
}

function ConnectorCard({ connector }: { connector: Connector }) {
  return (
    <article
      className={cn(
        "rounded-[20px] border bg-surface p-5 md:p-6 flex flex-col",
        "shadow-[0_2px_12px_rgba(0,0,0,0.24)] transition-colors duration-200",
        "border-border hover:border-white/[0.12]"
      )}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 bg-primary/12 border-primary/25 text-primary-soft-2">
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
            {connector.lastSync
              ? connector.lastSync
              : connector.status === "connected"
              ? "Ready"
              : "Never"}
          </p>
        </div>

        {connector.detail}
      </div>

      <div className="mt-auto pt-1">
        {connector.action?.href ? (
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
            disabled={connector.action.loading}
          >
            {connector.action.loading ? "Working…" : connector.action.label}
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
  const [copied, setCopied] = useState<"link" | "qr" | "none">("none");
  const [busy, setBusy] = useState<"qr" | "sample" | null>(null);

  const reload = async () => {
    const [b, a] = await Promise.all([
      getBusiness(businessId),
      getBusinessAnalyses(businessId).catch(() => ({ analyses: [] as AnalysisVersion[] })),
    ]);
    setBiz(b);
    setAnalyses(a.analyses || []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await reload();
      } catch {
        const fallback = await getBusiness(businessId);
        setBiz(fallback);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const copyText = async (text: string, kind: "link" | "qr") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied("none"), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleRegenerateQr = async () => {
    setBusy("qr");
    try {
      const updated = await regenerateQr(businessId);
      setBiz(updated);
    } catch {
      /* toast handled in api helper */
    } finally {
      setBusy(null);
    }
  };

  const handleSampleData = async () => {
    setBusy("sample");
    try {
      const result = await loadSampleData(businessId);
      await reload();
      if (result.session_id) {
        window.location.href = `/dashboard/${result.session_id}/processing`;
      }
    } catch {
      /* toast handled in api helper */
    } finally {
      setBusy(null);
    }
  };

  const safeBiz = biz || {
    id: businessId || "freshmart",
    business_name: "FreshMart Supermarket Pro",
    industry: "Supermarket",
    email: "feedback@freshmart.com",
    feedback_url: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/feedback/${businessId || "freshmart"}`,
    dashboard_url: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/business/${businessId || "freshmart"}`,
    qr_code:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23ffffff'/><rect x='20' y='20' width='60' height='60' fill='%231e1b4b'/><rect x='30' y='30' width='40' height='40' fill='%23ffffff'/><rect x='40' y='40' width='20' height='20' fill='%231e1b4b'/><rect x='120' y='20' width='60' height='60' fill='%231e1b4b'/><rect x='130' y='30' width='40' height='40' fill='%23ffffff'/><rect x='140' y='40' width='20' height='20' fill='%231e1b4b'/><rect x='20' y='120' width='60' height='60' fill='%231e1b4b'/><rect x='30' y='130' width='40' height='40' fill='%23ffffff'/><rect x='40' y='140' width='20' height='20' fill='%231e1b4b'/><rect x='100' y='40' width='10' height='20' fill='%231e1b4b'/><rect x='90' y='90' width='20' height='20' fill='%231e1b4b'/><rect x='120' y='100' width='30' height='20' fill='%231e1b4b'/><rect x='120' y='140' width='60' height='40' fill='%231e1b4b'/><rect x='140' y='150' width='20' height='20' fill='%23ffffff'/></svg>",
    feedback_type: "qr",
    feedback_method: "qr",
    engagement_mode: "reward",
    monthly_customers: 20000,
    avg_revenue_per_user: 450,
    premium_pct: 18,
    currency: "INR",
    created_at: new Date().toISOString(),
  };

  const currentBiz = biz || safeBiz;

  const connectors = useMemo((): Connector[] => {
    const b = currentBiz;
    const hasQr = Boolean(b.qr_code);
    const hasForm = Boolean(b.feedback_url);
    const csvSync = latestSourceSync(analyses, ["csv"]);
    const sampleSync = latestSourceSync(analyses, ["sample"]);
    const qrFeedbackUrl = b.feedback_url
      ? `${b.feedback_url}${b.feedback_url.includes("?") ? "&" : "?"}source=qr`
      : "";

    return [
      {
        id: "qr",
        name: "QR Feedback",
        description:
          "Printable QR for on-site collection. Scanning opens this workspace’s feedback form with source=qr.",
        setup: hasQr
          ? "QR is ready. Print it at physical locations or regenerate if the link changed."
          : "Generate a QR that encodes this business’s feedback URL.",
        status: hasQr ? "connected" : "available",
        lastSync: hasQr ? formatSync(b.created_at) : null,
        icon: <QrCode size={18} strokeWidth={1.75} />,
        section: "collect",
        action: hasQr
          ? { label: busy === "qr" ? "Regenerating…" : "Regenerate QR", onClick: handleRegenerateQr, loading: busy === "qr" }
          : { label: busy === "qr" ? "Generating…" : "Generate QR", onClick: handleRegenerateQr, loading: busy === "qr" },
        detail:
          hasQr && b.qr_code ? (
            <div id="qr-detail" className="flex items-center gap-4 pt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.qr_code}
                alt="Feedback QR code"
                className="w-24 h-24 rounded-2xl border border-white/[0.08] bg-white p-1.5"
              />
              <div className="min-w-0 space-y-2">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Encodes the business-specific feedback URL for {b.business_name}.
                </p>
                {qrFeedbackUrl && (
                  <button
                    type="button"
                    onClick={() => copyText(qrFeedbackUrl, "qr")}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-soft hover:text-white transition-colors"
                  >
                    {copied === "qr" ? <Check size={12} /> : <Copy size={12} />}
                    {copied === "qr" ? "Copied QR URL" : "Copy QR URL"}
                  </button>
                )}
                <a
                  href={b.qr_code || "#"}
                  download={`${b.business_name.replace(/\s+/g, "_")}_QR.png`}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors no-underline"
                >
                  <RefreshCw size={12} /> Download PNG
                </a>
              </div>
            </div>
          ) : undefined,
      },
      {
        id: "direct",
        name: "Direct Feedback URL",
        description:
          "Share the hosted form link when a QR scan is not needed. Submissions are tagged source=direct.",
        setup: hasForm
          ? "Copy and share the workspace feedback link with customers."
          : "Feedback URL is created when the business workspace is registered.",
        status: hasForm ? "connected" : "available",
        lastSync: hasForm ? formatSync(b.created_at) : null,
        icon: <FormInput size={18} strokeWidth={1.75} />,
        section: "collect",
        action: hasForm
          ? {
              label: copied === "link" ? "Copied" : "Copy link",
              onClick: () => copyText(b.feedback_url, "link"),
            }
          : undefined,
        detail: hasForm ? (
          <div className="rounded-xl bg-[#0E1424] border border-white/[0.04] px-3.5 py-2.5">
            <p className="text-[10px] text-slate-600 font-bold mb-1">Feedback URL</p>
            <p className="text-[11px] font-mono text-slate-400 break-all leading-relaxed">
              {b.feedback_url}
            </p>
            <div className="flex gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => copyText(b.feedback_url, "link")}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-soft hover:text-white transition-colors"
              >
                {copied === "link" ? <Check size={12} /> : <Copy size={12} />}
                {copied === "link" ? "Copied" : "Copy"}
              </button>
              <a
                href={b.feedback_url}
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
      {
        id: "csv",
        name: "CSV Upload",
        description:
          "Import surveys, support exports, or review dumps. Tagged source=csv and linked to this workspace.",
        setup: "Upload a .csv from the home Analyze form, then open results from Analysis history.",
        status: csvSync ? "connected" : "available",
        lastSync: csvSync,
        icon: <FileSpreadsheet size={18} strokeWidth={1.75} />,
        section: "import",
        action: { label: csvSync ? "Upload again" : "Upload CSV", href: "/#cta" },
      },
      {
        id: "sample",
        name: "Sample Data",
        description:
          "Load the bundled demo reviews into this workspace (source=sample) and run the decision pipeline.",
        setup: "One click loads sample_reviews.csv for demos when you do not have real feedback yet.",
        status: sampleSync ? "connected" : "available",
        lastSync: sampleSync,
        icon: <Database size={18} strokeWidth={1.75} />,
        section: "import",
        action: {
          label: busy === "sample" ? "Loading…" : sampleSync ? "Reload sample" : "Load sample data",
          onClick: handleSampleData,
          loading: busy === "sample",
        },
      },
    ];
  }, [biz, analyses, businessId, copied, busy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="md" label="Loading collection methods…" />
      </div>
    );
  }

  const collect = connectors.filter((c) => c.section === "collect");
  const imports = connectors.filter((c) => c.section === "import");
  const connectedCount = connectors.filter((c) => c.status === "connected").length;

  return (
    <WorkspacePage>
      <div className="mb-10 md:mb-12">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
          Feedback Sources
        </p>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          How feedback enters this workspace
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-xl leading-relaxed">
          MVP collection: QR, direct URL, CSV upload, and sample data. Every submission is scoped to this business only.
        </p>

        <div className="flex flex-wrap items-center gap-4 mt-5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-400" />
            {connectedCount} connected
          </span>
          <span className="text-slate-700">·</span>
          <span>4 methods available</span>
        </div>
      </div>

      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-sm font-bold text-white tracking-tight">
            Collect from customers
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            QR and direct URL open the same public form — no login required.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {collect.map((c) => (
            <ConnectorCard key={c.id} connector={c} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5">
          <h2 className="text-sm font-bold text-white tracking-tight">
            Import existing feedback
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            CSV archives and bundled sample data for demos — both run through the same pipeline.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {imports.map((c) => (
            <ConnectorCard key={c.id} connector={c} />
          ))}
        </div>
      </section>
    </WorkspacePage>
  );
}
