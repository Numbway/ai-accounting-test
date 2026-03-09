from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


# ========== 支出记录 Schema ==========
class ExpenseBase(BaseModel):
    date: datetime
    amount: float
    category: str
    category_full: Optional[str] = None
    detail: Optional[str] = None
    source_type: str = "text"
    raw_input: Optional[str] = None
    payment_method: str = "other"
    merchant: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    date: Optional[datetime] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    category_full: Optional[str] = None
    detail: Optional[str] = None
    payment_method: Optional[str] = None
    merchant: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class ExpenseResponse(ExpenseBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== AI 解析 Schema ==========
class AITextParseRequest(BaseModel):
    input: str


class AIImageParseRequest(BaseModel):
    """图片上传使用 multipart/form-data，不使用 schema"""


class AIParseResponse(BaseModel):
    date: str
    amount: float
    category: str
    category_full: str
    detail: str
    payment_method: str
    merchant: Optional[str] = None
    raw_input: str


# ========== 统计 Schema ==========
class CategoryStats(BaseModel):
    category: str
    category_full: str
    total_amount: float
    count: int
    percentage: float


class MonthlyStats(BaseModel):
    year: int
    month: int
    total_amount: float
    count: int
    daily_avg: float
    categories: List[CategoryStats]


# ========== 类别 Schema ==========
class CategoryResponse(BaseModel):
    id: int
    name: str
    name_full: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None

    class Config:
        from_attributes = True


# ========== 预算 Schema ==========
class BudgetBase(BaseModel):
    year: int
    month: int
    amount: float


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    amount: float


class BudgetResponse(BudgetBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BudgetStatus(BaseModel):
    year: int
    month: int
    budget_amount: float
    spent_amount: float
    remaining_amount: float
    percentage: float
    is_over_budget: bool