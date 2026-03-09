"""
price_fetcher.py — Live price fetching for investments.

Sources:
  Gold:   goldapi.io (GOLD_API_KEY env var) — price per troy oz → convert to per gram
  Stocks: yfinance (no API key needed)
  Crypto: CoinGecko free API (no key needed)
  Forex:  frankfurter.app (free, no key needed) — USD/EGP, EUR/EGP etc.

All functions return float (price in EGP) or raise an exception.
Callers should always catch exceptions and fall back to last stored price.
"""

import os
import logging
import requests

logger = logging.getLogger("price_fetcher")

GOLD_API_KEY = os.getenv("GOLD_API_KEY", "")
_TROY_OZ_TO_GRAM = 31.1035  # 1 troy oz = 31.1035 grams

# ── Forex ─────────────────────────────────────────────────────────────────

_forex_cache: dict[str, tuple[float, float]] = {}  # symbol -> (rate, timestamp)


def get_egp_rate(from_currency: str) -> float:
    """Return how many EGP 1 unit of from_currency is worth.
    Uses frankfurter.app (free, no key required)."""
    from_currency = from_currency.upper()
    if from_currency == "EGP":
        return 1.0
    import time
    cached = _forex_cache.get(from_currency)
    if cached and (time.time() - cached[1]) < 3600:  # 1h cache
        return cached[0]
    try:
        resp = requests.get(
            f"https://api.frankfurter.app/latest?from={from_currency}&to=EGP",
            timeout=10
        )
        resp.raise_for_status()
        rate = float(resp.json()["rates"]["EGP"])
        _forex_cache[from_currency] = (rate, time.time())
        logger.info(f"Forex: 1 {from_currency} = {rate:.4f} EGP")
        return rate
    except Exception as e:
        logger.warning(f"Forex fetch failed for {from_currency}: {e}")
        raise


# ── Gold ──────────────────────────────────────────────────────────────────

def get_gold_price_per_gram_egp() -> float:
    """Return current gold price per gram in EGP.

    Primary: goldapi.io (requires GOLD_API_KEY)
    Fallback: use metals-api or just fetch USD/gram and convert via forex.
    """
    if GOLD_API_KEY:
        try:
            resp = requests.get(
                "https://www.goldapi.io/api/XAU/USD",
                headers={"x-access-token": GOLD_API_KEY, "Content-Type": "application/json"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            price_per_oz_usd = float(data["price"])
            price_per_gram_usd = price_per_oz_usd / _TROY_OZ_TO_GRAM
            usd_egp = get_egp_rate("USD")
            price_per_gram_egp = price_per_gram_usd * usd_egp
            logger.info(f"Gold: {price_per_gram_egp:.2f} EGP/gram (via goldapi.io)")
            return price_per_gram_egp
        except Exception as e:
            logger.warning(f"goldapi.io failed: {e}, trying metals-api fallback")

    # Fallback: use a metals price API (open alternative)
    try:
        resp = requests.get(
            "https://api.metals.live/v1/spot/gold",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        # metals.live returns price per troy oz in USD
        price_per_oz_usd = float(data[0]["price"])
        price_per_gram_usd = price_per_oz_usd / _TROY_OZ_TO_GRAM
        usd_egp = get_egp_rate("USD")
        price_per_gram_egp = price_per_gram_usd * usd_egp
        logger.info(f"Gold (metals.live): {price_per_gram_egp:.2f} EGP/gram")
        return price_per_gram_egp
    except Exception as e:
        logger.warning(f"metals.live fallback failed: {e}")
        raise RuntimeError("Gold price unavailable from all sources")


# ── Stocks ────────────────────────────────────────────────────────────────

def get_stock_price_egp(ticker: str) -> tuple[float, float]:
    """Return (price_in_egp, price_in_usd) for a stock ticker.
    Uses yfinance — no API key required."""
    try:
        import yfinance as yf
    except ImportError:
        raise RuntimeError("yfinance not installed. Run: pip install yfinance")

    ticker = ticker.upper()
    try:
        info = yf.Ticker(ticker).fast_info
        price_usd = float(info.last_price)
        currency = getattr(info, "currency", "USD").upper()
        # Convert to EGP
        if currency == "EGP":
            return price_usd, price_usd
        egp_rate = get_egp_rate(currency)
        price_egp = price_usd * egp_rate
        logger.info(f"Stock {ticker}: {price_usd:.2f} {currency} = {price_egp:.2f} EGP")
        return price_egp, price_usd
    except Exception as e:
        logger.warning(f"Stock price fetch failed for {ticker}: {e}")
        raise


# ── Crypto ────────────────────────────────────────────────────────────────

# Common name → CoinGecko ID mapping
COIN_ID_MAP: dict[str, str] = {
    "bitcoin": "bitcoin", "btc": "bitcoin",
    "ethereum": "ethereum", "eth": "ethereum",
    "usdt": "tether", "tether": "tether",
    "bnb": "binancecoin", "binance": "binancecoin",
    "solana": "solana", "sol": "solana",
    "xrp": "ripple", "ripple": "ripple",
    "usdc": "usd-coin",
    "dogecoin": "dogecoin", "doge": "dogecoin",
    "cardano": "cardano", "ada": "cardano",
    "avalanche": "avalanche-2", "avax": "avalanche-2",
    "polkadot": "polkadot", "dot": "polkadot",
    "polygon": "matic-network", "matic": "matic-network",
    "chainlink": "chainlink", "link": "chainlink",
    "shiba": "shiba-inu", "shib": "shiba-inu",
    "litecoin": "litecoin", "ltc": "litecoin",
    "ton": "the-open-network",
}


def normalize_coin_id(name: str) -> str:
    """Map a user-provided coin name to a CoinGecko ID."""
    key = name.lower().strip()
    return COIN_ID_MAP.get(key, key)  # fall through as-is if not in map


def get_crypto_price_egp(coin_id: str) -> float:
    """Return current price of a coin in EGP via CoinGecko free API."""
    coin_id = normalize_coin_id(coin_id)
    try:
        resp = requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": coin_id, "vs_currencies": "egp"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if coin_id not in data:
            raise ValueError(f"Coin '{coin_id}' not found on CoinGecko")
        price = float(data[coin_id]["egp"])
        logger.info(f"Crypto {coin_id}: {price:.4f} EGP")
        return price
    except Exception as e:
        logger.warning(f"Crypto price fetch failed for {coin_id}: {e}")
        raise


# ── Master refresh ────────────────────────────────────────────────────────

def refresh_all_investment_prices():
    """
    Fetches latest prices for all trackable investments and updates the DB.
    Called by APScheduler every 6 hours and by POST /investments/refresh.
    """
    from database import get_all_trackable_investments, update_investment_price, record_price_history

    investments = get_all_trackable_investments()
    if not investments:
        return {"updated": 0, "errors": 0}

    updated = 0
    errors = 0

    for inv in investments:
        try:
            current_price = None
            current_value = None

            if inv.asset_type == "gold" and inv.grams:
                price_per_gram = get_gold_price_per_gram_egp()
                current_price = price_per_gram
                current_value = inv.grams * price_per_gram
                record_price_history("gold", "gold", price_per_gram, "EGP")

            elif inv.asset_type == "stocks" and inv.ticker_symbol:
                price_egp, _ = get_stock_price_egp(inv.ticker_symbol)
                current_price = price_egp
                # units = amount_invested / price_per_unit (at purchase)
                units = (inv.amount_invested / inv.price_per_unit) if inv.price_per_unit else 1
                current_value = units * price_egp
                record_price_history("stocks", inv.ticker_symbol.upper(), price_egp, "EGP")

            elif inv.asset_type == "crypto" and inv.coin_id:
                price_egp = get_crypto_price_egp(inv.coin_id)
                current_price = price_egp
                units = (inv.amount_invested / inv.price_per_unit) if inv.price_per_unit else 1
                current_value = units * price_egp
                record_price_history("crypto", normalize_coin_id(inv.coin_id), price_egp, "EGP")

            if current_price is not None and current_value is not None:
                update_investment_price(inv.id, current_price, current_value)
                updated += 1

        except Exception as e:
            logger.warning(f"Price refresh failed for investment {inv.id} ({inv.asset_name}): {e}")
            errors += 1

    logger.info(f"Price refresh complete: {updated} updated, {errors} errors")
    return {"updated": updated, "errors": errors}


def refresh_user_investment_prices(user_id: str):
    """Refresh prices for a single user's investments only."""
    from database import get_investments, update_investment_price, record_price_history

    investments = get_investments(user_id)
    updated = 0
    errors = 0

    for inv in investments:
        try:
            current_price = None
            current_value = None

            if inv.asset_type == "gold" and inv.grams:
                price_per_gram = get_gold_price_per_gram_egp()
                current_price = price_per_gram
                current_value = inv.grams * price_per_gram
                record_price_history("gold", "gold", price_per_gram, "EGP")

            elif inv.asset_type == "stocks" and inv.ticker_symbol:
                price_egp, _ = get_stock_price_egp(inv.ticker_symbol)
                current_price = price_egp
                units = (inv.amount_invested / inv.price_per_unit) if inv.price_per_unit else 1
                current_value = units * price_egp
                record_price_history("stocks", inv.ticker_symbol.upper(), price_egp, "EGP")

            elif inv.asset_type == "crypto" and inv.coin_id:
                price_egp = get_crypto_price_egp(inv.coin_id)
                current_price = price_egp
                units = (inv.amount_invested / inv.price_per_unit) if inv.price_per_unit else 1
                current_value = units * price_egp
                record_price_history("crypto", normalize_coin_id(inv.coin_id), price_egp, "EGP")

            if current_price is not None and current_value is not None:
                update_investment_price(inv.id, current_price, current_value)
                updated += 1

        except Exception as e:
            logger.warning(f"Price refresh failed for {inv.asset_name}: {e}")
            errors += 1

    return {"updated": updated, "errors": errors}
