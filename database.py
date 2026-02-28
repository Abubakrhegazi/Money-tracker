import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, extract, Boolean, UniqueConstraint, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import secrets
import hashlib

Base = declarative_base()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///spending_tracker.db")

# Railway PostgreSQL URLs start with postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Session = sessionmaker(bind=engine)

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True)
    telegram_user_id = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="EGP")
    category = Column(String)
    merchant = Column(String, nullable=True)
    date = Column(String)
    transcript = Column(String)
    entry_type = Column(String, default="expense")  # "expense" or "income"
    created_at = Column(DateTime, default=datetime.utcnow)

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
    except Exception as e:
        print(f"[WARNING] Could not connect to database during init: {e}")
        print("[WARNING] Tables will be created on first successful connection.")

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
        return session.query(Expense).filter_by(
            telegram_user_id=telegram_user_id
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
def get_monthly_summary_sync(telegram_user_id: str):
    telegram_user_id = get_primary_id(telegram_user_id)
    session = Session()
    try:
        now = datetime.utcnow()
        from sqlalchemy import extract
        entries = session.query(Expense).filter(
            Expense.telegram_user_id == telegram_user_id,
            extract('month', Expense.created_at) == now.month,
            extract('year', Expense.created_at) == now.year
        ).all()
        expense_total = sum(e.amount for e in entries if (e.entry_type or "expense") == "expense")
        income_total = sum(e.amount for e in entries if (e.entry_type or "expense") == "income")
        breakdown = {}
        for e in entries:
            if (e.entry_type or "expense") == "expense":
                cat = e.category or "other"
                breakdown[cat] = breakdown.get(cat, 0) + e.amount
        return expense_total, breakdown, len(entries), income_total
    finally:
        session.close()
def get_recent_expenses(telegram_user_id: str, limit: int = 10):
    telegram_user_id = get_primary_id(telegram_user_id)  # add this line
    session = Session()
    try:
        return session.query(Expense).filter_by(
            telegram_user_id=telegram_user_id
        ).order_by(Expense.created_at.desc()).limit(limit).all()
    finally:
        session.close()

def delete_expense(telegram_user_id: str, expense_id: int) -> bool:
    telegram_user_id = get_primary_id(telegram_user_id)  # add this line
    session = Session()
    try:
        expense = session.query(Expense).filter_by(
            id=expense_id,
            telegram_user_id=telegram_user_id  # security: users can only delete their own
        ).first()
        if not expense:
            return False
        session.delete(expense)
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

def delete_pending(user_id: str):
    session = Session()
    try:
        p = session.query(PendingTransaction).filter_by(user_id=user_id).first()
        if p:
            session.delete(p)
            session.commit()
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

def is_new_user(user_id: str) -> bool:
    """Returns True if this user has never recorded anything."""
    primary = get_primary_id(user_id)
    session = Session()
    try:
        count = session.query(Expense).filter_by(telegram_user_id=primary).count()
        return count == 0
    finally:
        session.close()