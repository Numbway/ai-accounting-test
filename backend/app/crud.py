from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, date

from . import models, schemas


# ========== 支出记录 CRUD ==========
def create_expense(db: Session, expense: schemas.ExpenseCreate) -> models.Expense:
    db_expense = models.Expense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


def get_expenses(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None
) -> List[models.Expense]:
    query = db.query(models.Expense)
    
    if start_date:
        query = query.filter(models.Expense.date >= start_date)
    if end_date:
        query = query.filter(models.Expense.date <= end_date)
    if category:
        query = query.filter(models.Expense.category == category)
    
    return query.order_by(desc(models.Expense.date)).offset(skip).limit(limit).all()


def get_expense_by_id(db: Session, expense_id: str) -> Optional[models.Expense]:
    return db.query(models.Expense).filter(models.Expense.id == expense_id).first()


def update_expense(
    db: Session, 
    expense_id: str, 
    expense_update: schemas.ExpenseUpdate
) -> Optional[models.Expense]:
    db_expense = get_expense_by_id(db, expense_id)
    if not db_expense:
        return None
    
    update_data = expense_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_expense, field, value)
    
    db_expense.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_expense)
    return db_expense


def delete_expense(db: Session, expense_id: str) -> bool:
    db_expense = get_expense_by_id(db, expense_id)
    if not db_expense:
        return False
    db.delete(db_expense)
    db.commit()
    return True


# ========== 统计 CRUD ==========
def get_monthly_stats(
    db: Session, 
    year: int, 
    month: int
) -> schemas.MonthlyStats:
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    # 查询该月所有支出
    expenses = db.query(models.Expense).filter(
        models.Expense.date >= start_date,
        models.Expense.date < end_date
    ).all()
    
    total_amount = sum(e.amount for e in expenses)
    count = len(expenses)
    daily_avg = total_amount / 30 if total_amount > 0 else 0
    
    # 按类别分组
    category_data = {}
    for e in expenses:
        key = e.category
        if key not in category_data:
            category_data[key] = {
                "category": e.category,
                "category_full": e.category_full or e.category,
                "total_amount": 0,
                "count": 0
            }
        category_data[key]["total_amount"] += e.amount
        category_data[key]["count"] += 1
    
    categories = []
    for cat in category_data.values():
        cat["percentage"] = (cat["total_amount"] / total_amount * 100) if total_amount > 0 else 0
        categories.append(schemas.CategoryStats(**cat))
    
    # 按金额排序
    categories.sort(key=lambda x: x.total_amount, reverse=True)
    
    return schemas.MonthlyStats(
        year=year,
        month=month,
        total_amount=total_amount,
        count=count,
        daily_avg=daily_avg,
        categories=categories
    )


# ========== 类别 CRUD ==========
def get_categories(db: Session) -> List[models.Category]:
    return db.query(models.Category).all()


def init_default_categories(db: Session):
    """初始化默认类别"""
    default_categories = [
        {"name": "food", "name_full": "餐饮", "icon": "🍔", "color": "#FF6B6B"},
        {"name": "transport", "name_full": "交通", "icon": "🚌", "color": "#4ECDC4"},
        {"name": "shopping", "name_full": "购物", "icon": "🛒", "color": "#45B7D1"},
        {"name": "living", "name_full": "居住", "icon": "🏠", "color": "#96CEB4"},
        {"name": "medical", "name_full": "医疗", "icon": "💊", "color": "#FFEAA7"},
        {"name": "entertainment", "name_full": "娱乐", "icon": "🎬", "color": "#DDA0DD"},
        {"name": "income", "name_full": "收入", "icon": "💰", "color": "#98D8C8"},
        {"name": "other", "name_full": "其他", "icon": "📦", "color": "#B8B8B8"},
    ]
    
    for cat in default_categories:
        existing = db.query(models.Category).filter(models.Category.name == cat["name"]).first()
        if not existing:
            db.add(models.Category(**cat))
    
    db.commit()