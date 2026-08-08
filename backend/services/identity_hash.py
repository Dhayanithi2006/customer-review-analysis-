"""
Privacy-preserving customer identity helpers for reward cooldown.

Priority for cooldown key:
  1. Hash of normalized email
  2. Hash of normalized phone
  3. Device/session user_token (UUID)
Never store raw contact for cooldown matching; IP alone is not used.
"""
from __future__ import annotations

import hashlib
import re
from typing import Optional


EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_DIGITS_RE = re.compile(r"\D+")


def normalize_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    cleaned = email.strip().lower()
    if not cleaned or not EMAIL_RE.match(cleaned):
        return None
    return cleaned


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = PHONE_DIGITS_RE.sub("", phone.strip())
    # Keep last 10–15 digits (India mobile + optional country code)
    if len(digits) < 10:
        return None
    return digits[-15:]


def hash_contact(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def build_identity_hash(
    *,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    user_token: Optional[str] = None,
) -> str:
    """
    Stable identity key used for reward cooldown / balance.
    Format: email:<sha256> | phone:<sha256> | device:<token>
    """
    norm_email = normalize_email(email)
    if norm_email:
        return f"email:{hash_contact(norm_email)}"

    norm_phone = normalize_phone(phone)
    if norm_phone:
        return f"phone:{hash_contact(norm_phone)}"

    token = (user_token or "").strip()
    if not token:
        raise ValueError("user_token required when email/phone absent")
    return f"device:{token}"
