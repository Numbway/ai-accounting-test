from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import Optional, List
import os
from dotenv import load_dotenv
from pydantic import BaseModel
import secrets

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

# ========== 认证相关 ==========

def generate_token() -> str:
    """生成随机 token"""
    return secrets.token_urlsafe(32)


# 简单的 token 存储（生产环境应使用 Redis）
token_store = {}


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> models.User:
    """从 token 获取当前用户"""
    if not authorization:
        raise HTTPException(status_code=401, detail="未提供认证信息")
    
    # 支持 "Bearer token" 格式
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    user_id = token_store.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="无效的 token")
    
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    
    return user


# ========== 初始化 ==========
@app.on_event("startup")
def startup_event():
    """启动时初始化默认数据"""
    db = next(get_db())
    crud.init_default_categories(db)


# ========== 认证 API ==========

@app.post("/api/auth/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """用户注册"""
    # 检查用户名是否已存在
    existing = crud.get_user_by_username(db, user.username)
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    # 创建用户
    db_user = crud.create_user(db, user)
    
    # 生成 token
    token = generate_token()
    token_store[token] = db_user.id
    
    return {
        "user": {
            "id": db_user.id,
            "username": db_user.username,
            "display_name": db_user.display_name,
            "email": db_user.email
        },
        "token": token
    }


@app.post("/api/auth/login")
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """用户登录"""
    user = crud.authenticate_user(db, credentials.username, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    # 生成 token
    token = generate_token()
    token_store[token] = user.id
    
    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "email": user.email
        },
        "token": token
    }


@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    """获取当前用户信息"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "email": current_user.email
    }


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    """用户登出"""
    if authorization:
        token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
        token_store.pop(token, None)
    return {"message": "登出成功"}


# ========== 支出记录 API ==========

@app.post("/api/expenses", response_model=schemas.ExpenseResponse)
def create_expense(
    expense: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """添加支出记录"""
    return crud.create_expense(db, expense, current_user.id)


@app.post("/api/expenses/parse", response_model=schemas.AIParseResponse)
def parse_and_create_expense(
    request: schemas.AITextParseRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
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
    expense = crud.create_expense(db, expense_data, current_user.id)
    
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """获取支出记录列表"""
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    
    expenses = crud.get_expenses(
        db, 
        user_id=current_user.id,
        skip=skip, 
        limit=limit,
        start_date=start.date() if start else None,
        end_date=end.date() if end else None,
        category=category
    )
    return expenses


@app.get("/api/expenses/{expense_id}", response_model=schemas.ExpenseResponse)
def get_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """获取单条支出记录"""
    expense = crud.get_expense_by_id(db, expense_id, current_user.id)
    if not expense:
        raise HTTPException(status_code=404, detail="记录不存在")
    return expense


@app.put("/api/expenses/{expense_id}", response_model=schemas.ExpenseResponse)
def update_expense(
    expense_id: str,
    expense_update: schemas.ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """更新支出记录"""
    expense = crud.update_expense(db, expense_id, current_user.id, expense_update)
    if not expense:
        raise HTTPException(status_code=404, detail="记录不存在")
    return expense


@app.delete("/api/expenses/{expense_id}")
def delete_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """删除支出记录"""
    success = crud.delete_expense(db, expense_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"message": "删除成功"}


# ========== 统计 API ==========

@app.get("/api/stats/{year}/{month}", response_model=schemas.MonthlyStats)
def get_monthly_stats(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """获取月度统计"""
    return crud.get_monthly_stats(db, current_user.id, year, month)


# ========== 类别 API ==========

@app.get("/api/categories", response_model=List[schemas.CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """获取类别列表"""
    return crud.get_categories(db)


# ========== OCR API ==========

@app.post("/api/ocr/receipt", response_model=schemas.AIParseResponse)
async def parse_receipt(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    """
    OCR 识别购物小票/订单截图
    使用多模态 AI 模型（qwen-vl 或 gpt-4o）直接解析图片
    """
    import base64
    
    # 读取图片内容
    content = await file.read()
    
    # 检查文件类型
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="只支持图片文件")
    
    # 检查文件大小（限制 5MB）
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过 5MB")
    
    # 转换为 base64
    image_base64 = base64.b64encode(content).decode('utf-8')
    
    # 调用 AI 解析图片
    result = parse_receipt_image(image_base64, file.filename)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return schemas.AIParseResponse(
        date=result["date"],
        amount=result["amount"],
        category=result["category"],
        category_full=result.get("category_full", ""),
        detail=result.get("detail", ""),
        payment_method=result.get("payment_method", "other"),
        merchant=result.get("merchant"),
        raw_input=result["raw_input"]
    )


# ========== 导出 API ==========

@app.get("/api/export/csv")
def export_csv(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """导出 CSV"""
    import csv
    import io
    
    # 解析日期字符串为 date 对象
    start = datetime.fromisoformat(start_date).date() if start_date else None
    end = datetime.fromisoformat(end_date).date() if end_date else None
    
    expenses = crud.get_expenses(
        db,
        user_id=current_user.id,
        skip=0,
        limit=10000,
        start_date=start,
        end_date=end
    )
    
    output = io.StringIO()
    # 写入 UTF-8 BOM，确保 Excel 正确识别中文
    output.write('\ufeff')
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


# ========== 预算 API ==========

@app.get("/api/budget/{year}/{month}", response_model=schemas.BudgetStatus)
def get_budget_status(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """获取预算执行情况"""
    return crud.get_budget_status(db, current_user.id, year, month)


@app.post("/api/budget", response_model=schemas.BudgetResponse)
def set_budget(
    budget: schemas.BudgetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """设置预算"""
    return crud.create_or_update_budget(db, current_user.id, budget)


# ========== 导入 API ==========

class ImportRequest(BaseModel):
    csv_content: str
    field_mapping: dict


@app.post("/api/import/csv")
def import_csv(
    request: ImportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """从 CSV 导入数据"""
    import csv
    import io
    from datetime import datetime
    
    results = {"success": 0, "failed": 0, "errors": []}
    
    try:
        # 处理 UTF-8 BOM
        content = request.csv_content.lstrip('\ufeff')
        reader = csv.DictReader(io.StringIO(content))
        
        mapping = request.field_mapping
        
        for idx, row in enumerate(reader, start=2):  # 从第2行开始（第1行是表头）
            try:
                # 获取映射的字段值
                date_str = row.get(mapping.get('date', ''), '').strip()
                amount_str = row.get(mapping.get('amount', ''), '').strip()
                category = row.get(mapping.get('category', ''), '').strip()
                detail = row.get(mapping.get('detail', ''), '').strip()
                payment_method = row.get(mapping.get('payment_method', ''), '').strip()
                merchant = row.get(mapping.get('merchant', ''), '').strip()
                
                # 验证必填字段
                if not date_str or not amount_str or not category:
                    results["failed"] += 1
                    results["errors"].append(f"第 {idx} 行: 缺少必填字段")
                    continue
                
                # 解析日期
                date_parsed = None
                for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']:
                    try:
                        date_parsed = datetime.strptime(date_str.split()[0], fmt)
                        break
                    except ValueError:
                        continue
                
                if not date_parsed:
                    results["failed"] += 1
                    results["errors"].append(f"第 {idx} 行: 日期格式错误 '{date_str}'")
                    continue
                
                # 解析金额
                amount_str_clean = amount_str.replace(',', '').replace('¥', '').replace('$', '').strip()
                try:
                    amount = float(amount_str_clean)
                except ValueError:
                    results["failed"] += 1
                    results["errors"].append(f"第 {idx} 行: 金额格式错误 '{amount_str}'")
                    continue
                
                # 查找或创建类别
                category_obj = crud.get_category_by_name(db, category)
                if not category_obj:
                    # 使用默认类别映射
                    category_mapping = {
                        '餐饮': 'food', '食物': 'food', '吃饭': 'food',
                        '交通': 'transport', '出行': 'transport',
                        '购物': 'shopping', '买东西': 'shopping',
                        '居住': 'living', '房租': 'living', '住宿': 'living',
                        '医疗': 'medical', '医药': 'medical', '看病': 'medical',
                        '娱乐': 'entertainment', '休闲': 'entertainment',
                        '收入': 'income', '工资': 'income',
                    }
                    category_key = category_mapping.get(category, 'other')
                    category_obj = crud.get_category_by_name(db, category_key)
                
                category_key = category_obj.name if category_obj else 'other'
                category_full = category_obj.name_full if category_obj else category
                
                # 标准化支付方式
                payment_map = {
                    'cash': 'cash', '现金': 'cash',
                    'wechat': 'wechat', '微信': 'wechat', '微信支付': 'wechat',
                    'alipay': 'alipay', '支付宝': 'alipay',
                    'card': 'card', '银行卡': 'card', '信用卡': 'card', '借记卡': 'card',
                }
                payment_key = payment_map.get(payment_method.lower() if payment_method else '', 'other') if payment_method else 'other'
                
                # 创建支出记录
                expense_data = schemas.ExpenseCreate(
                    date=date_parsed,
                    amount=abs(amount),
                    category=category_key,
                    category_full=category_full,
                    detail=detail or None,
                    payment_method=payment_key,
                    merchant=merchant or None,
                    source_type='import',
                    raw_input=f"CSV导入: {row}",
                )
                
                crud.create_expense(db, expense_data, current_user.id)
                results["success"] += 1
                
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"第 {idx} 行: {str(e)}")
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV解析失败: {str(e)}")
    
    return results


# ========== 月度概览 API ==========

@app.get("/api/summary/current")
def get_current_month_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """获取当前月度概览"""
    now = datetime.now()
    start_date = date(now.year, now.month, 1)
    # 下月第一天
    if now.month == 12:
        end_date = date(now.year + 1, 1, 1)
    else:
        end_date = date(now.year, now.month + 1, 1)
    
    # 查询本月支出
    expenses = crud.get_expenses(
        db,
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        limit=10000
    )
    
    total_amount = sum(e.amount for e in expenses)
    count = len(expenses)
    
    # 计算日均支出
    days_passed = now.day
    daily_avg = total_amount / days_passed if days_passed > 0 else 0
    
    # 与上月对比
    if now.month == 1:
        last_month_start = date(now.year - 1, 12, 1)
        last_month_end = date(now.year, 1, 1)
    else:
        last_month_start = date(now.year, now.month - 1, 1)
        last_month_end = date(now.year, now.month, 1)
    
    last_month_expenses = crud.get_expenses(
        db,
        user_id=current_user.id,
        start_date=last_month_start,
        end_date=last_month_end,
        limit=10000
    )
    last_month_total = sum(e.amount for e in last_month_expenses)
    
    month_over_month = 0
    if last_month_total > 0:
        month_over_month = ((total_amount - last_month_total) / last_month_total) * 100
    
    return {
        "year": now.year,
        "month": now.month,
        "total_amount": total_amount,
        "count": count,
        "daily_avg": daily_avg,
        "last_month_total": last_month_total,
        "month_over_month_change": round(month_over_month, 1),
    }


# ========== 智能分析 API ==========

@app.get("/api/analysis/smart")
def get_smart_analysis(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """获取智能分析报告"""
    now = datetime.now()
    
    # 获取最近30天的支出
    last_30_days_start = now - __import__('datetime').timedelta(days=30)
    recent_expenses = crud.get_expenses(
        db,
        user_id=current_user.id,
        start_date=last_30_days_start.date(),
        end_date=now.date(),
        limit=10000
    )
    
    if not recent_expenses:
        return {
            "abnormal_expenses": [],
            "recurring_expenses": [],
            "suggestions": [],
            "category_analysis": []
        }
    
    # 1. 异常支出检测（超过日均3倍或单笔超过500元）
    daily_totals = {}
    for e in recent_expenses:
        day = e.date.strftime("%Y-%m-%d")
        daily_totals[day] = daily_totals.get(day, 0) + e.amount
    
    avg_daily = sum(daily_totals.values()) / len(daily_totals) if daily_totals else 0
    
    abnormal_expenses = []
    for day, total in daily_totals.items():
        if total > avg_daily * 3 and total > 100:
            abnormal_expenses.append({
                "date": day,
                "amount": total,
                "reason": f"当日支出 ¥{total:.2f}，超过日均 ¥{avg_daily:.2f} 的 3 倍"
            })
    
    # 单笔大额支出
    for e in recent_expenses:
        if e.amount >= 500:
            abnormal_expenses.append({
                "date": e.date.strftime("%Y-%m-%d"),
                "amount": e.amount,
                "category": e.category_full or e.category,
                "detail": e.detail,
                "reason": f"单笔大额支出"
            })
    
    # 去重并排序
    seen = set()
    abnormal_expenses_unique = []
    for item in abnormal_expenses:
        key = (item["date"], item["amount"])
        if key not in seen:
            seen.add(key)
            abnormal_expenses_unique.append(item)
    abnormal_expenses = sorted(abnormal_expenses_unique, key=lambda x: x["amount"], reverse=True)[:5]
    
    # 2. 重复支出识别（相同商户或详情，每月出现）
    from collections import Counter
    
    merchant_counts = Counter([e.merchant for e in recent_expenses if e.merchant])
    detail_counts = Counter([e.detail for e in recent_expenses if e.detail])
    
    recurring_expenses = []
    
    # 识别可能的订阅/固定支出
    for merchant, count in merchant_counts.most_common(5):
        if count >= 2:
            amounts = [e.amount for e in recent_expenses if e.merchant == merchant]
            avg_amount = sum(amounts) / len(amounts)
            recurring_expenses.append({
                "type": "merchant",
                "name": merchant,
                "count": count,
                "avg_amount": round(avg_amount, 2),
                "suggestion": f"可能是固定支出，月均约 ¥{avg_amount:.2f}"
            })
    
    # 3. 消费建议
    suggestions = []
    
    # 按类别统计
    category_totals = {}
    for e in recent_expenses:
        cat = e.category_full or e.category
        if cat not in category_totals:
            category_totals[cat] = {"total": 0, "count": 0}
        category_totals[cat]["total"] += e.amount
        category_totals[cat]["count"] += 1
    
    # 找出消费最多的类别
    if category_totals:
        top_category = max(category_totals.items(), key=lambda x: x[1]["total"])
        suggestions.append({
            "type": "top_category",
            "message": f"最近30天「{top_category[0]}」支出最多，共 ¥{top_category[1]['total']:.2f}",
            "suggestion": "建议关注该类别的消费情况"
        })
    
    # 日均消费建议
    total_30d = sum(e.amount for e in recent_expenses)
    daily_avg_30d = total_30d / 30
    if daily_avg_30d > 100:
        suggestions.append({
            "type": "daily_avg",
            "message": f"近30天日均支出 ¥{daily_avg_30d:.2f}",
            "suggestion": "日均消费较高，建议适当控制非必要支出"
        })
    elif daily_avg_30d < 30:
        suggestions.append({
            "type": "daily_avg",
            "message": f"近30天日均支出 ¥{daily_avg_30d:.2f}",
            "suggestion": "消费控制很好，继续保持！"
        })
    
    # 4. 类别分析
    category_analysis = []
    for cat, data in sorted(category_totals.items(), key=lambda x: x[1]["total"], reverse=True):
        category_analysis.append({
            "category": cat,
            "total": data["total"],
            "count": data["count"],
            "avg_per_transaction": round(data["total"] / data["count"], 2) if data["count"] > 0 else 0
        })
    
    return {
        "abnormal_expenses": abnormal_expenses,
        "recurring_expenses": recurring_expenses,
        "suggestions": suggestions,
        "category_analysis": category_analysis[:5],
        "summary": {
            "total_30d": total_30d,
            "daily_avg_30d": round(daily_avg_30d, 2),
            "transaction_count": len(recent_expenses)
        }
    }


# ========== 健康检查 ==========

@app.get("/api/health")
def health_check():
    """健康检查"""
    return {"status": "ok", "time": datetime.now().isoformat()}