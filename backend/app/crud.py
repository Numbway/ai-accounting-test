from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, date
import hashlib
import secrets

from . import models, schemas


# ========== 用户认证相关 ==========
def hash_password(password: str) -> str:
    """使用 SHA-256 哈希密码（生产环境应使用 bcrypt）"""
    salt = secrets.token_hex(16)
    pwdhash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${pwdhash}"


def verify_password(password: str, hashed: str) -> bool:
    """验证密码"""
    if "$" not in hashed:
        return False
    salt, stored_hash = hashed.split("$")
    pwdhash = hashlib.sha256((password + salt).encode()).hexdigest()
    return pwdhash == stored_hash


def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    """创建用户"""
    db_user = models.User(
        username=user.username,
        email=user.email,
        password_hash=hash_password(user.password),
        display_name=user.display_name or user.username
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    """根据用户名获取用户"""
    return db.query(models.User).filter(models.User.username == username).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[models.User]:
    """根据 ID 获取用户"""
    return db.query(models.User).filter(models.User.id == user_id).first()


def authenticate_user(db: Session, username: str, password: str) -> Optional[models.User]:
    """验证用户登录"""
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


# ========== 支出记录 CRUD ==========
def create_expense(db: Session, expense: schemas.ExpenseCreate, user_id: str) -> models.Expense:
    db_expense = models.Expense(**expense.model_dump(), user_id=user_id)
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


def get_expenses(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None
) -> List[models.Expense]:
    from datetime import datetime, time
    
    query = db.query(models.Expense).filter(models.Expense.user_id == user_id)
    
    if start_date:
        # 开始日期设为当天 00:00:00
        start_dt = datetime.combine(start_date, time.min)
        query = query.filter(models.Expense.date >= start_dt)
    if end_date:
        # 结束日期设为当天 23:59:59.999999，确保包含整天
        end_dt = datetime.combine(end_date, time.max)
        query = query.filter(models.Expense.date <= end_dt)
    if category:
        query = query.filter(models.Expense.category == category)
    
    return query.order_by(desc(models.Expense.date)).offset(skip).limit(limit).all()


def get_expense_by_id(db: Session, expense_id: str, user_id: str) -> Optional[models.Expense]:
    return db.query(models.Expense).filter(
        models.Expense.id == expense_id,
        models.Expense.user_id == user_id
    ).first()


def update_expense(
    db: Session, 
    expense_id: str, 
    user_id: str,
    expense_update: schemas.ExpenseUpdate
) -> Optional[models.Expense]:
    db_expense = get_expense_by_id(db, expense_id, user_id)
    if not db_expense:
        return None
    
    update_data = expense_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_expense, field, value)
    
    db_expense.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_expense)
    return db_expense


def delete_expense(db: Session, expense_id: str, user_id: str) -> bool:
    db_expense = get_expense_by_id(db, expense_id, user_id)
    if not db_expense:
        return False
    db.delete(db_expense)
    db.commit()
    return True


# ========== 统计 CRUD ==========
def get_monthly_stats(
    db: Session, 
    user_id: str,
    year: int, 
    month: int
) -> schemas.MonthlyStats:
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    # 查询该月所有记录
    expenses = db.query(models.Expense).filter(
        models.Expense.user_id == user_id,
        models.Expense.date >= start_date,
        models.Expense.date < end_date
    ).all()
    
    # 区分收入和支出
    expense_records = [e for e in expenses if e.category != 'income']
    income_records = [e for e in expenses if e.category == 'income']
    
    total_expense = sum(e.amount for e in expense_records)
    total_income = sum(e.amount for e in income_records)
    total_amount = total_expense  # 统计只显示支出
    count = len(expense_records)
    daily_avg = total_expense / 30 if total_expense > 0 else 0
    
    # 按类别分组（只统计支出类别）
    category_data = {}
    for e in expense_records:
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
        cat["percentage"] = (cat["total_amount"] / total_expense * 100) if total_expense > 0 else 0
        categories.append(schemas.CategoryStats(**cat))
    
    # 按金额排序
    categories.sort(key=lambda x: x.total_amount, reverse=True)
    
    return schemas.MonthlyStats(
        year=year,
        month=month,
        total_amount=total_expense,
        total_income=total_income,
        net_amount=total_income - total_expense,
        count=count,
        daily_avg=daily_avg,
        categories=categories
    )


# ========== 类别 CRUD ==========
def get_categories(db: Session) -> List[models.Category]:
    return db.query(models.Category).all()


def get_category_by_name(db: Session, name: str) -> Optional[models.Category]:
    """根据名称获取类别（支持 name 或 name_full 匹配）"""
    return db.query(models.Category).filter(
        (models.Category.name == name) | (models.Category.name_full == name)
    ).first()


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


# ========== 预算 CRUD ==========
def get_budget(db: Session, user_id: str, year: int, month: int) -> Optional[models.Budget]:
    return db.query(models.Budget).filter(
        models.Budget.user_id == user_id,
        models.Budget.year == year,
        models.Budget.month == month
    ).first()


def create_or_update_budget(db: Session, user_id: str, budget: schemas.BudgetCreate) -> models.Budget:
    existing = get_budget(db, user_id, budget.year, budget.month)
    
    if existing:
        existing.amount = budget.amount
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        db_budget = models.Budget(**budget.model_dump(), user_id=user_id)
        db.add(db_budget)
        db.commit()
        db.refresh(db_budget)
        return db_budget


def get_budget_status(db: Session, user_id: str, year: int, month: int) -> schemas.BudgetStatus:
    """获取预算执行情况（只计算支出，不包括收入）"""
    budget = get_budget(db, user_id, year, month)
    budget_amount = budget.amount if budget else 0
    
    # 计算当月支出（排除收入类别）
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    total_spent = db.query(func.sum(models.Expense.amount)).filter(
        models.Expense.user_id == user_id,
        models.Expense.date >= start_date,
        models.Expense.date < end_date,
        models.Expense.category != 'income'  # 排除收入
    ).scalar() or 0
    
    remaining = budget_amount - total_spent
    percentage = (total_spent / budget_amount * 100) if budget_amount > 0 else 0
    
    return schemas.BudgetStatus(
        year=year,
        month=month,
        budget_amount=budget_amount,
        spent_amount=total_spent,
        remaining_amount=remaining,
        percentage=percentage,
        is_over_budget=total_spent > budget_amount
    )