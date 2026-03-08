import os
import json
import base64
import logging
from datetime import datetime, date
from typing import Optional
from openai import OpenAI

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========== API 配置 ==========
AI_PROVIDER = os.getenv("AI_PROVIDER", "openai").lower()

if AI_PROVIDER == "aliyun":
    client = OpenAI(
        api_key=os.getenv("DASHSCOPE_API_KEY", ""),
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
    )
    # Qwen-VL 支持图片的多模态模型
    DEFAULT_MODEL = os.getenv("AI_MODEL", "qwen-vl-plus")
    DEFAULT_VL_MODEL = "qwen-vl-plus"
elif AI_PROVIDER == "deepseek":
    client = OpenAI(
        api_key=os.getenv("DEEPSEEK_API_KEY", ""),
        base_url="https://api.deepseek.com/v1"
    )
    DEFAULT_MODEL = os.getenv("AI_MODEL", "deepseek-chat")
    DEFAULT_VL_MODEL = "deepseek-chat"
else:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
    DEFAULT_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
    DEFAULT_VL_MODEL = "gpt-4o"

logger.info(f"AI Provider: {AI_PROVIDER}, Model: {DEFAULT_MODEL}, VL Model: {DEFAULT_VL_MODEL}")


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


IMAGE_PARSE_SYSTEM_PROMPT = """你是一个专业的购物小票和订单解析助手。请从图片中提取消费信息。

请分析图片内容，提取以下信息并以JSON格式返回：
- date: 消费日期（YYYY-MM-DD格式，如果图片中没有日期，默认今天）
- amount: 金额（数字，单位人民币，只保留数字）
- category: 消费类别（只能是以下之一：food/transport/shopping/living/medical/entertainment/income/other）
- category_full: 详细类别名称（餐饮/交通/购物/居住/医疗/娱乐/收入/其他）
- detail: 商品/服务详情描述（如：毛巾、午餐、地铁等）
- payment_method: 支付方式（cash/wechat/alipay/card/other，根据图片判断）
- merchant: 商户/店铺名称（如果没有则返回null）

注意：
1. 仔细识别图片中的金额数字
2. 根据商品类型判断类别（日用品->shopping, 食品->food等）
3. 如果图片是淘宝/京东/外卖订单，提取实付金额
4. 请直接返回JSON，不要有其他文字"""


def parse_expense_text(user_input: str) -> dict:
    """解析自然语言输入"""
    today = date.today().isoformat()
    
    logger.info(f"Parsing text input: {user_input}")
    
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
        
        result["raw_input"] = user_input
        result["source_type"] = "text"
        
        return result
        
    except Exception as e:
        logger.error(f"Parse error: {str(e)}", exc_info=True)
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


def parse_receipt_image(image_base64: str, filename: str = "image.jpg") -> dict:
    """
    解析购物小票/订单截图图片
    使用多模态模型（qwen-vl 或 gpt-4o）
    """
    today = date.today().isoformat()
    
    logger.info(f"Parsing image: {filename}")
    
    try:
        # 构建多模态消息
        messages = [
            {
                "role": "system",
                "content": IMAGE_PARSE_SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"今天日期是 {today}。请分析这张购物订单图片，提取消费信息。"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}"
                        }
                    }
                ]
            }
        ]
        
        response = client.chat.completions.create(
            model=DEFAULT_VL_MODEL,
            messages=messages,
            temperature=0,
            max_tokens=1000
        )
        
        content = response.choices[0].message.content
        logger.info(f"AI vision response: {content}")
        
        # 提取 JSON 部分
        import re
        json_match = re.search(r'\{[^}]*\}', content)
        if json_match:
            result = json.loads(json_match.group())
        else:
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
        
        result["raw_input"] = f"[图片: {filename}]"
        result["source_type"] = "image"
        
        logger.info(f"Parsed result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Image parse error: {str(e)}", exc_info=True)
        return {
            "error": str(e),
            "date": today,
            "amount": 0,
            "category": "other",
            "category_full": "其他",
            "detail": "图片解析失败",
            "payment_method": "other",
            "merchant": None,
            "raw_input": f"[图片: {filename}]",
            "source_type": "image"
        }


def encode_image_to_base64(image_path: str) -> str:
    """将图片文件编码为 base64"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')


# ========== 测试函数 ==========
if __name__ == "__main__":
    # 测试文本解析
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
    
    # 测试图片解析（如果提供了图片路径）
    import sys
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        print(f"\n解析图片: {image_path}")
        image_base64 = encode_image_to_base64(image_path)
        result = parse_receipt_image(image_base64, image_path)
        print(f"输出: {json.dumps(result, ensure_ascii=False, indent=2)}")