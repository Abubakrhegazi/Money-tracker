import os
import logging
import uuid
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, extract, Boolean, UniqueConstraint, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import secrets
import hashlib

logger = logging.getLogger(__name__)

Base = declarative_base()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///spending_tracker.db")

# Railway PostgreSQL URLs start with postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,
)
Session = sessionmaker(bind=engine)

class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_user_date", "telegram_user_id", "created_at"),
        Index("ix_expenses_user_cat", "telegram_user_id", "category"),
    )

    id = Column(Integer, primary_key=True)
    telegram_user_id = Column(String, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="EGP")
    category = Column(String, index=True)
    merchant = Column(String, nullable=True)
    date = Column(String)
    transcript = Column(String)
    entry_type = Column(String, default="expense", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    is_deleted = Column(Boolean, default=False)

class LoginToken(Base):
    __tablename__ = "login_tokens"

    id = Column(Integer, primary_key=True)
    telegram_user_id = Column(String, nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserLink(Base):
    __tablename__ = "user_links"
    id = Column(Integer, primary_key=True)
    primary_id = Column(String, nullable=False)  # the main user_id
    linked_id = Column(String, nullable=False)   # the secondary user_id
    platform = Column(String)                     # "telegram" or "whatsapp"
    created_at = Column(DateTime, default=datetime.utcnow)

class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint('telegram_user_id', 'category', name='uq_user_category'),)

    id = Column(Integer, primary_key=True)
    telegram_user_id = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="EGP")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PendingTransaction(Base):
    __tablename__ = "pending_transactions"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, unique=True, index=True)
    data = Column(Text, nullable=False)       # JSON blob
    state = Column(String, default="confirm")  # confirm | awaiting_edit
    context = Column(Text, nullable=True)      # extra JSON context (editing_id, etc.)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

# ── Admin Models ──────────────────────────────────────────────────────────

class AdminUser(Base):
    __tablename__ = "admin_users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    totp_secret = Column(String, nullable=True)  # for future 2FA
    created_at = Column(DateTime, default=datetime.utcnow)

class AdminAuditLog(Base):
    __tablename__ = "admin_audit_log"
    id = Column(Integer, primary_key=True)
    admin_username = Column(String, nullable=False)
    action = Column(String, nullable=False)
    target_type = Column(String, nullable=True)  # "user", "transaction", "setting"
    target_id = Column(String, nullable=True)
    ip = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class AdminSession(Base):
    __tablename__ = "admin_sessions"
    id = Column(Integer, primary_key=True)
    admin_username = Column(String, nullable=False)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    ip = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_active = Column(DateTime, default=datetime.utcnow)
    revoked = Column(Boolean, default=False)

class Investment(Base):
    __tablename__ = "investments"
    __table_args__ = (
        Index("ix_investments_user_id", "user_id"),
        Index("ix_investments_date", "date"),
        Index("ix_investments_asset_type", "asset_type"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    asset_name = Column(String, nullable=False)
    asset_type = Column(String, nullable=False)  # stocks/crypto/gold/real_estate/other
    amount_invested = Column(Float, nullable=False)
    current_value = Column(Float, nullable=True)
    currency = Column(String, default="EGP")
    notes = Column(Text, nullable=True)
    date = Column(String, nullable=False)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Live price tracking fields
    grams = Column(Float, nullable=True)              # gold: quantity in grams
    ticker_symbol = Column(String(20), nullable=True) # stocks: e.g. TSLA
    coin_id = Column(String(50), nullable=True)       # crypto: e.g. bitcoin
    forex_pair = Column(String(10), nullable=True)    # currency: e.g. USD, EUR
    karat = Column(Integer, nullable=True)            # gold: 24, 21, 18, 14
    price_per_unit = Column(Float, nullable=True)     # price per unit at purchase
    current_price = Column(Float, nullable=True)      # latest fetched price
    last_price_update = Column(DateTime, nullable=True)


class InvestmentPriceHistory(Base):
    __tablename__ = "investment_price_history"
    __table_args__ = (
        Index("ix_price_hist_identifier", "identifier"),
        Index("ix_price_hist_recorded", "recorded_at"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asset_type = Column(String(50), nullable=False)
    identifier = Column(String(100), nullable=False)  # ticker, coin_id, or 'gold'
    price = Column(Float, nullable=False)
    currency = Column(String(10), default="EGP")
    recorded_at = Column(DateTime, default=datetime.utcnow)


class NotificationSettings(Base):
    __tablename__ = "notification_settings"
    id = Column(Integer, primary_key=True)
    telegram_user_id = Column(String, unique=True, nullable=False, index=True)
    daily_enabled = Column(Boolean, default=True)
    daily_time = Column(String, default="22:00")       # HH:MM
    weekly_enabled = Column(Boolean, default=True)
    weekly_day = Column(Integer, default=0)             # 0=Sunday
    timezone = Column(String, default="Africa/Cairo")
    last_sent_daily = Column(DateTime, nullable=True)
    last_sent_weekly = Column(DateTime, nullable=True)
    failures = Column(Integer, default=0)


class UserSettings(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True)
    telegram_user_id = Column(String, unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=True)
    main_currency = Column(String(10), default="EGP")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def init_db():
    try:
        from sqlalchemy import inspect, text
        insp = inspect(engine)
        # Migrate old budgets table (no category column) → new per-category schema
        if insp.has_table("budgets"):
            cols = [c["name"] for c in insp.get_columns("budgets")]
            if "category" not in cols:
                print("[MIGRATION] Dropping old budgets table (adding category column)")
                with engine.begin() as conn:
                    conn.execute(text("DROP TABLE budgets"))
        # Add entry_type column to expenses if missing
        if insp.has_table("expenses"):
            cols = [c["name"] for c in insp.get_columns("expenses")]
            if "entry_type" not in cols:
                print("[MIGRATION] Adding entry_type column to expenses")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE expenses ADD COLUMN entry_type VARCHAR DEFAULT 'expense'"))
        Base.metadata.create_all(engine)
        # Add is_deleted column if missing
        if insp.has_table("expenses"):
            cols = [c["name"] for c in insp.get_columns("expenses")]
            if "is_deleted" not in cols:
                logger.info("[MIGRATION] Adding is_deleted column to expenses")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE expenses ADD COLUMN is_deleted BOOLEAN DEFAULT false"))
        # Add investments table migration
        if insp.has_table("investments"):
            inv_cols = [c["name"] for c in insp.get_columns("investments")]
            new_inv_cols = {
                "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "grams": "FLOAT",
                "ticker_symbol": "VARCHAR(20)",
                "coin_id": "VARCHAR(50)",
                "forex_pair": "VARCHAR(10)",
                "karat": "INTEGER",
                "price_per_unit": "FLOAT",
                "current_price": "FLOAT",
                "last_price_update": "TIMESTAMP",
            }
            with engine.begin() as conn:
                for col, col_type in new_inv_cols.items():
                    if col not in inv_cols:
                        conn.execute(text(f"ALTER TABLE investments ADD COLUMN {col} {col_type}"))
        # Normalize legacy categories to fixed list
        VALID_CATS = {"food", "transport", "shopping", "bills", "entertainment", "health", "education", "other",
                      "salary", "freelance", "gift", "refund", "investment", "other_income"}
        CAT_REMAP = {"transportation": "transport"}
        if insp.has_table("expenses"):
            with engine.begin() as conn:
                for old_cat, new_cat in CAT_REMAP.items():
                    result = conn.execute(
                        text("UPDATE expenses SET category = :new WHERE lower(category) = :old"),
                        {"new": new_cat, "old": old_cat}
                    )
                    if result.rowcount > 0:
                        logger.info(f"[MIGRATION] Renamed {result.rowcount} expenses: '{old_cat}' → '{new_cat}'")
    except Exception as e:
        logger.warning(f"Could not connect to database during init: {e}")
        logger.warning("Tables will be created on first successful connection.")

def save_expense(telegram_user_id: str, expense: dict, transcript: str):
    primary_id = get_primary_id(telegram_user_id)
    session = Session()
    try:
        record = Expense(
            telegram_user_id=primary_id,
            amount=expense["amount"],
            currency=expense.get("currency", "EGP"),
            category=expense.get("category", "other"),
            merchant=expense.get("merchant"),
            date=expense.get("date", "today"),
            transcript=transcript,
            entry_type=expense.get("type", "expense")
        )
        session.add(record)
        session.commit()
        return record.id
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def get_expenses(telegram_user_id: str):
    session = Session()
    try:
        return session.query(Expense).filter(
            Expense.telegram_user_id == telegram_user_id,
            Expense.is_deleted != True
        ).order_by(Expense.created_at.desc()).all()
    finally:
        session.close()
def get_monthly_summary(telegram_user_id: str):
    telegram_user_id = get_primary_id(telegram_user_id)
    session = Session()
    try:
        now = datetime.utcnow()
        entries = session.query(Expense).filter(
            Expense.telegram_user_id == telegram_user_id,
            Expense.is_deleted != True,
            extract('month', Expense.created_at) == now.month,
            extract('year', Expense.created_at) == now.year
        ).all()

        expense_total = sum(e.amount for e in entries if (e.entry_type or "expense") == "expense")
        income_total = sum(e.amount for e in entries if (e.entry_type or "expense") == "income")

        # breakdown by category (expenses only)
        breakdown = {}
        for e in entries:
            if (e.entry_type or "expense") == "expense":
                cat = e.category or "other"
                breakdown[cat] = breakdown.get(cat, 0) + e.amount

        return expense_total, breakdown, len(entries), income_total
    finally:
        session.close()
def get_recent_expenses(telegram_user_id: str, limit: int = 10):
    telegram_user_id = get_primary_id(telegram_user_id)
    session = Session()
    try:
        return session.query(Expense).filter(
            Expense.telegram_user_id == telegram_user_id,
            Expense.is_deleted != True
        ).order_by(Expense.created_at.desc()).limit(limit).all()
    finally:
        session.close()

def delete_expense(telegram_user_id: str, expense_id: int) -> bool:
    """Soft delete - marks expense as deleted instead of removing."""
    telegram_user_id = get_primary_id(telegram_user_id)
    session = Session()
    try:
        expense = session.query(Expense).filter_by(
            id=expense_id,
            telegram_user_id=telegram_user_id
        ).filter(Expense.is_deleted != True).first()
        if not expense:
            return False
        expense.is_deleted = True
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()
def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

def create_login_token(telegram_user_id: str, minutes: int = 10) -> str:
    raw = secrets.token_urlsafe(32)  # shareable token
    session = Session()
    try:
        rec = LoginToken(
            telegram_user_id=telegram_user_id,
            token_hash=_hash_token(raw),
            expires_at=datetime.utcnow() + timedelta(minutes=minutes),
            used=False
        )
        session.add(rec)
        session.commit()
        return raw
    finally:
        session.close()

def consume_login_token(raw: str) -> str | None:
    """Returns telegram_user_id if valid, else None"""
    h = _hash_token(raw)
    session = Session()
    try:
        token = session.query(LoginToken).filter_by(token_hash=h).first()
        if not token:
            return None
        if token.used:
            return None
        if token.expires_at <= datetime.utcnow():
            return None

        token.used = True
        session.commit()
        return token.telegram_user_id
    finally:
        session.close()

def set_budget(telegram_user_id: str, category: str, amount: float, currency: str = "EGP") -> None:
    telegram_user_id = get_primary_id(telegram_user_id)
    session = Session()
    try:
        existing = session.query(Budget).filter_by(
            telegram_user_id=telegram_user_id, category=category
        ).first()
        if existing:
            existing.amount = amount
            existing.currency = currency
        else:
            session.add(Budget(
                telegram_user_id=telegram_user_id,
                category=category,
                amount=amount,
                currency=currency
            ))
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def get_budget(telegram_user_id: str) -> dict:
    """Returns {category: amount} dict of all budgets for this user."""
    telegram_user_id = get_primary_id(telegram_user_id)
    session = Session()
    try:
        budgets = session.query(Budget).filter_by(telegram_user_id=telegram_user_id).all()
        return {b.category: b.amount for b in budgets}
    finally:
        session.close()

def delete_budget(telegram_user_id: str, category: str) -> bool:
    """Removes a per-category budget. Returns True if deleted."""
    telegram_user_id = get_primary_id(telegram_user_id)
    session = Session()
    try:
        budget = session.query(Budget).filter_by(
            telegram_user_id=telegram_user_id, category=category
        ).first()
        if not budget:
            return False
        session.delete(budget)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def get_category_spending_this_month(telegram_user_id: str, category: str) -> float:
    """Returns total spending (expenses only) for a specific category this month."""
    telegram_user_id = get_primary_id(telegram_user_id)
    session = Session()
    try:
        now = datetime.utcnow()
        expenses = session.query(Expense).filter(
            Expense.telegram_user_id == telegram_user_id,
            Expense.is_deleted != True,
            Expense.category == category,
            Expense.entry_type != "income",
            extract('month', Expense.created_at) == now.month,
            extract('year', Expense.created_at) == now.year
        ).all()
        return sum(e.amount for e in expenses)
    finally:
        session.close()
def get_primary_id(user_id: str) -> str:
    """Resolves any linked ID to the primary user ID."""
    session = Session()
    try:
        link = session.query(UserLink).filter_by(linked_id=user_id).first()
        return link.primary_id if link else user_id
    finally:
        session.close()

def link_accounts(primary_id: str, linked_id: str, platform: str):
    session = Session()
    try:
        existing = session.query(UserLink).filter_by(linked_id=linked_id).first()
        if existing:
            existing.primary_id = primary_id
        else:
            session.add(UserLink(
                primary_id=primary_id,
                linked_id=linked_id,
                platform=platform
            ))
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def get_link_token(primary_id: str) -> str:
    """Store a temp token for linking."""
    import secrets
    token = secrets.token_urlsafe(16)
    session = Session()
    try:
        # reuse UserLink table with a temp marker
        session.add(UserLink(
            primary_id=primary_id,
            linked_id=f"pending_{token}",
            platform="pending"
        ))
        session.commit()
        return token
    finally:
        session.close()

def resolve_link_token(token: str, whatsapp_id: str) -> str | None:
    """Links WhatsApp ID to Telegram ID using token. Returns primary_id."""
    session = Session()
    try:
        link = session.query(UserLink).filter_by(
            linked_id=f"pending_{token}"
        ).first()
        if not link:
            return None
        primary_id = link.primary_id
        # replace pending with real whatsapp id
        link.linked_id = whatsapp_id
        link.platform = "whatsapp"
        session.commit()
        return primary_id
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

# ── Pending Transactions (persist across restarts) ────────────────────────

import json as _json

def save_pending(user_id: str, data: dict, state: str = "confirm", context: dict | None = None, ttl_minutes: int = 30):
    session = Session()
    try:
        existing = session.query(PendingTransaction).filter_by(user_id=user_id).first()
        if existing:
            existing.data = _json.dumps(data)
            existing.state = state
            existing.context = _json.dumps(context) if context else None
            existing.expires_at = datetime.utcnow() + timedelta(minutes=ttl_minutes)
        else:
            session.add(PendingTransaction(
                user_id=user_id,
                data=_json.dumps(data),
                state=state,
                context=_json.dumps(context) if context else None,
                expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes)
            ))
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def get_pending(user_id: str) -> tuple[dict, str, dict | None] | None:
    """Returns (data_dict, state, context_dict) or None if nothing pending / expired."""
    session = Session()
    try:
        p = session.query(PendingTransaction).filter_by(user_id=user_id).first()
        if not p or p.expires_at <= datetime.utcnow():
            if p:
                session.delete(p)
                session.commit()
            return None
        data = _json.loads(p.data)
        ctx = _json.loads(p.context) if p.context else None
        return data, p.state, ctx
    finally:
        session.close()

def delete_pending(user_id: str) -> bool:
    """Delete pending transaction. Returns True if something was actually deleted."""
    session = Session()
    try:
        count = session.query(PendingTransaction).filter_by(user_id=user_id).delete()
        session.commit()
        return count > 0
    finally:
        session.close()

def cleanup_expired_pending():
    session = Session()
    try:
        session.query(PendingTransaction).filter(
            PendingTransaction.expires_at <= datetime.utcnow()
        ).delete()
        session.commit()
    finally:
        session.close()

# ── User helpers ──────────────────────────────────────────────────────────

# ── Admin helpers ─────────────────────────────────────────────────────────

from sqlalchemy import func, desc, distinct, case

def get_all_users_admin(page=1, per_page=25, search=None, status=None):
    """Get paginated user list for admin dashboard."""
    session = Session()
    try:
        # Get distinct user IDs with aggregated stats
        subq = session.query(
            Expense.telegram_user_id.label("user_id"),
            func.count(Expense.id).label("total_transactions"),
            func.sum(case((Expense.entry_type == "expense", Expense.amount), else_=0)).label("total_spent"),
            func.sum(case((Expense.entry_type == "income", Expense.amount), else_=0)).label("total_income"),
            func.min(Expense.created_at).label("joined"),
            func.max(Expense.created_at).label("last_active"),
        ).group_by(Expense.telegram_user_id)

        if search:
            subq = subq.filter(Expense.telegram_user_id.ilike(f"%{search}%"))

        total = subq.count()
        users = subq.order_by(desc("last_active")).offset((page - 1) * per_page).limit(per_page).all()

        result = []
        for u in users:
            # Check for linked accounts
            links = session.query(UserLink).filter(
                (UserLink.primary_id == u.user_id) | (UserLink.linked_id == u.user_id)
            ).all()
            platforms = set()
            for link in links:
                if link.platform:
                    platforms.add(link.platform)
            # Determine primary platform
            if u.user_id.isdigit() and len(u.user_id) < 15:
                platforms.add("telegram")
            else:
                platforms.add("whatsapp")

            result.append({
                "user_id": u.user_id,
                "total_transactions": u.total_transactions,
                "total_spent": float(u.total_spent or 0),
                "total_income": float(u.total_income or 0),
                "joined": u.joined.isoformat() if u.joined else None,
                "last_active": u.last_active.isoformat() if u.last_active else None,
                "platforms": list(platforms),
            })

        return {"users": result, "total": total, "page": page, "per_page": per_page}
    finally:
        session.close()


def get_user_detail_admin(user_id: str):
    """Get detailed user info for admin."""
    session = Session()
    try:
        expenses = session.query(Expense).filter_by(
            telegram_user_id=user_id
        ).order_by(desc(Expense.created_at)).all()

        if not expenses:
            return None

        total_spent = sum(e.amount for e in expenses if (e.entry_type or "expense") == "expense")
        total_income = sum(e.amount for e in expenses if (e.entry_type or "expense") == "income")

        breakdown = {}
        for e in expenses:
            if (e.entry_type or "expense") == "expense":
                breakdown[e.category] = breakdown.get(e.category, 0) + e.amount

        transactions = [{
            "id": e.id,
            "amount": e.amount,
            "currency": e.currency,
            "category": e.category,
            "merchant": e.merchant,
            "date": e.date,
            "entry_type": e.entry_type or "expense",
            "transcript": e.transcript,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        } for e in expenses]

        links = session.query(UserLink).filter(
            (UserLink.primary_id == user_id) | (UserLink.linked_id == user_id)
        ).all()

        return {
            "user_id": user_id,
            "total_transactions": len(expenses),
            "total_spent": total_spent,
            "total_income": total_income,
            "breakdown": breakdown,
            "transactions": transactions,
            "joined": expenses[-1].created_at.isoformat() if expenses else None,
            "last_active": expenses[0].created_at.isoformat() if expenses else None,
            "linked_accounts": [{"id": l.linked_id, "platform": l.platform} for l in links],
        }
    finally:
        session.close()


def get_all_transactions_admin(page=1, per_page=25, entry_type=None, category=None,
                                user_id=None, search=None, date_from=None, date_to=None):
    session = Session()
    try:
        q = session.query(Expense).order_by(desc(Expense.created_at))
        if entry_type:
            q = q.filter(Expense.entry_type == entry_type)
        if category:
            q = q.filter(Expense.category == category)
        if user_id:
            q = q.filter(Expense.telegram_user_id == user_id)
        if search:
            q = q.filter(
                (Expense.merchant.ilike(f"%{search}%")) |
                (Expense.transcript.ilike(f"%{search}%"))
            )
        if date_from:
            q = q.filter(Expense.created_at >= date_from)
        if date_to:
            q = q.filter(Expense.created_at <= date_to)

        total = q.count()
        txns = q.offset((page - 1) * per_page).limit(per_page).all()

        return {
            "transactions": [{
                "id": t.id,
                "user_id": t.telegram_user_id,
                "amount": t.amount,
                "currency": t.currency,
                "category": t.category,
                "merchant": t.merchant,
                "entry_type": t.entry_type or "expense",
                "transcript": t.transcript,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            } for t in txns],
            "total": total,
            "page": page,
            "per_page": per_page,
        }
    finally:
        session.close()


def get_global_stats(days=30):
    session = Session()
    try:
        now = datetime.utcnow()
        cutoff = now - timedelta(days=days)
        week_ago = now - timedelta(days=7)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        total_users = session.query(distinct(Expense.telegram_user_id)).count()
        active_7d = session.query(distinct(Expense.telegram_user_id)).filter(
            Expense.created_at >= week_ago
        ).count()
        total_txns = session.query(Expense).count()
        total_volume = session.query(func.sum(Expense.amount)).scalar() or 0
        new_today = session.query(distinct(Expense.telegram_user_id)).filter(
            Expense.created_at >= today_start
        ).count()  # approximation
        txns_today = session.query(Expense).filter(Expense.created_at >= today_start).count()

        # Expense vs income
        total_expense = session.query(func.sum(Expense.amount)).filter(
            Expense.entry_type == "expense"
        ).scalar() or 0
        total_income = session.query(func.sum(Expense.amount)).filter(
            Expense.entry_type == "income"
        ).scalar() or 0

        # Top categories
        top_cats = session.query(
            Expense.category, func.sum(Expense.amount).label("total")
        ).filter(Expense.entry_type == "expense").group_by(
            Expense.category
        ).order_by(desc("total")).limit(10).all()

        # Top merchants
        top_merchants = session.query(
            Expense.merchant, func.sum(Expense.amount).label("total")
        ).filter(
            Expense.merchant.isnot(None), Expense.merchant != ""
        ).group_by(Expense.merchant).order_by(desc("total")).limit(10).all()

        # Daily activity (last N days)
        daily_data = []
        for i in range(min(days, 90)):
            day = today_start - timedelta(days=i)
            day_end = day + timedelta(days=1)
            day_txns = session.query(Expense).filter(
                Expense.created_at >= day, Expense.created_at < day_end
            ).count()
            day_users = session.query(distinct(Expense.telegram_user_id)).filter(
                Expense.created_at >= day, Expense.created_at < day_end
            ).count()
            day_vol = session.query(func.sum(Expense.amount)).filter(
                Expense.created_at >= day, Expense.created_at < day_end
            ).scalar() or 0
            daily_data.append({
                "date": day.strftime("%Y-%m-%d"),
                "transactions": day_txns,
                "active_users": day_users,
                "volume": float(day_vol),
            })
        daily_data.reverse()

        return {
            "total_users": total_users,
            "active_7d": active_7d,
            "total_transactions": total_txns,
            "total_volume": float(total_volume),
            "new_today": new_today,
            "transactions_today": txns_today,
            "total_expense": float(total_expense),
            "total_income": float(total_income),
            "top_categories": [{"name": c[0], "total": float(c[1])} for c in top_cats],
            "top_merchants": [{"name": m[0], "total": float(m[1])} for m in top_merchants],
            "daily": daily_data,
        }
    finally:
        session.close()


def log_admin_action(username: str, action: str, target_type=None, target_id=None, ip=None, details=None):
    session = Session()
    try:
        session.add(AdminAuditLog(
            admin_username=username,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id else None,
            ip=ip,
            details=details,
        ))
        session.commit()
    finally:
        session.close()


def get_audit_log(page=1, per_page=50):
    session = Session()
    try:
        q = session.query(AdminAuditLog).order_by(desc(AdminAuditLog.timestamp))
        total = q.count()
        logs = q.offset((page - 1) * per_page).limit(per_page).all()
        return {
            "logs": [{
                "id": l.id,
                "admin": l.admin_username,
                "action": l.action,
                "target_type": l.target_type,
                "target_id": l.target_id,
                "ip": l.ip,
                "details": l.details,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
            } for l in logs],
            "total": total,
            "page": page,
        }
    finally:
        session.close()


def create_admin_session(username: str, ip: str = None, expiry_seconds: int = 1800):
    token = secrets.token_urlsafe(48)
    session = Session()
    try:
        session.add(AdminSession(
            admin_username=username,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            ip=ip,
            expires_at=datetime.utcnow() + timedelta(seconds=expiry_seconds),
        ))
        session.commit()
        return token
    finally:
        session.close()


def validate_admin_session(token: str):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    session = Session()
    try:
        s = session.query(AdminSession).filter_by(token_hash=token_hash, revoked=False).first()
        if not s or s.expires_at <= datetime.utcnow():
            return None
        s.last_active = datetime.utcnow()
        session.commit()
        return s.admin_username
    finally:
        session.close()


def revoke_admin_session(session_id: int):
    session = Session()
    try:
        s = session.query(AdminSession).filter_by(id=session_id).first()
        if s:
            s.revoked = True
            session.commit()
            return True
        return False
    finally:
        session.close()


def get_active_admin_sessions(username: str = None):
    session = Session()
    try:
        q = session.query(AdminSession).filter(
            AdminSession.revoked == False,
            AdminSession.expires_at > datetime.utcnow()
        )
        if username:
            q = q.filter_by(admin_username=username)
        sessions = q.order_by(desc(AdminSession.last_active)).all()
        return [{
            "id": s.id,
            "admin": s.admin_username,
            "ip": s.ip,
            "created_at": s.created_at.isoformat(),
            "last_active": s.last_active.isoformat() if s.last_active else None,
            "expires_at": s.expires_at.isoformat(),
        } for s in sessions]
    finally:
        session.close()


# ── Notification Settings CRUD ────────────────────────────────────────────

def get_notification_settings(user_id: str) -> dict:
    """Return notification prefs for a user. Returns defaults if none saved."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        ns = session.query(NotificationSettings).filter_by(telegram_user_id=user_id).first()
        if not ns:
            return {
                "daily_enabled": True, "daily_time": "22:00",
                "weekly_enabled": True, "weekly_day": 0,
                "timezone": "Africa/Cairo",
            }
        return {
            "daily_enabled": ns.daily_enabled,
            "daily_time": ns.daily_time,
            "weekly_enabled": ns.weekly_enabled,
            "weekly_day": ns.weekly_day,
            "timezone": ns.timezone,
        }
    finally:
        session.close()


def update_notification_settings(user_id: str, **kwargs) -> dict:
    """Upsert notification settings. Only updates provided fields."""
    user_id = get_primary_id(user_id)
    ALLOWED = {"daily_enabled", "daily_time", "weekly_enabled", "weekly_day", "timezone"}
    session = Session()
    try:
        ns = session.query(NotificationSettings).filter_by(telegram_user_id=user_id).first()
        if not ns:
            ns = NotificationSettings(telegram_user_id=user_id)
            session.add(ns)
        for k, v in kwargs.items():
            if k in ALLOWED:
                setattr(ns, k, v)
        session.commit()
        return {
            "daily_enabled": ns.daily_enabled,
            "daily_time": ns.daily_time,
            "weekly_enabled": ns.weekly_enabled,
            "weekly_day": ns.weekly_day,
            "timezone": ns.timezone,
        }
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def get_user_settings(user_id: str) -> dict:
    """Return user profile settings. Returns defaults if none saved."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        us = session.query(UserSettings).filter_by(telegram_user_id=user_id).first()
        if not us:
            return {"name": None, "main_currency": "EGP"}
        return {"name": us.name, "main_currency": us.main_currency or "EGP"}
    finally:
        session.close()


def update_user_settings(user_id: str, **kwargs) -> dict:
    """Upsert user profile settings. Only updates provided fields."""
    user_id = get_primary_id(user_id)
    ALLOWED = {"name", "main_currency"}
    session = Session()
    try:
        us = session.query(UserSettings).filter_by(telegram_user_id=user_id).first()
        if not us:
            us = UserSettings(telegram_user_id=user_id)
            session.add(us)
        for k, v in kwargs.items():
            if k in ALLOWED:
                setattr(us, k, v)
        session.commit()
        return {"name": us.name, "main_currency": us.main_currency or "EGP"}
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def get_all_notification_users() -> list:
    """Return all users who have at least one notification enabled, with their settings."""
    session = Session()
    try:
        rows = session.query(NotificationSettings).filter(
            (NotificationSettings.daily_enabled == True) |
            (NotificationSettings.weekly_enabled == True)
        ).filter(NotificationSettings.failures < 3).all()
        return [{
            "user_id": r.telegram_user_id,
            "daily_enabled": r.daily_enabled,
            "daily_time": r.daily_time,
            "weekly_enabled": r.weekly_enabled,
            "weekly_day": r.weekly_day,
            "timezone": r.timezone,
            "last_sent_daily": r.last_sent_daily,
            "last_sent_weekly": r.last_sent_weekly,
        } for r in rows]
    finally:
        session.close()


def get_distinct_user_ids() -> list[str]:
    """Return all distinct user IDs that have recorded at least one expense."""
    session = Session()
    try:
        rows = session.query(distinct(Expense.telegram_user_id)).all()
        return [r[0] for r in rows]
    finally:
        session.close()


def mark_notification_sent(user_id: str, kind: str):
    """Update last_sent_daily or last_sent_weekly timestamp."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        ns = session.query(NotificationSettings).filter_by(telegram_user_id=user_id).first()
        if not ns:
            ns = NotificationSettings(telegram_user_id=user_id)
            session.add(ns)
        if kind == "daily":
            ns.last_sent_daily = datetime.utcnow()
        elif kind == "weekly":
            ns.last_sent_weekly = datetime.utcnow()
        ns.failures = 0
        session.commit()
    finally:
        session.close()


def increment_notification_failure(user_id: str):
    """Track delivery failures. After 3, user is auto-skipped."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        ns = session.query(NotificationSettings).filter_by(telegram_user_id=user_id).first()
        if ns:
            ns.failures = (ns.failures or 0) + 1
            session.commit()
    finally:
        session.close()


def get_daily_transactions(user_id: str, date_obj):
    """Get all transactions for a user on a specific date."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        day_start = date_obj.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        return session.query(Expense).filter(
            Expense.telegram_user_id == user_id,
            Expense.is_deleted != True,
            Expense.created_at >= day_start,
            Expense.created_at < day_end
        ).all()
    finally:
        session.close()


def get_weekly_transactions(user_id: str, start_date, end_date):
    """Get all transactions for a user between start and end dates."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        return session.query(Expense).filter(
            Expense.telegram_user_id == user_id,
            Expense.is_deleted != True,
            Expense.created_at >= start_date,
            Expense.created_at < end_date
        ).all()
    finally:
        session.close()


def is_new_user(user_id: str) -> bool:
    """Check if user registered today (no transactions before today)."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        oldest = session.query(Expense).filter(
            Expense.telegram_user_id == user_id,
            Expense.is_deleted != True
        ).order_by(Expense.created_at.asc()).first()
        if not oldest or not oldest.created_at:
            return True
        return oldest.created_at.date() == datetime.utcnow().date()
    finally:
        session.close()


def save_investment(user_id: str, data: dict) -> str:
    """Save a new investment record. Returns the new investment ID."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        inv = Investment(
            id=str(uuid.uuid4()),
            user_id=user_id,
            asset_name=data["asset_name"],
            asset_type=data.get("asset_type", "other"),
            amount_invested=data["amount_invested"],
            current_value=data.get("current_value"),
            currency=data.get("currency", "EGP"),
            notes=data.get("notes"),
            date=data.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
            grams=data.get("grams"),
            ticker_symbol=data.get("ticker_symbol"),
            coin_id=data.get("coin_id"),
            forex_pair=data.get("forex_pair"),
            karat=data.get("karat"),
            price_per_unit=data.get("price_per_unit"),
        )
        session.add(inv)
        session.commit()
        return inv.id
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def get_investments(user_id: str) -> list:
    """Return all active investments for a user."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        rows = session.query(Investment).filter(
            Investment.user_id == user_id,
            Investment.is_deleted != True
        ).order_by(Investment.created_at.desc()).all()
        return rows
    finally:
        session.close()


def update_investment_value(user_id: str, investment_id: str, current_value: float, notes: str | None = None, amount_invested: float | None = None) -> bool:
    """Update current_value, notes, and/or amount_invested for an investment. Returns True on success."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        inv = session.query(Investment).filter_by(id=investment_id, user_id=user_id).filter(Investment.is_deleted != True).first()
        if not inv:
            return False
        if current_value is not None:
            inv.current_value = current_value
        if notes is not None:
            inv.notes = notes
        if amount_invested is not None:
            inv.amount_invested = amount_invested
        inv.updated_at = datetime.utcnow()
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def delete_investment(user_id: str, investment_id: str) -> bool:
    """Soft-delete an investment. Returns True on success."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        inv = session.query(Investment).filter_by(id=investment_id, user_id=user_id).filter(Investment.is_deleted != True).first()
        if not inv:
            return False
        inv.is_deleted = True
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def get_investment_summary(user_id: str) -> dict:
    """Return summary stats for a user's investments."""
    user_id = get_primary_id(user_id)
    investments = get_investments(user_id)
    total_invested = sum(i.amount_invested for i in investments if i.amount_invested > 0)
    total_current = sum(i.current_value for i in investments if i.current_value is not None)
    has_current = any(i.current_value is not None for i in investments)
    # Only compute gain/loss for investments where we have a known cost basis
    gainable = [i for i in investments if i.current_value is not None and i.amount_invested > 0]
    gain_invested = sum(i.amount_invested for i in gainable)
    gain_current = sum(i.current_value for i in gainable)
    total_gain = (gain_current - gain_invested) if gainable else None
    gain_pct = (total_gain / gain_invested * 100) if (gainable and gain_invested > 0) else None
    breakdown: dict[str, float] = {}
    for inv in investments:
        # Use current_value for allocation if available (more accurate), else amount_invested
        breakdown[inv.asset_type] = breakdown.get(inv.asset_type, 0) + (inv.current_value or inv.amount_invested)
    return {
        "total_invested": total_invested,
        "current_value": total_current if has_current else None,
        "total_gain": total_gain,
        "gain_percentage": gain_pct,
        "breakdown": breakdown,
    }


def record_price_history(asset_type: str, identifier: str, price: float, currency: str = "EGP"):
    """Store a price snapshot in history."""
    session = Session()
    try:
        session.add(InvestmentPriceHistory(
            id=str(uuid.uuid4()),
            asset_type=asset_type,
            identifier=identifier,
            price=price,
            currency=currency,
        ))
        session.commit()
    except Exception as e:
        session.rollback()
        logger.warning(f"record_price_history failed: {e}")
    finally:
        session.close()


def get_price_history(identifier: str, limit: int = 7, days: int | None = None) -> list:
    """Return price snapshots for an identifier, oldest first.
    If days is given, return all records within that time window.
    Otherwise fall back to the last `limit` records."""
    session = Session()
    try:
        q = session.query(InvestmentPriceHistory).filter_by(identifier=identifier)
        if days is not None:
            cutoff = datetime.utcnow() - timedelta(days=days)
            q = q.filter(InvestmentPriceHistory.recorded_at >= cutoff)
            rows = q.order_by(InvestmentPriceHistory.recorded_at.asc()).all()
        else:
            rows = q.order_by(InvestmentPriceHistory.recorded_at.desc()).limit(limit).all()
            rows.reverse()
        return [{"price": r.price, "recorded_at": r.recorded_at.isoformat()} for r in rows]
    finally:
        session.close()


def update_investment_price(investment_id: str, current_price: float, current_value: float):
    """Update current_price and current_value for an investment after a live fetch."""
    session = Session()
    try:
        inv = session.query(Investment).filter_by(id=investment_id).filter(Investment.is_deleted != True).first()
        if inv:
            inv.current_price = current_price
            inv.current_value = current_value
            inv.last_price_update = datetime.utcnow()
            session.commit()
    except Exception as e:
        session.rollback()
        logger.warning(f"update_investment_price failed: {e}")
    finally:
        session.close()


def get_all_trackable_investments() -> list:
    """Return all non-deleted investments that have price tracking identifiers."""
    session = Session()
    try:
        rows = session.query(Investment).filter(
            Investment.is_deleted != True,
            (Investment.ticker_symbol.isnot(None)) |
            (Investment.coin_id.isnot(None)) |
            (Investment.asset_type == "gold") |
            (Investment.forex_pair.isnot(None))
        ).all()
        return rows
    finally:
        session.close()


def delete_user_data(user_id: str) -> bool:
    """Permanently delete ALL user data (GDPR). Irreversible."""
    user_id = get_primary_id(user_id)
    session = Session()
    try:
        session.query(Expense).filter_by(telegram_user_id=user_id).delete()
        session.query(Budget).filter_by(telegram_user_id=user_id).delete()
        session.query(Investment).filter_by(user_id=user_id).delete()
        session.query(NotificationSettings).filter_by(telegram_user_id=user_id).delete()
        session.query(UserLink).filter(
            (UserLink.primary_id == user_id) | (UserLink.linked_id == user_id)
        ).delete(synchronize_session=False)
        session.commit()
        logger.info(f"All data deleted for user {user_id}")
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to delete data for user {user_id}: {e}")
        return False
    finally:
        session.close()