import { useState, useRef } from 'react'
import axios from 'axios'

interface ParseResult {
  date: string
  amount: number
  category: string
  category_full: string
  detail: string
  payment_method: string
  merchant: string | null
  raw_input: string
}

interface ExpenseInputProps {
  onSuccess?: () => void
}

export default function ExpenseInput({ onSuccess }: ExpenseInputProps) {
  const [text, setText] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 文本解析
  const handleTextSubmit = async () => {
    if (!text.trim()) return
    
    setLoading(true)
    setError(null)
    
    try {
      const { data } = await axios.post('/api/expenses/parse', {
        input: text
      })
      setResult(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || '解析失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 图片上传预览
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  // 确认保存
  const handleConfirm = async () => {
    if (!result) return
    
    setLoading(true)
    try {
      await axios.post('/api/expenses', {
        date: result.date,
        amount: result.amount,
        category: result.category,
        category_full: result.category_full,
        detail: result.detail,
        payment_method: result.payment_method,
        merchant: result.merchant,
        raw_input: result.raw_input,
        source_type: 'text'
      })
      
      // 重置状态
      setText('')
      setResult(null)
      setError(null)
      onSuccess?.()
    } catch (err: any) {
      setError(err.response?.data?.detail || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  // 取消/重置
  const handleCancel = () => {
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setImage(null)
    setPreview(null)
  }

  return (
    <div className="space-y-4">
      {/* 文本输入 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
          placeholder="花了20买了一斤肉"
          className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleTextSubmit}
          disabled={loading || !text.trim()}
          className="px-4 py-3 bg-blue-500 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          解析
        </button>
      </div>

      {/* 图片上传按钮 */}
      <div className="flex gap-2">
        <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
          <span>📷</span>
          <span className="text-sm text-gray-600">上传小票</span>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleImageSelect}
            hidden
            accept="image/*"
          />
        </label>
        
        {image && (
          <span className="flex items-center text-sm text-gray-500 py-2">
            {image.name}
          </span>
        )}
      </div>

      {/* 图片预览 */}
      {preview && (
        <div className="relative inline-block">
          <img 
            src={preview} 
            alt="预览" 
            className="max-h-32 rounded-lg border"
          />
          <button
            onClick={handleCancel}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin text-2xl">⏳</div>
          <div className="text-gray-500 text-sm mt-1">AI 解析中...</div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 解析结果 */}
      {result && !loading && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-green-600 text-lg">✓</span>
            <span className="font-medium text-green-700">已识别</span>
            <span className="text-2xl ml-auto">
              {getCategoryEmoji(result.category)}
            </span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">类别</span>
              <span className="font-medium">{result.category_full}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">金额</span>
              <span className="font-medium text-red-600">¥{result.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">详情</span>
              <span className="font-medium">{result.detail || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">日期</span>
              <span className="font-medium">{result.date}</span>
            </div>
            {result.merchant && (
              <div className="flex justify-between">
                <span className="text-gray-500">商户</span>
                <span className="font-medium">{result.merchant}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600"
            >
              确认保存
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              修改
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// 类别 emoji 映射
function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    food: '🍔',
    transport: '🚌',
    shopping: '🛒',
    living: '🏠',
    medical: '💊',
    entertainment: '🎬',
    income: '💰',
    other: '📦'
  }
  return emojiMap[category] || '📦'
}