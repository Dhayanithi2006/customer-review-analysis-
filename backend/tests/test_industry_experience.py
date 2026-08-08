"""
Unit and Integration Tests for Phase 8 — Industry-Aware Feedback Experience
Tests:
1. All 10 supported industries return proper configuration-driven defaults:
   - Supermarket (Reward mode, 'Earn 10 points for valid feedback.')
   - Hotel (Reward mode, 'Earn loyalty points for your feedback.')
   - Restaurant (Reward mode, 'Earn points toward your next visit.')
   - E-commerce (Reward mode, 'Earn points toward your next purchase.')
   - Hospital (Improvement mode, 'Your feedback helps us improve patient care.')
   - University (Improvement mode, 'Help us improve your campus experience.')
   - School (Improvement mode, 'Help us improve the learning environment.')
   - Bank (Improvement mode, 'Your feedback helps us improve banking services.')
   - SaaS (Product mode, 'Your feedback helps shape future product improvements.')
   - Mobile App (Product mode, 'Help us improve the app.')
2. Configuration-driven fallback for unlisted custom industries.
"""
import pytest
from routers.feedback_settings import _build_defaults, _get_engagement_mode, INDUSTRY_CONFIG_MAP


def test_industry_config_map_all_ten_industries():
    expected_industries = [
        ("Supermarket", "reward", "Earn 10 points for valid feedback."),
        ("Hotel", "reward", "Earn loyalty points for your feedback."),
        ("Restaurant", "reward", "Earn points toward your next visit."),
        ("E-commerce", "reward", "Earn points toward your next purchase."),
        ("Hospital", "improvement", "Your feedback helps us improve patient care."),
        ("University", "improvement", "Help us improve your campus experience."),
        ("School", "improvement", "Help us improve the learning environment."),
        ("Bank", "improvement", "Your feedback helps us improve banking services."),
        ("SaaS", "product", "Your feedback helps shape future product improvements."),
        ("Mobile App", "product", "Help us improve the app."),
    ]

    for ind, expected_mode, expected_msg in expected_industries:
        defaults = _build_defaults(ind)
        assert defaults["feedback_mode"] == expected_mode
        assert defaults["feedback_message"] == expected_msg
        assert _get_engagement_mode(ind) == expected_mode

        if expected_mode == "reward":
            assert defaults["reward_enabled"] is True
            assert defaults["points_per_feedback"] > 0
            assert defaults["reward_description"] != ""
        else:
            assert defaults["reward_enabled"] is False


def test_custom_unknown_industry_fallback():
    defaults = _build_defaults("CustomSpaceAgency")
    assert defaults["feedback_mode"] in ("reward", "improvement", "product")
    assert defaults["minimum_feedback_length"] > 0
