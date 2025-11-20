import os
from dotenv import load_dotenv

load_dotenv()

# Credit System Configuration

# Cost per action
RECIPE_GENERATION_COST = 5

# Default credits for new users
DEFAULT_NEW_USER_CREDITS = 10

# Payment Gateway Configuration
# ---------------------------
# STRIPE (For USD/Global)
STRIPE_PUBLIC_KEY = os.getenv('STRIPE_PUBLIC_KEY', 'pk_test_your_stripe_public_key')
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', 'sk_test_your_stripe_secret_key')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')

# RAZORPAY (For INR/India)
RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID', 'rzp_test_your_key_id')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET', 'your_razorpay_secret')

# Pricing Packages
# Each package has:
# - id: Unique identifier
# - name: Display name
# - credits: Amount of credits
# - recipes_count: Approximate number of recipes (calculated for display)
# - price_inr: Price in Indian Rupees
# - price_usd: Price in US Dollars
# - popular: Boolean to highlight the package

PRICING_PACKAGES = [
    {
        "id": "starter",
        "name": "Starter",
        "credits": 50,
        "recipes_count": 10,
        "price_inr": 50,
        "price_usd": 2.50,
        "popular": False
    },
    {
        "id": "standard",
        "name": "Standard",
        "credits": 100,
        "recipes_count": 20,
        "price_inr": 100,
        "price_usd": 5.00,
        "popular": True
    },
    {
        "id": "pro",
        "name": "Pro",
        "credits": 500,
        "recipes_count": 100,
        "price_inr": 500,
        "price_usd": 25.00,
        "popular": False
    }
]
