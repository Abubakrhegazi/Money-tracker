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
    Primary: Yahoo Finance (near-real-time interbank rate)
    Secondary: Wise (mid-market rate, no key)
    Fallback: open.er-api.com, frankfurter.app"""
    from_currency = from_currency.upper()
    if from_currency == "EGP":
        return 1.0
    import time
    cached = _forex_cache.get(from_currency)
    if cached and (time.time() - cached[1]) < 1800:  # 30min cache
        return cached[0]

    # 1. Yahoo Finance — near-real-time interbank rate (e.g. USDEGP=X)
    try:
        pair = f"{from_currency}EGP=X"
        resp = requests.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{pair}",
            params={"interval": "1d", "range": "1d"},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        resp.raise_for_status()
        result = resp.json().get("chart", {}).get("result")
        if result:
            rate = float(result[0]["meta"]["regularMarketPrice"])
            if rate > 0:
                _forex_cache[from_currency] = (rate, time.time())
                logger.info(f"Forex (Yahoo): 1 {from_currency} = {rate:.4f} EGP")
                return rate
    except Exception as e:
        logger.warning(f"Yahoo Finance forex failed for {from_currency}: {e}")

    # 2. Wise (TransferWise) — accurate mid-market rate, no key
    try:
        resp = requests.get(
            f"https://api.wise.com/v1/rates?source={from_currency}&target=EGP",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data and len(data) > 0:
            rate = float(data[0]["rate"])
            _forex_cache[from_currency] = (rate, time.time())
            logger.info(f"Forex (Wise): 1 {from_currency} = {rate:.4f} EGP")
            return rate
    except Exception as e:
        logger.warning(f"Wise API failed for {from_currency}: {e}")

    # 3. open.er-api.com (ECB-based, may lag)
    try:
        resp = requests.get(
            f"https://open.er-api.com/v6/latest/{from_currency}",
            timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("result") == "success" and "EGP" in data.get("rates", {}):
            rate = float(data["rates"]["EGP"])
            _forex_cache[from_currency] = (rate, time.time())
            logger.info(f"Forex (er-api): 1 {from_currency} = {rate:.4f} EGP")
            return rate
    except Exception as e:
        logger.warning(f"open.er-api.com failed for {from_currency}: {e}")

    # 4. frankfurter.app (last resort)
    try:
        resp = requests.get(
            f"https://api.frankfurter.app/latest?from={from_currency}&to=EGP",
            timeout=10
        )
        resp.raise_for_status()
        rate = float(resp.json()["rates"]["EGP"])
        _forex_cache[from_currency] = (rate, time.time())
        logger.info(f"Forex (frankfurter): 1 {from_currency} = {rate:.4f} EGP")
        return rate
    except Exception as e:
        logger.warning(f"frankfurter.app also failed for {from_currency}: {e}")
        raise


# ── Gold ──────────────────────────────────────────────────────────────────

def get_gold_price_per_gram_egp() -> float:
    """Return current gold price per gram in EGP.

    Primary: goldapi.io (requires GOLD_API_KEY)
    Fallback: use metals-api or just fetch USD/gram and convert via forex.
    """
    if GOLD_API_KEY:
        try:
            symbol = "XAU"
            curr = "USD"
            date = ""

            url = f"https://www.goldapi.io/api/{symbol}/{curr}{date}"
            headers = {
                "x-access-token": GOLD_API_KEY,
                "Content-Type": "application/json"
            }

            resp = requests.get(url, headers=headers, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            # Use the API's built-in price_gram_24k (USD per gram)
            price_per_gram_usd = float(data.get("price_gram_24k", 0))
            if price_per_gram_usd <= 0:
                # Fallback: compute from troy oz price
                price_per_oz_usd = float(data["price"])
                price_per_gram_usd = price_per_oz_usd / _TROY_OZ_TO_GRAM
            usd_egp = get_egp_rate("USD")
            price_per_gram_egp = price_per_gram_usd * usd_egp
            logger.info(f"Gold: {price_per_gram_egp:.2f} EGP/gram (via goldapi.io)")
            return price_per_gram_egp
        except Exception as e:
            logger.warning(f"goldapi.io failed: {e}, trying metals-api fallback")

    # Fallback 1: metals.live — free, no key
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

    # Fallback 2: Yahoo Finance — GC=F (gold futures, USD per troy oz)
    try:
        resp = requests.get(
            "https://query1.finance.yahoo.com/v8/finance/chart/GC=F",
            params={"interval": "1d", "range": "1d"},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        resp.raise_for_status()
        result = resp.json().get("chart", {}).get("result")
        if result:
            closes = result[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
            price_per_oz_usd = None
            for c in reversed(closes):
                if c is not None:
                    price_per_oz_usd = float(c)
                    break
            if price_per_oz_usd is None or price_per_oz_usd <= 0:
                price_per_oz_usd = float(result[0]["meta"]["regularMarketPrice"])
            price_per_gram_usd = price_per_oz_usd / _TROY_OZ_TO_GRAM
            usd_egp = get_egp_rate("USD")
            price_per_gram_egp = price_per_gram_usd * usd_egp
            logger.info(f"Gold (Yahoo GC=F): {price_per_gram_egp:.2f} EGP/gram")
            return price_per_gram_egp
    except Exception as e:
        logger.warning(f"Yahoo Finance gold fallback failed: {e}")

    # Fallback 3: Metal Price API (open, no key)
    try:
        resp = requests.get(
            "https://api.metalpriceapi.com/v1/latest?api_key=demo&base=XAU&currencies=USD",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("success") and "rates" in data and "USD" in data["rates"]:
            # XAU base: 1 troy oz gold = X USD → rate is USD per oz
            price_per_oz_usd = float(data["rates"]["USD"])
            price_per_gram_usd = price_per_oz_usd / _TROY_OZ_TO_GRAM
            usd_egp = get_egp_rate("USD")
            price_per_gram_egp = price_per_gram_usd * usd_egp
            logger.info(f"Gold (metalpriceapi): {price_per_gram_egp:.2f} EGP/gram")
            return price_per_gram_egp
    except Exception as e:
        logger.warning(f"metalpriceapi fallback failed: {e}")

    raise RuntimeError("Gold price unavailable from all sources")

# ── Stocks ────────────────────────────────────────────────────────────────

def get_stock_price_egp(ticker: str) -> tuple[float, float]:
    """Return (price_in_egp, price_in_usd) for a stock ticker.
    Uses Yahoo Finance chart API directly — no extra package required.
    Uses last close from chart data (not meta.regularMarketPrice which
    can be very stale for EGX/emerging-market stocks)."""
    ticker = ticker.upper()
    try:
        resp = requests.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}",
            params={"interval": "1d", "range": "5d"},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        result = data.get("chart", {}).get("result")
        if not result:
            raise ValueError(f"No data returned for ticker '{ticker}'")
        meta = result[0]["meta"]
        currency = meta.get("currency", "USD").upper()

        # Prefer the last non-null close from chart data (more accurate
        # than meta.regularMarketPrice which can be very stale for EGX)
        closes = result[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
        price = None
        for c in reversed(closes):
            if c is not None:
                price = float(c)
                break
        # Fall back to meta price if no chart closes available
        if price is None or price <= 0:
            price = float(meta["regularMarketPrice"])

        # Convert to EGP
        if currency == "EGP":
            logger.info(f"Stock {ticker}: {price:.2f} EGP (chart close)")
            return price, price
        egp_rate = get_egp_rate(currency)
        price_egp = price * egp_rate
        logger.info(f"Stock {ticker}: {price:.2f} {currency} = {price_egp:.2f} EGP")
        return price_egp, price
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


# CoinGecko ID → Binance/Kraken ticker symbol mapping
_BINANCE_SYMBOL: dict[str, str] = {
    "bitcoin": "BTCUSDT", "ethereum": "ETHUSDT", "tether": "USDTUSDT",
    "binancecoin": "BNBUSDT", "solana": "SOLUSDT", "ripple": "XRPUSDT",
    "usd-coin": "USDCUSDT", "dogecoin": "DOGEUSDT", "cardano": "ADAUSDT",
    "avalanche-2": "AVAXUSDT", "polkadot": "DOTUSDT", "matic-network": "MATICUSDT",
    "chainlink": "LINKUSDT", "shiba-inu": "SHIBUSDT", "litecoin": "LTCUSDT",
    "the-open-network": "TONUSDT",
}
_COINCAP_ID: dict[str, str] = {
    "bitcoin": "bitcoin", "ethereum": "ethereum", "tether": "tether",
    "binancecoin": "binance-coin", "solana": "solana", "ripple": "xrp",
    "dogecoin": "dogecoin", "cardano": "cardano", "avalanche-2": "avalanche",
    "polkadot": "polkadot", "matic-network": "polygon", "chainlink": "chainlink",
    "shiba-inu": "shiba-inu", "litecoin": "litecoin", "the-open-network": "toncoin",
}


def get_crypto_price_egp(coin_id: str) -> float:
    """Return current price of a coin in EGP.
    Sources tried in order: CoinGecko → Binance+forex → Kraken+forex → CoinCap+forex.
    """
    coin_id = normalize_coin_id(coin_id)

    # ── 1. CoinGecko (supports EGP directly) ──────────────────────────────
    try:
        resp = requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": coin_id, "vs_currencies": "egp"},
            timeout=12,
        )
        resp.raise_for_status()
        data = resp.json()
        if coin_id in data and "egp" in data[coin_id]:
            price = float(data[coin_id]["egp"])
            logger.info(f"Crypto {coin_id} (CoinGecko): {price:.4f} EGP")
            return price
    except Exception as e:
        logger.warning(f"CoinGecko failed for {coin_id}: {e}")

    # ── 2. Binance ticker → convert USD→EGP ───────────────────────────────
    binance_sym = _BINANCE_SYMBOL.get(coin_id)
    if binance_sym:
        try:
            resp = requests.get(
                "https://api.binance.com/api/v3/ticker/price",
                params={"symbol": binance_sym},
                timeout=10,
            )
            resp.raise_for_status()
            price_usd = float(resp.json()["price"])
            egp_rate = get_egp_rate("USD")
            price_egp = price_usd * egp_rate
            logger.info(f"Crypto {coin_id} (Binance): {price_usd:.4f} USD = {price_egp:.4f} EGP")
            return price_egp
        except Exception as e:
            logger.warning(f"Binance failed for {coin_id} ({binance_sym}): {e}")

    # ── 3. Kraken spot price → convert USD→EGP ────────────────────────────
    try:
        # Kraken uses XBT for Bitcoin
        kraken_base = "XBT" if coin_id == "bitcoin" else coin_id.upper()
        resp = requests.get(
            f"https://api.kraken.com/0/public/Ticker",
            params={"pair": f"{kraken_base}USD"},
            timeout=10,
        )
        resp.raise_for_status()
        result = resp.json().get("result", {})
        if result:
            pair_data = next(iter(result.values()))
            price_usd = float(pair_data["c"][0])
            egp_rate = get_egp_rate("USD")
            price_egp = price_usd * egp_rate
            logger.info(f"Crypto {coin_id} (Kraken): {price_usd:.4f} USD = {price_egp:.4f} EGP")
            return price_egp
    except Exception as e:
        logger.warning(f"Kraken failed for {coin_id}: {e}")

    # ── 4. CoinCap (no key needed) → convert USD→EGP ─────────────────────
    coincap_id = _COINCAP_ID.get(coin_id, coin_id)
    try:
        resp = requests.get(
            f"https://api.coincap.io/v2/assets/{coincap_id}",
            timeout=10,
        )
        resp.raise_for_status()
        price_usd = float(resp.json()["data"]["priceUsd"])
        egp_rate = get_egp_rate("USD")
        price_egp = price_usd * egp_rate
        logger.info(f"Crypto {coin_id} (CoinCap): {price_usd:.4f} USD = {price_egp:.4f} EGP")
        return price_egp
    except Exception as e:
        logger.warning(f"CoinCap failed for {coin_id}: {e}")

    raise RuntimeError(f"Crypto price unavailable for '{coin_id}' from all sources")


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
                price_per_gram_24k = get_gold_price_per_gram_egp()
                karat_factor = (inv.karat / 24) if inv.karat else 1.0
                price_per_gram = price_per_gram_24k * karat_factor
                current_price = price_per_gram
                current_value = inv.grams * price_per_gram
                record_price_history("gold", "gold", price_per_gram_24k, "EGP")

            elif inv.asset_type == "stocks" and inv.ticker_symbol:
                # EGX (.CA) tickers are also handled by Yahoo Finance
                price_egp, _ = get_stock_price_egp(inv.ticker_symbol)
                current_price = price_egp
                # units = amount_invested / price_per_unit (at purchase)
                units = (inv.amount_invested / inv.price_per_unit) if inv.price_per_unit else (inv.amount_invested / current_price if current_price and current_price > 0 else 0)
                current_value = units * price_egp
                record_price_history("stocks", inv.ticker_symbol.upper(), price_egp, "EGP")

            elif inv.asset_type == "crypto" and inv.coin_id:
                price_egp = get_crypto_price_egp(inv.coin_id)
                current_price = price_egp
                units = (inv.amount_invested / inv.price_per_unit) if inv.price_per_unit else (inv.amount_invested / current_price if current_price and current_price > 0 else 0)
                current_value = units * price_egp
                record_price_history("crypto", normalize_coin_id(inv.coin_id), price_egp, "EGP")

            elif inv.asset_type == "currency" and inv.forex_pair:
                rate = get_egp_rate(inv.forex_pair)
                current_price = rate
                units = (inv.amount_invested / inv.price_per_unit) if inv.price_per_unit else (inv.amount_invested / current_price if current_price and current_price > 0 else 0)
                current_value = units * rate
                record_price_history("currency", inv.forex_pair.upper(), rate, "EGP")

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
                price_per_gram_24k = get_gold_price_per_gram_egp()
                karat_factor = (inv.karat / 24) if inv.karat else 1.0
                price_per_gram = price_per_gram_24k * karat_factor
                current_price = price_per_gram
                current_value = inv.grams * price_per_gram
                record_price_history("gold", "gold", price_per_gram_24k, "EGP")

            elif inv.asset_type == "stocks" and inv.ticker_symbol:
                # EGX (.CA) tickers are also handled by Yahoo Finance
                price_egp, _ = get_stock_price_egp(inv.ticker_symbol)
                current_price = price_egp
                units = (inv.amount_invested / inv.price_per_unit) if inv.price_per_unit else (inv.amount_invested / current_price if current_price and current_price > 0 else 0)
                current_value = units * price_egp
                record_price_history("stocks", inv.ticker_symbol.upper(), price_egp, "EGP")

            elif inv.asset_type == "crypto" and inv.coin_id:
                price_egp = get_crypto_price_egp(inv.coin_id)
                current_price = price_egp
                units = (inv.amount_invested / inv.price_per_unit) if inv.price_per_unit else (inv.amount_invested / current_price if current_price and current_price > 0 else 0)
                current_value = units * price_egp
                record_price_history("crypto", normalize_coin_id(inv.coin_id), price_egp, "EGP")

            elif inv.asset_type == "currency" and inv.forex_pair:
                rate = get_egp_rate(inv.forex_pair)
                current_price = rate
                units = (inv.amount_invested / inv.price_per_unit) if inv.price_per_unit else (inv.amount_invested / current_price if current_price and current_price > 0 else 0)
                current_value = units * rate
                record_price_history("currency", inv.forex_pair.upper(), rate, "EGP")

            if current_price is not None and current_value is not None:
                update_investment_price(inv.id, current_price, current_value)
                updated += 1

        except Exception as e:
            logger.warning(f"Price refresh failed for {inv.asset_name}: {e}")
            errors += 1

    return {"updated": updated, "errors": errors}
