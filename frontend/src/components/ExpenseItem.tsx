import { useState } from 'react'
import axios from 'axios'
import CategoryIcon, { getCategoryName } from './CategoryIcon'

interface Expense {
  id: string
  date: string
  amount: number
  category: string
  category_full: string
  detail: string
  payment_method: string
  merchant: string | null
  notes: string | null
}

interface ExpenseItemProps {
  expense: Expense
  onUpdate: () => void
}

const CATEGORIES = [
  { value: 'food', label: '餐饮' },
  { value: 'transport', label: '交通' },
  { value: 'shopping', label: '购物' },
  { value: 'living', label: '居住' },
  { value: 'medical', label: '医疗' },
  { value: 'entertainment', label: '娱乐' },
  { value: 'income', label: '收入' },
  { value: 'other', label: '其他' },
]

export default function ExpenseItem({ expense, onUpdate }: ExpenseItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 编辑表单状态
  const [formData, setFormData] = useState({
    amount: expense.amount,
    category: expense.category,
    detail: expense.detail || '',
    date: expense.date.split('T')[0],
    merchant: expense.merchant || '',
    notes: expense.notes || '',
  })

  // 保存编辑
  const handleSave = async () => {
    setLoading(true)
    setError(null)
    
    try {
      await axios.put(`/api/expenses/${expense.id}`, {
        amount: parseFloat(formData.amount.toString()),
        category: formData.category,
        detail: formData.detail,
        date: new Date(formData.date).toISOString(),
        merchant: formData.merchant || null,
        notes: formData.notes || null,
      })
      
      setIsEditing(false)
      onUpdate()
    } catch (err: any) {
      setError(err.response?.data?.detail || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除记录
  const handleDelete = async () => {
    setLoading(true)
    
    try {
      await axios.delete(`/api/expenses/${expense.id}`)
      setIsDeleting(false)
      onUpdate()
    } catch (err: any) {
      setError(err.response?.data?.detail || '删除失败')
    } finally {
      setLoading(false)
    }
  }

  // 编辑模式
  if (isEditing) {
    return (
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3">编辑支出</h4>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-2 rounded text-sm mb-3">
            {error}
          </div>
        )}
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">金额</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">类别</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">详情</label>
            <input
              type="text"
              value={formData.detail}
              onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">日期</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">商户</label>
            <input
              type="text"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="可选"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">备注</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="可选"
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-medium disabled:bg-gray-300"
          >
            {loading ? '保存中...' : '保存'}
          </button>
          <button
            onClick={() => setIsEditing(false)}
            disabled={loading}
            className="flex-1 py-2 border border-gray-300 rounded-lg font-medium"
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  // 删除确认模式
  if (isDeleting) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <p className="text-red-700 mb-3">确定要删除这条记录吗？</p>
        <p className="text-sm text-gray-600 mb-4">
          {expense.detail || expense.category_full} - ¥{expense.amount.toFixed(2)}
        </p>
        
        {error && (
          <div className="bg-red-100 text-red-600 p-2 rounded text-sm mb-3">
            {error}
          </div>
        )}
        
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium disabled:bg-gray-300"
          >
            {loading ? '删除中...' : '确认删除'}
          </button>
          <button
            onClick={() => setIsDeleting(false)}
            disabled={loading}
            className="flex-1 py-2 border border-gray-300 rounded-lg font-medium"
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  // 正常显示模式
  return (
    <div className="flex items-center gap-3 p-4 group">
      <CategoryIcon category={expense.category} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {expense.detail || expense.category_full}
        </div>
        {expense.merchant && (
          <div className="text-sm text-gray-500">{expense.merchant}</div>
        )}
        <div className="text-xs text-gray-400">
          {expense.date.split('T')[0]}
        </div>
      </div>
      <div className="text-red-600 font-medium">
        -¥{expense.amount.toFixed(2)}
      </div>
      
      {/* 操作按钮 */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsEditing(true)}
          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
          title="编辑"
        >
          ✏️
        </button>
        <button
          onClick={() => setIsDeleting(true)}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
          title="删除"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}