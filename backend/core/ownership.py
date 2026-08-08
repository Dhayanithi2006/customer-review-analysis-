"""
Business ownership verification.

No Supabase Auth was present in this repo — this module provides a lightweight
owner_token model that:
  - Issues a random owner_token at business registration (shown once)
  - Stores only sha256(owner_token) on businesses.owner_token_hash
  - Requires X-Owner-Token on protected workspace endpoints
  - Prevents Business A from accessing Business B data (403)

Public customer endpoints (/feedback/*, /follow-up/*) do NOT use this.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from typing import Optional

from fastapi import Header, HTTPException, Request

from database import get_db
from core.logging import get_logger

logger = get_logger("core.ownership")

OWNER_TOKEN_HEADER = "X-Owner-Token"


def owner_auth_enforced() -> bool:
    """Read at call-time so tests can toggle OWNER_AUTH_ENFORCE."""
    return os.getenv("OWNER_AUTH_ENFORCE", "true").lower() == "true"


def generate_owner_token() -> str:
    """Cryptographically random owner token (returned once at registration)."""
    return secrets.token_urlsafe(32)


def hash_owner_token(token: str) -> str:
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


def tokens_match(provided: str, stored_hash: str) -> bool:
    if not provided or not stored_hash:
        return False
    return hmac.compare_digest(hash_owner_token(provided), stored_hash)


def extract_owner_token(
    request: Optional[Request] = None,
    x_owner_token: Optional[str] = None,
) -> Optional[str]:
    if x_owner_token and x_owner_token.strip():
        return x_owner_token.strip()
    if request is not None:
        header = request.headers.get(OWNER_TOKEN_HEADER) or request.headers.get("x-owner-token")
        if header and header.strip():
            return header.strip()
        # Optional Bearer support for same token
        auth = request.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            return auth[7:].strip() or None
    return None


def assert_business_owner(
    business_id: str,
    *,
    request: Optional[Request] = None,
    x_owner_token: Optional[str] = None,
    db=None,
) -> dict:
    """
    Verify the caller owns this business_id.

    Returns the business row (id + owner_token_hash + industry when available).
    Raises 404 if business missing, 403 if token missing/invalid.
    """
    # #region agent log
    try:
        import json, time
        from pathlib import Path
        _p = Path(__file__).resolve().parents[2] / "debug-74d1c8.log"
        with open(_p, "a", encoding="utf-8") as _f:
            _f.write(json.dumps({"sessionId":"74d1c8","hypothesisId":"A","location":"ownership.py:assert_business_owner","message":"owner check entry","data":{"business_id":business_id,"has_header_token":bool(x_owner_token),"enforced":owner_auth_enforced()},"timestamp":int(time.time()*1000)})+"\n")
    except Exception:
        pass
    # #endregion
    client = db if db is not None else get_db()
    result = (
        client.table("businesses")
        .select("id,owner_token_hash,industry,business_name,email")
        .eq("id", business_id)
        .execute()
        .data
    )
    if isinstance(result, list):
        if not result or not isinstance(result[0], dict):
            raise HTTPException(status_code=404, detail="Business not found.")
        row = result[0]
    elif isinstance(result, dict):
        row = result
    else:
        raise HTTPException(status_code=404, detail="Business not found.")

    raw_hash = row.get("owner_token_hash")
    stored_hash = raw_hash.strip() if isinstance(raw_hash, str) else ""
    provided = extract_owner_token(request, x_owner_token)

    # Soft mode (tests / migration): businesses without a hash stay open so
    # legacy mocked tests keep working. Once a hash exists, token is required.
    if not stored_hash:
        if owner_auth_enforced():
            logger.warning(f"Business {business_id} missing owner_token_hash — denying access")
            raise HTTPException(
                status_code=403,
                detail="Forbidden: owner authentication required. Re-register or reset owner token.",
            )
        return row

    if not provided or not tokens_match(provided, stored_hash):
        raise HTTPException(status_code=403, detail="Forbidden: invalid or missing owner credentials.")

    return row


def owner_token_dependency(business_id: str, request: Request, x_owner_token: Optional[str] = Header(None)):
    """FastAPI-friendly wrapper (optional use via Depends)."""
    return assert_business_owner(business_id, request=request, x_owner_token=x_owner_token)
