"""
Centralized Revenue Impact + Priority scoring (deterministic, zero AI).

Estimated Revenue Impact / at Risk — never claimed as "actual revenue lost".

Formulas:
  affected_customers = unique observed feedback/customer records per cluster
  customer_reach_percentage = min(100, affected / monthly_customers * 100)
  estimated_revenue_impact = affected × ARPU × severity_risk_factor
  Priority Score (0–100) =
      Revenue×0.35 + Reach×0.30 + Severity×0.20 + Tier×0.15
"""
from __future__ import annotations

from typing import Any, Optional

from config import (
    WEIGHT_REVENUE,
    WEIGHT_FREQUENCY,
    WEIGHT_SEVERITY,
    WEIGHT_TIER,
    AVG_REVENUE_PER_USER,
    SEVERITY_MAX,
)

# Severity 1–5 → business risk multiplier for estimated revenue impact
SEVERITY_RISK_FACTORS: dict[int, float] = {
    1: 0.10,
    2: 0.20,
    3: 0.40,
    4: 0.70,
    5: 1.00,
}

AFFECTED_LABEL = "Observed customers affected"


def severity_risk_factor(avg_severity: float) -> float:
    """Map continuous severity (1–5) to nearest factor; clamp invalid values."""
    try:
        sev = float(avg_severity)
    except (TypeError, ValueError):
        sev = 3.0
    if sev <= 0:
        sev = 1.0
    sev = max(1.0, min(float(SEVERITY_MAX or 5), sev))
    # Round to nearest integer severity band
    band = int(round(sev))
    band = max(1, min(5, band))
    return SEVERITY_RISK_FACTORS[band]


def clamp_0_100(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


def customer_reach_percentage(
    affected_customers: int,
    monthly_customers: Optional[int],
) -> float:
    """Reach as % of monthly customers; 0 when assumptions missing/zero."""
    affected = max(0, int(affected_customers or 0))
    try:
        monthly = int(monthly_customers) if monthly_customers is not None else 0
    except (TypeError, ValueError):
        monthly = 0
    if monthly <= 0 or affected <= 0:
        return 0.0
    return min(100.0, (affected / monthly) * 100.0)


def estimated_revenue_impact(
    affected_customers: int,
    avg_revenue_per_user: Optional[float],
    avg_severity: float,
) -> float:
    """
    estimated_revenue_impact = affected × ARPU × severity_risk_factor
    Returns 0 when ARPU missing/invalid (graceful empty-metrics state).
    """
    affected = max(0, int(affected_customers or 0))
    try:
        arpu = float(avg_revenue_per_user) if avg_revenue_per_user is not None else 0.0
    except (TypeError, ValueError):
        arpu = 0.0
    if arpu < 0:
        arpu = 0.0
    if affected <= 0 or arpu <= 0:
        return 0.0
    return round(affected * arpu * severity_risk_factor(avg_severity), 2)


def tier_score_0_100(
    premium_user_count: int,
    affected_customers: int,
    business_premium_pct: Optional[float] = None,
) -> float:
    """
    Customer tier pillar 0–100.
    Base: 20% floor + 80% × premium ratio among affected.
    Optional blend toward business-level premium_pct assumption.
    """
    affected = max(int(affected_customers or 0), 0)
    prem = max(int(premium_user_count or 0), 0)
    if affected <= 0:
        ratio = 0.0
    else:
        ratio = min(1.0, prem / affected)
    base = (0.2 + (0.8 * ratio)) * 100.0

    if business_premium_pct is not None:
        try:
            bp = clamp_0_100(float(business_premium_pct))
        except (TypeError, ValueError):
            bp = None
        if bp is not None:
            # Light blend so workspace premium assumption influences tier
            base = (0.7 * base) + (0.3 * bp)

    return clamp_0_100(base)


def severity_score_0_100(avg_severity: float) -> float:
    try:
        sev = float(avg_severity)
    except (TypeError, ValueError):
        sev = float(SEVERITY_MAX or 5) / 2.0
    sev_max = float(SEVERITY_MAX or 5)
    return clamp_0_100((sev / sev_max) * 100.0)


def revenue_score_0_100(
    this_impact: float,
    max_impact: float,
    *,
    monthly_customers: Optional[int] = None,
    avg_revenue_per_user: Optional[float] = None,
) -> float:
    """
    Normalize estimated revenue impact to 0–100.

    Prefer business-relative scale so high-volume low-severity issues cannot
    auto-claim Rev=100 just by having the largest rupee total:
      rev_0_100 = min(100, (est_rev / monthly_revenue) × 2000)
    i.e. ~5% of monthly revenue at risk → 100.

    Fallback: relative to session max when assumptions missing.
    """
    try:
        impact = float(this_impact or 0)
    except (TypeError, ValueError):
        return 0.0
    if impact <= 0:
        return 0.0

    try:
        monthly = int(monthly_customers) if monthly_customers is not None else 0
    except (TypeError, ValueError):
        monthly = 0
    try:
        arpu = float(avg_revenue_per_user) if avg_revenue_per_user is not None else 0.0
    except (TypeError, ValueError):
        arpu = 0.0

    monthly_rev = monthly * arpu if monthly > 0 and arpu > 0 else 0.0
    if monthly_rev > 0:
        # 5% of monthly revenue at risk → pillar 100
        return clamp_0_100((impact / monthly_rev) * 2000.0)

    try:
        ceiling = float(max_impact or 0)
    except (TypeError, ValueError):
        return 100.0
    if ceiling <= 0:
        return 100.0
    return clamp_0_100((impact / ceiling) * 100.0)


def pillar_breakdown(
    rev_0_100: float,
    reach_0_100: float,
    sev_0_100: float,
    tier_0_100: float,
    score: float,
    *,
    estimated_revenue: float = 0.0,
    affected_customers: int = 0,
    customer_reach_pct: float = 0.0,
    severity_factor: float = 0.0,
) -> dict:
    """Store raw 0–100 components + weighted contributions for UI transparency."""
    rev_part = rev_0_100 * WEIGHT_REVENUE
    reach_part = reach_0_100 * WEIGHT_FREQUENCY
    sev_part = sev_0_100 * WEIGHT_SEVERITY
    tier_part = tier_0_100 * WEIGHT_TIER
    safe = max(score, 0.001)
    return {
        "revenue_impact": round(rev_0_100, 2),
        "customer_reach": round(reach_0_100, 2),
        "severity": round(sev_0_100, 2),
        "customer_tier": round(tier_0_100, 2),
        "premium_users": round(tier_0_100, 2),  # alias for UI
        "revenue_weighted": round(rev_part, 2),
        "reach_weighted": round(reach_part, 2),
        "severity_weighted": round(sev_part, 2),
        "tier_weighted": round(tier_part, 2),
        "revenue_pct": round((rev_part / safe) * 100),
        "reach_pct": round((reach_part / safe) * 100),
        "severity_pct": round((sev_part / safe) * 100),
        "premium_pct": round((tier_part / safe) * 100),
        # Absolute metrics (for Decision Center — not invented by Gemini)
        "estimated_revenue_impact": round(estimated_revenue, 2),
        "affected_customers": int(affected_customers),
        "affected_customers_label": AFFECTED_LABEL,
        "customer_reach_percentage": round(customer_reach_pct, 2),
        "severity_risk_factor": severity_factor,
        "weights": {
            "revenue": WEIGHT_REVENUE,
            "customer_reach": WEIGHT_FREQUENCY,
            "severity": WEIGHT_SEVERITY,
            "customer_tier": WEIGHT_TIER,
        },
        "formula": (
            f"Priority = Revenue×{WEIGHT_REVENUE} + Reach×{WEIGHT_FREQUENCY} "
            f"+ Severity×{WEIGHT_SEVERITY} + Tier×{WEIGHT_TIER}"
        ),
        "revenue_formula": (
            "estimated_revenue_impact = affected_customers × ARPU × severity_risk_factor"
        ),
    }


def score_issue(
    *,
    affected_customers: int,
    avg_severity: float,
    premium_user_count: int = 0,
    monthly_customers: Optional[int] = None,
    avg_revenue_per_user: Optional[float] = None,
    business_premium_pct: Optional[float] = None,
    max_revenue_impact: Optional[float] = None,
    # Legacy fallbacks when business assumptions absent
    total_reviews: int = 0,
    total_premium: int = 0,
) -> dict:
    """
    Score one issue cluster. Returns priority_score, revenue_at_risk (estimated),
    and decision_pillars.

    When monthly_customers/ARPU missing, revenue impact is 0 and reach falls back
    to relative feedback share so ranking still works for demos without settings.
    """
    affected = max(0, int(affected_customers or 0))
    prem = max(0, int(premium_user_count or 0))

    arpu = avg_revenue_per_user
    if arpu is None:
        arpu = AVG_REVENUE_PER_USER

    reach_pct = customer_reach_percentage(affected, monthly_customers)
    est_rev = estimated_revenue_impact(affected, arpu, avg_severity)
    sev_0_100 = severity_score_0_100(avg_severity)
    tier_0_100 = tier_score_0_100(prem, affected, business_premium_pct)

    # Reach pillar: prefer monthly-customer reach; fallback to volume share
    if monthly_customers and int(monthly_customers) > 0:
        reach_0_100 = reach_pct
    else:
        reach_0_100 = clamp_0_100(
            (affected / max(int(total_reviews or 0), 1)) * 100.0
        )

    ceiling = max_revenue_impact if max_revenue_impact is not None else est_rev
    # If no business ARPU path produced revenue, fall back to premium-share heuristic
    # so empty-assumption sessions still rank (legacy compatibility).
    if est_rev <= 0 and (arpu is None or float(arpu or 0) <= 0 or affected <= 0):
        if total_premium > 0:
            rev_0_100 = clamp_0_100((prem / max(int(total_premium), 1)) * 100.0)
        else:
            rev_0_100 = sev_0_100
        # Keep estimated at premium × default ARPU for display continuity
        est_rev = round(prem * float(AVG_REVENUE_PER_USER or 0), 2)
        if max_revenue_impact is None:
            ceiling = est_rev
    else:
        rev_0_100 = revenue_score_0_100(
            est_rev,
            float(ceiling or 0),
            monthly_customers=monthly_customers,
            avg_revenue_per_user=arpu,
        )

    score = (
        rev_0_100 * WEIGHT_REVENUE
        + reach_0_100 * WEIGHT_FREQUENCY
        + sev_0_100 * WEIGHT_SEVERITY
        + tier_0_100 * WEIGHT_TIER
    )
    score = clamp_0_100(score)

    return {
        "priority_score": round(score, 2),
        "revenue_at_risk": round(est_rev, 2),  # stored field name; UI: Estimated Revenue Impact
        "estimated_revenue_impact": round(est_rev, 2),
        "affected_customers": affected,
        "customer_reach_percentage": round(reach_pct, 2),
        "decision_pillars": pillar_breakdown(
            rev_0_100,
            reach_0_100,
            sev_0_100,
            tier_0_100,
            score,
            estimated_revenue=est_rev,
            affected_customers=affected,
            customer_reach_pct=reach_pct,
            severity_factor=severity_risk_factor(avg_severity),
        ),
    }


def load_business_assumptions(db, session_id: str) -> dict[str, Any]:
    """
    Load monthly_customers / ARPU / premium_pct / currency from the session's business.
    Returns empty defaults when session has no business link.
    """
    defaults = {
        "monthly_customers": None,
        "avg_revenue_per_user": None,
        "premium_pct": None,
        "currency": "INR",
        "business_id": None,
        "business_name": None,
        "assumptions_configured": False,
    }
    try:
        session = (
            db.table("sessions")
            .select("business_id")
            .eq("id", session_id)
            .single()
            .execute()
            .data
        )
    except Exception:
        return defaults

    biz_id = None
    if isinstance(session, dict):
        biz_id = session.get("business_id")
    if not biz_id:
        try:
            from services.business_linkage import get_session_business_id
            biz_id = get_session_business_id(db, session_id)
        except Exception:
            biz_id = None
    if not biz_id:
        return defaults

    try:
        biz = (
            db.table("businesses")
            .select(
                "id,business_name,monthly_customers,avg_revenue_per_user,premium_pct,currency"
            )
            .eq("id", biz_id)
            .single()
            .execute()
            .data
        )
    except Exception:
        return defaults

    if not isinstance(biz, dict):
        return defaults

    monthly = biz.get("monthly_customers")
    arpu = biz.get("avg_revenue_per_user")
    try:
        monthly_i = int(monthly) if monthly is not None else None
    except (TypeError, ValueError):
        monthly_i = None
    try:
        arpu_f = float(arpu) if arpu is not None else None
    except (TypeError, ValueError):
        arpu_f = None

    configured = bool(
        (monthly_i is not None and monthly_i > 0)
        and (arpu_f is not None and arpu_f > 0)
    )
    return {
        "monthly_customers": monthly_i,
        "avg_revenue_per_user": arpu_f,
        "premium_pct": biz.get("premium_pct"),
        "currency": biz.get("currency") or "INR",
        "business_id": biz.get("id"),
        "business_name": biz.get("business_name"),
        "assumptions_configured": configured,
    }


def unique_affected_for_cluster(
    db,
    session_id: str,
    issue_key: str,
    fallback_count: int,
) -> int:
    """
    Deduplicate observed customers for a cluster.
    Prefer unique customer_email when present; else unique review_id; else fallback.
    """
    try:
        cats = (
            db.table("categorizations")
            .select("review_id")
            .eq("session_id", session_id)
            .eq("issue_key", issue_key)
            .execute()
            .data
        ) or []
    except Exception:
        return max(0, int(fallback_count or 0))

    review_ids = list({
        str(c.get("review_id"))
        for c in cats
        if isinstance(c, dict) and c.get("review_id")
    })
    if not review_ids:
        return max(0, int(fallback_count or 0))

    try:
        reviews = (
            db.table("reviews")
            .select("id,customer_email")
            .in_("id", review_ids)
            .execute()
            .data
        ) or []
    except Exception:
        return len(review_ids)

    emails: set[str] = set()
    ids_without: set[str] = set()
    for r in reviews:
        if not isinstance(r, dict):
            continue
        email = (r.get("customer_email") or "").strip().lower()
        if email:
            emails.add(email)
        else:
            ids_without.add(str(r.get("id")))

    # Unique = unique emails + reviews without email (each counts once)
    return max(len(emails) + len(ids_without), 1) if (emails or ids_without) else len(review_ids)


def score_clusters(
    clusters: list[dict],
    *,
    monthly_customers: Optional[int] = None,
    avg_revenue_per_user: Optional[float] = None,
    business_premium_pct: Optional[float] = None,
) -> list[dict]:
    """
    Score and rank a list of cluster dicts (mutates copies).
    Each cluster needs: review_count or affected_customers, avg_severity,
    premium_user_count (optional).
    """
    if not clusters:
        return []

    prepared = []
    for c in clusters:
        row = dict(c) if isinstance(c, dict) else {}
        affected = int(
            row.get("affected_customers")
            if row.get("affected_customers") is not None
            else (row.get("review_count") or 0)
        )
        prepared.append({**row, "_affected": affected})

    total_reviews = sum(int(c.get("_affected") or 0) for c in prepared)
    total_premium = sum(int(c.get("premium_user_count") or 0) for c in prepared)

    # First pass: absolute estimated revenue for normalization ceiling
    impacts = []
    for c in prepared:
        impacts.append(
            estimated_revenue_impact(
                c["_affected"],
                avg_revenue_per_user if avg_revenue_per_user is not None else AVG_REVENUE_PER_USER,
                float(c.get("avg_severity") or 3),
            )
        )
    max_impact = max(impacts) if impacts else 0.0

    scored = []
    for c, impact in zip(prepared, impacts):
        parts = score_issue(
            affected_customers=c["_affected"],
            avg_severity=float(c.get("avg_severity") or 3),
            premium_user_count=int(c.get("premium_user_count") or 0),
            monthly_customers=monthly_customers,
            avg_revenue_per_user=avg_revenue_per_user,
            business_premium_pct=business_premium_pct,
            max_revenue_impact=max_impact if max_impact > 0 else impact,
            total_reviews=total_reviews,
            total_premium=total_premium,
        )
        out = {k: v for k, v in c.items() if not str(k).startswith("_")}
        out.update(parts)
        scored.append(out)

    scored.sort(key=lambda x: x.get("priority_score") or 0, reverse=True)
    for rank, item in enumerate(scored, start=1):
        item["priority_rank"] = rank
    return scored


def build_fix_first_why(cluster: dict, currency: str = "INR") -> str:
    """Human-readable explanation from calculated data only."""
    title = (cluster.get("issue_key") or "this issue").replace("_", " ").title()
    affected = int(
        cluster.get("affected_customers")
        or (cluster.get("decision_pillars") or {}).get("affected_customers")
        or cluster.get("review_count")
        or 0
    )
    risk = float(cluster.get("estimated_revenue_impact") or cluster.get("revenue_at_risk") or 0)
    reach = float(
        cluster.get("customer_reach_percentage")
        or (cluster.get("decision_pillars") or {}).get("customer_reach_percentage")
        or 0
    )
    sev = float(cluster.get("avg_severity") or 0)
    score = float(cluster.get("priority_score") or 0)
    sym = "₹" if (currency or "INR").upper() in ("INR", "RS", "₹") else f"{currency} "
    risk_txt = f"{sym}{risk:,.0f}" if risk > 0 else "unquantified (configure ARPU)"
    return (
        f"{title} ranks first with priority {score:.0f}/100 because "
        f"{affected} observed customers are affected "
        f"({reach:.1f}% reach), severity {sev:.1f}/5, and "
        f"estimated revenue impact of {risk_txt}. "
        f"Ranked by business impact — not complaint volume."
    )


def decision_center_kpis(clusters: list[dict]) -> dict:
    """Aggregate KPIs for Decision Center header."""
    total_est = sum(
        float(c.get("estimated_revenue_impact") or c.get("revenue_at_risk") or 0)
        for c in clusters
    )
    critical_high = [
        c for c in clusters
        if int(c.get("priority_rank") or 99) <= 3
        or float(c.get("priority_score") or 0) >= 50
    ]
    at_risk = sum(
        float(c.get("estimated_revenue_impact") or c.get("revenue_at_risk") or 0)
        for c in critical_high
    )
    customers = sum(
        int(
            c.get("affected_customers")
            or (c.get("decision_pillars") or {}).get("affected_customers")
            or c.get("review_count")
            or 0
        )
        for c in clusters
    )
    critical_count = sum(
        1 for c in clusters
        if int(c.get("priority_rank") or 99) == 1
        or float(c.get("priority_score") or 0) >= 70
    )
    return {
        "total_estimated_revenue_impact": round(total_est, 2),
        "revenue_at_risk_critical_high": round(at_risk, 2),
        "customers_affected": customers,
        "critical_issue_count": critical_count,
        "issue_count": len(clusters),
    }
