import { useState, useEffect } from 'react'
import axios from 'axios'

interface BudgetStatus {
  year: number
  month: number
  budget_amount: number
  spent_amount: number
  remaining_amount: number
  percentage: number
  is_over_budget: boolean
}

export default function BudgetSetting() {
  const [budget, setBudget] = useState(3000)
  const [status, setStatus] = useState<BudgetStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    loadBudgetStatus()
  }, [year, month])

  const loadBudgetStatus = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`/api/budget/${year}/${month}`)
      setStatus(data)
      if (data.budget_amount > 0) {
        setBudget(data.budget_amount)
      }
    } catch (err) {
      console.error('加载预算失败', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    
    try {
      await axios.post('/api/budget', {
        year,
        month,
        amount: budget
      })
      setSuccess(true)
      loadBudgetStatus()
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      setError(err.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="font-semibold mb-4">💰 预算设置</h3>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm mb-4">
          ✅ 保存成功
        </div>
      )}
      
      {/* 月份选择 */}
      <div className="flex gap-2 mb-4">
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
        >
          {[2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}月</option>
          ))}
        </select>
      </div>
      
      {/* 预算金额 */}
      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">
          月度预算（元）
        </label>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          placeholder="3000"
        />
      </div>
      
      {/* 预算进度 */}
      {status && status.budget_amount > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">已支出</span>
            <span className={status.is_over_budget ? 'text-red-600' : 'text-gray-800'}>
              ¥{status.spent_amount.toFixed(2)} / ¥{status.budget_amount.toFixed(2)}
            </span>
          </div>
          
          {/* 进度条 */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                status.is_over_budget ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(status.percentage, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs mt-2">
            <span className="text-gray-500">{status.percentage.toFixed(1)}%</span>
            <span className={status.is_over_budget ? 'text-red-600' : 'text-green-600'}>
              {status.is_over_budget 
                ? `超支 ¥${(status.spent_amount - status.budget_amount).toFixed(2)}` 
                : `剩余 ¥${status.remaining_amount.toFixed(2)}`}
            </span>
          </div>
        </div>
      )}
      
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium disabled:bg-gray-300"
      >
        {saving ? '保存中...' : '保存预算'}
      </button>
    </div>
  )
}