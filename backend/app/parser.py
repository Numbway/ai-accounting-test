import os
import json
import logging
from datetime import datetime, date
from typing import Optional
from openai import OpenAI

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========== API 配置 ==========
# 支持多种模型提供商
AI_PROVIDER = os.getenv("AI_PROVIDER", "openai").lower()  # openai, aliyun, deepseek

if AI_PROVIDER == "aliyun":
    # 阿里云百炼 API
    client = OpenAI(
        api_key=os.getenv("DASHSCOPE_API_KEY", ""),
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
    )
    DEFAULT_MODEL = os.getenv("AI_MODEL", "qwen-turbo")
elif AI_PROVIDER == "deepseek":
    # DeepSeek API
    client = OpenAI(
        api_key=os.getenv("DEEPSEEK_API_KEY", ""),
        base_url="https://api.deepseek.com/v1"
    )
    DEFAULT_MODEL = os.getenv("AI_MODEL", "deepseek-chat")
else:
    # OpenAI 默认
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
    DEFAULT_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")

logger.info(f"AI Provider: {AI_PROVIDER}, Model: {DEFAULT_MODEL}")


# ========== 默认类别映射 ==========
CATEGORY_MAP = {
    "food": "餐饮",
    "transport": "交通", 
    "shopping": "购物",
    "living": "居住",
    "medical": "医疗",
    "entertainment": "娱乐",
    "income": "收入",
    "other": "其他"
}


# ========== 系统提示词 ==========
EXPENSE_PARSE_SYSTEM_PROMPT = """你是一个专业的记账助手。请从用户输入中提取消费记录信息。

请从以下输入中提取信息并以JSON格式返回：
- date: 消费日期（YYYY-MM-DD格式，如果输入没有指定日期，默认今天）
- amount: 金额（数字，单位人民币，只保留数字）
- category: 消费类别（只能是以下之一：food/transport/shopping/living/medical/entertainment/income/other）
- category_full: 详细类别名称（餐饮/交通/购物/居住/医疗/娱乐/收入/其他）
- detail: 具体消费内容描述
- payment_method: 支付方式（cash/wechat/alipay/card/other）
- merchant: 商户名称（如果没有则返回null）

请直接返回JSON，不要有其他文字。"""


def parse_expense_text(user_input: str) -> dict:
    """
    解析自然语言输入
    例如: "花了20买了一斤肉" -> {date, amount, category, category_full, detail, payment_method, merchant}
    """
    today = date.today().isoformat()
    
    logger.info(f"Parsing input: {user_input}")
    logger.info(f"Using model: {DEFAULT_MODEL}, provider: {AI_PROVIDER}")
    
    try:
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": EXPENSE_PARSE_SYSTEM_PROMPT},
                {"role": "user", "content": f"今天日期是 {today}。用户输入：{user_input}"}
            ],
            temperature=0,
            max_tokens=500
        )
        
        content = response.choices[0].message.content
        logger.info(f"AI response: {content}")
        
        result = json.loads(content)
        
        # 确保必要的字段有值
        if "date" not in result:
            result["date"] = today
        if "payment_method" not in result:
            result["payment_method"] = "other"
        if "merchant" not in result:
            result["merchant"] = None
        
        # 映射 category_full
        if "category_full" not in result and "category" in result:
            result["category_full"] = CATEGORY_MAP.get(result["category"], "其他")
        
        # 添加原始输入
        result["raw_input"] = user_input
        result["source_type"] = "text"
        
        logger.info(f"Parsed result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Parse error: {str(e)}", exc_info=True)
        # 如果 API 调用失败，返回错误信息
        return {
            "error": str(e),
            "date": today,
            "amount": 0,
            "category": "other",
            "category_full": "其他",
            "detail": "解析失败",
            "payment_method": "other",
            "merchant": None,
            "raw_input": user_input,
            "source_type": "text"
        }


def parse_receipt_image(image_base64: str) -> dict:
    """
    解析购物小票图片（需要结合OCR）
    这里预留接口，实际需要先调用 OCR 服务提取文字
    """
    # TODO: 实现 OCR + AI 组合解析
    # 1. 调用 OCR API 提取图片文字
    # 2. 调用 AI 解析提取的信息
    
    return {
        "date": date.today().isoformat(),
        "amount": 0,
        "category": "other",
        "category_full": "其他",
        "detail": "图片解析功能待开发",
        "payment_method": "other",
        "merchant": None,
        "raw_input": "[图片]",
        "source_type": "image"
    }


# ========== 测试函数 ==========
if __name__ == "__main__":
    # 测试解析
    test_cases = [
        "花了20买了一斤肉",
        "中午吃饭用了35",
        "地铁上班花了4块",
        "买衣服花了200"
    ]
    
    for text in test_cases:
        print(f"\n输入: {text}")
        result = parse_expense_text(text)
        print(f"输出: {json.dumps(result, ensure_ascii=False, indent=2)}")