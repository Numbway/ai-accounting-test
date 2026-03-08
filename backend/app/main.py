from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import Optional, List
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

from .database import engine, Base, get_db
from . import models, schemas, crud
from .parser import parse_expense_text, parse_receipt_image

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI 记账 API", version="1.0.0")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== 初始化 ==========
@app.on_event("startup")
def startup_event():
    """启动时初始化默认数据"""
    db = next(get_db())
    crud.init_default_categories(db)


# ========== 支出记录 API ==========

@app.post("/api/expenses", response_model=schemas.ExpenseResponse)
def create_expense(
    expense: schemas.ExpenseCreate,
    db: Session = Depends(get_db)
):
    """添加支出记录"""
    return crud.create_expense(db, expense)


@app.post("/api/expenses/parse", response_model=schemas.AIParseResponse)
def parse_and_create_expense(
    request: schemas.AITextParseRequest,
    db: Session = Depends(get_db)
):
    """AI 解析文本并创建支出记录"""
    # AI 解析
    parsed = parse_expense_text(request.input)
    
    if "error" in parsed:
        raise HTTPException(status_code=400, detail=parsed["error"])
    
    # 转换为创建 schema
    expense_data = schemas.ExpenseCreate(
        date=datetime.fromisoformat(parsed["date"]),
        amount=parsed["amount"],
        category=parsed["category"],
        category_full=parsed.get("category_full"),
        detail=parsed.get("detail"),
        source_type=parsed.get("source_type", "text"),
        raw_input=parsed.get("raw_input"),
        payment_method=parsed.get("payment_method", "other"),
        merchant=parsed.get("merchant"),
    )
    
    # 创建记录
    expense = crud.create_expense(db, expense_data)
    
    # 返回解析结果（不是数据库对象）
    return schemas.AIParseResponse(
        date=parsed["date"],
        amount=parsed["amount"],
        category=parsed["category"],
        category_full=parsed.get("category_full", ""),
        detail=parsed.get("detail", ""),
        payment_method=parsed.get("payment_method", "other"),
        merchant=parsed.get("merchant"),
        raw_input=request.input
    )


@app.get("/api/expenses", response_model=List[schemas.ExpenseResponse])
def list_expenses(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """获取支出记录列表"""
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    
    expenses = crud.get_expenses(
        db, 
        skip=skip, 
        limit=limit,
        start_date=start.date() if start else None,
        end_date=end.date() if end else None,
        category=category
    )
    return expenses


@app.get("/api/expenses/{expense_id}", response_model=schemas.ExpenseResponse)
def get_expense(expense_id: str, db: Session = Depends(get_db)):
    """获取单条支出记录"""
    expense = crud.get_expense_by_id(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="记录不存在")
    return expense


@app.put("/api/expenses/{expense_id}", response_model=schemas.ExpenseResponse)
def update_expense(
    expense_id: str,
    expense_update: schemas.ExpenseUpdate,
    db: Session = Depends(get_db)
):
    """更新支出记录"""
    expense = crud.update_expense(db, expense_id, expense_update)
    if not expense:
        raise HTTPException(status_code=404, detail="记录不存在")
    return expense


@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: str, db: Session = Depends(get_db)):
    """删除支出记录"""
    success = crud.delete_expense(db, expense_id)
    if not success:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"message": "删除成功"}


# ========== 统计 API ==========

@app.get("/api/stats/{year}/{month}", response_model=schemas.MonthlyStats)
def get_monthly_stats(year: int, month: int, db: Session = Depends(get_db)):
    """获取月度统计"""
    return crud.get_monthly_stats(db, year, month)


# ========== 类别 API ==========

@app.get("/api/categories", response_model=List[schemas.CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """获取类别列表"""
    return crud.get_categories(db)


# ========== OCR API（预留）==========

@app.post("/api/ocr/receipt")
async def parse_receipt(
    file: UploadFile = File(...)
):
    """OCR 识别小票图片"""
    # TODO: 实现完整的 OCR + AI 解析
    content = await file.read()
    # 这里可以接入百度OCR、腾讯OCR等
    
    return {"message": "OCR功能开发中", "filename": file.filename}


# ========== 导出 API ==========

@app.get("/api/export/csv")
def export_csv(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """导出 CSV"""
    import csv
    import io
    
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    
    expenses = crud.get_expenses(
        db,
        skip=0,
        limit=10000,
        start_date=start.date() if start else None,
        end_date=end.date() if end else None
    )
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["日期", "金额", "类别", "详情", "支付方式", "商户", "备注"])
    
    for e in expenses:
        writer.writerow([
            e.date.strftime("%Y-%m-%d"),
            e.amount,
            e.category_full or e.category,
            e.detail or "",
            e.payment_method,
            e.merchant or "",
            e.notes or ""
        ])
    
    return {"csv": output.getvalue()}


# ========== 健康检查 ==========

@app.get("/api/health")
def health_check():
    """健康检查"""
    return {"status": "ok", "time": datetime.now().isoformat()}