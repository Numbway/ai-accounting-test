import { useState, useRef } from 'react'
import api from '../lib/axios'

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
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text')
  const [recordType, setRecordType] = useState<'expense' | 'income'>('expense')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 切换输入模式
  const switchMode = (mode: 'text' | 'image') => {
    console.log('Switching to mode:', mode)
    setInputMode(mode)
    setResult(null)
    setError(null)
    if (mode === 'text') {
      setImage(null)
      setPreview(null)
    }
  }

  // 切换记录类型
  const switchRecordType = (type: 'expense' | 'income') => {
    setRecordType(type)
    setResult(null)
    setError(null)
  }

  // 文本解析
  const handleTextSubmit = async () => {
    if (!text.trim()) return
    
    setLoading(true)
    setError(null)
    
    try {
      // 根据收入/支出类型添加前缀提示
      const inputWithType = recordType === 'income' 
        ? `[收入] ${text}` 
        : `[支出] ${text}`
      
      const { data } = await api.post('/api/expenses/parse', {
        input: inputWithType
      })
      
      // 如果是收入类型，强制设置类别为 income
      if (recordType === 'income') {
        data.category = 'income'
        data.category_full = '收入'
      }
      
      setResult(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || '解析失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 图片选择
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log('Selected file:', file.name, file.type, file.size)

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }

    // 检查文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB')
      return
    }

    setImage(file)
    setPreview(URL.createObjectURL(file))
    setError(null)
    
    // 自动开始解析
    await parseImage(file)
  }

  // 解析图片
  const parseImage = async (file: File) => {
    setLoading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      console.log('Sending image to API...')
      const { data } = await api.post('/api/ocr/receipt', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      console.log('API response:', data)
      
      // 如果是收入类型，强制设置类别为 income
      if (recordType === 'income') {
        data.category = 'income'
        data.category_full = '收入'
      }
      
      setResult(data)
    } catch (err: any) {
      console.error('Parse error:', err)
      setError(err.response?.data?.detail || '图片解析失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 确认保存
  const handleConfirm = async () => {
    if (!result) return
    
    setLoading(true)
    try {
      // 转换日期为 ISO 格式
      const dateObj = new Date(result.date)
      const isoDate = dateObj.toISOString()
      
      await api.post('/api/expenses', {
        date: isoDate,
        amount: result.amount,
        category: result.category,
        category_full: result.category_full,
        detail: result.detail,
        payment_method: result.payment_method,
        merchant: result.merchant,
        raw_input: result.raw_input,
        source_type: 'image'
      })
      
      // 重置状态
      resetForm()
      onSuccess?.()
    } catch (err: any) {
      setError(err.response?.data?.detail || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  // 重置表单
  const resetForm = () => {
    setText('')
    setResult(null)
    setError(null)
    setImage(null)
    setPreview(null)
    setInputMode('text')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  console.log('Current inputMode:', inputMode)

  return (
    <div className="space-y-4">
      {/* 收入/支出切换 */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => switchRecordType('expense')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
            recordType === 'expense'
              ? 'bg-white text-red-500 shadow-sm'
              : 'text-gray-600'
          }`}
        >
          💸 支出
        </button>
        <button
          type="button"
          onClick={() => switchRecordType('income')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
            recordType === 'income'
              ? 'bg-white text-green-500 shadow-sm'
              : 'text-gray-600'
          }`}
        >
          💰 收入
        </button>
      </div>

      {/* 输入方式切换 */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => switchMode('text')}
          style={{
            flex: 1,
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: inputMode === 'text' ? '#fff' : 'transparent',
            color: inputMode === 'text' ? '#2563eb' : '#4b5563',
            boxShadow: inputMode === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          ✏️ 文字输入
        </button>
        <button
          type="button"
          onClick={() => switchMode('image')}
          style={{
            flex: 1,
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: inputMode === 'image' ? '#fff' : 'transparent',
            color: inputMode === 'image' ? '#2563eb' : '#4b5563',
            boxShadow: inputMode === 'image' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          📷 拍照识别
        </button>
      </div>

      {/* 文字输入模式 */}
      {inputMode === 'text' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
            placeholder={recordType === 'expense' ? "花了20买了一斤肉" : "工资收入5000元"}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleTextSubmit}
            disabled={loading || !text.trim()}
            className={`px-4 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed ${
              recordType === 'income' ? 'bg-green-500' : 'bg-blue-500'
            }`}
          >
            解析
          </button>
        </div>
      )}

      {/* 图片输入模式 */}
      {inputMode === 'image' && (
        <div className="space-y-3">
          <label 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '24px',
              border: '2px dashed #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '30px' }}>📷</span>
            <span style={{ color: '#4b5563' }}>点击上传购物小票或订单截图</span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>支持 JPG、PNG 格式，最大 5MB</span>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
              accept="image/*"
            />
          </label>
        </div>
      )}

      {/* 图片预览 */}
      {preview && (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          <img 
            src={preview} 
            alt="预览" 
            style={{ maxHeight: '200px', margin: '0 auto', display: 'block', borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <button
            type="button"
            onClick={resetForm}
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              width: '32px',
              height: '32px',
              backgroundColor: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin text-2xl">⏳</div>
          <div className="text-gray-500 text-sm mt-1">
            {inputMode === 'image' ? 'AI 正在识别图片...' : 'AI 解析中...'}
          </div>
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
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600"
            >
              确认保存
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              重新识别
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