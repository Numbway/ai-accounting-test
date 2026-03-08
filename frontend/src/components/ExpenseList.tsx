import { useState, useEffect } from 'react'
import axios from 'axios'
import dayjs from 'dayjs'
import ExpenseItem from './ExpenseItem'

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

export default function ExpenseList() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  useEffect(() => {
    loadExpenses()
  }, [page])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get('/api/expenses', {
        params: { skip: page * 20, limit: 20 }
      })
      setExpenses(data)
    } catch (err) {
      console.error('加载失败', err)
    } finally {
      setLoading(false)
    }
  }

  // 按日期分组
  const groupedExpenses = expenses.reduce((groups: Record<string, Expense[]>, expense) => {
    const date = dayjs(expense.date).format('YYYY-MM-DD')
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(expense)
    return groups
  }, {})

  // 获取今天的日期字符串
  const today = dayjs().format('YYYY-MM-DD')
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')

  const getDateLabel = (dateStr: string) => {
    if (dateStr === today) return '今天'
    if (dateStr === yesterday) return '昨天'
    return dayjs(dateStr).format('MM月DD日')
  }

  if (loading && page === 0) {
    return (
      <div className="text-center py-8">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center text-gray-500">
        <div className="text-2xl mb-2">📋</div>
        <div>暂无记录</div>
        <div className="text-sm mt-1">开始记下你的第一笔支出吧</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedExpenses).map(([date, items]) => (
        <div key={date}>
          <div className="text-sm text-gray-500 mb-2 px-1">
            📅 {getDateLabel(date)}
          </div>
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">
            {items.map((expense, idx) => (
              <div 
                key={expense.id}
                className={idx !== items.length - 1 ? 'border-b border-gray-100' : ''}
              >
                <ExpenseItem expense={expense} onUpdate={loadExpenses} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 分页加载 */}
      {expenses.length >= 20 && (
        <button
          onClick={() => setPage(p => p + 1)}
          className="w-full py-3 text-center text-blue-500 text-sm"
        >
          加载更多
        </button>
      )}
    </div>
  )
}