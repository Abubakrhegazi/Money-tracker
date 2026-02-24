import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, extract
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///spending_tracker.db")

# Railway PostgreSQL URLs start with postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
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
    transcript = Column(String)  # raw voice transcript, useful for debugging
    created_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(engine)

def save_expense(telegram_user_id: str, expense: dict, transcript: str):
    session = Session()
    try:
        record = Expense(
            telegram_user_id=telegram_user_id,
            amount=expense["amount"],
            currency=expense.get("currency", "EGP"),
            category=expense.get("category", "other"),
            merchant=expense.get("merchant"),
            date=expense.get("date", "today"),
            transcript=transcript
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
    session = Session()
    try:
        now = datetime.utcnow()
        expenses = session.query(Expense).filter(
            Expense.telegram_user_id == telegram_user_id,
            extract('month', Expense.created_at) == now.month,
            extract('year', Expense.created_at) == now.year
        ).all()

        total = sum(e.amount for e in expenses)
        
        # breakdown by category
        breakdown = {}
        for e in expenses:
            cat = e.category or "other"
            breakdown[cat] = breakdown.get(cat, 0) + e.amount

        return total, breakdown, len(expenses)
    finally:
        session.close()
def get_recent_expenses(telegram_user_id: str, limit: int = 10):
    session = Session()
    try:
        return session.query(Expense).filter_by(
            telegram_user_id=telegram_user_id
        ).order_by(Expense.created_at.desc()).limit(limit).all()
    finally:
        session.close()

def delete_expense(telegram_user_id: str, expense_id: int) -> bool:
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