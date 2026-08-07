from enum import Enum

class ReviewSource(str, Enum):
    CSV = "csv"
    PLAY_STORE = "play_store"
    APP_STORE = "app_store"
    SUPPORT = "support"
    TWITTER = "twitter"
    REDDIT = "reddit"

class SentimentLabel(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"

class CategoryType(str, Enum):
    BUG = "Bug"
    PERFORMANCE = "Performance"
    UX = "UX"
    PRICING = "Pricing"
    FEATURE_REQUEST = "Feature Request"
    ONBOARDING = "Onboarding"
    CUSTOMER_SUPPORT = "Customer Support"
    DATA_PRIVACY = "Data & Privacy"
    INTEGRATION = "Integration"
    PRAISE = "Praise"

class BusinessArea(str, Enum):
    CHECKOUT = "Checkout"
    AUTH = "Auth"
    CORE_FEATURE = "Core Feature"
    UI = "UI"
    BILLING = "Billing"
    API = "API"
    OTHER = "Other"
