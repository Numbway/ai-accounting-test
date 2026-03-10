import { useState, useEffect, useCallback } from 'react'
import api from '../lib/axios'
import dayjs from 'dayjs'
import ExpenseItem from './ExpenseItem'
import ExpenseSearch, { SearchFilters } from './ExpenseSearch'

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
  const [searchFilters, setSearchFilters] = useState<SearchFilters | null>(null)

  useEffect(() => {
    loadExpenses()
  }, [page])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/expenses', {
        params: { skip: page * 20, limit: 20 }
      })
      setExpenses(data)
    } catch (err) {
      console.error('加载失败', err)
    } finally {
      setLoading(false)
    }
  }

  // 搜索筛选
  const handleSearch = useCallback(async (filters: SearchFilters) => {
    setLoading(true)
    setSearchFilters(filters)
    setPage(0)
    
    try {
      const params: Record<string, any> = { skip: 0, limit: 100 }
      
      if (filters.startDate) {
        params.start_date = new Date(filters.startDate).toISOString()
      }
      if (filters.endDate) {
        params.end_date = new Date(filters.endDate).toISOString()
      }
      if (filters.category) {
        params.category = filters.category
      }
      
      const { data } = await api.get('/api/expenses', { params })
      
      // 客户端筛选：关键词、金额范围
      let filtered = data
      
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase()
        filtered = filtered.filter((e: Expense) => 
          (e.detail && e.detail.toLowerCase().includes(keyword)) ||
          (e.merchant && e.merchant.toLowerCase().includes(keyword)) ||
          (e.category_full && e.category_full.toLowerCase().includes(keyword))
        )
      }
      
      if (filters.minAmount) {
        const min = parseFloat(filters.minAmount)
        filtered = filtered.filter((e: Expense) => e.amount >= min)
      }
      
      if (filters.maxAmount) {
        const max = parseFloat(filters.maxAmount)
        filtered = filtered.filter((e: Expense) => e.amount <= max)
      }
      
      setExpenses(filtered)
    } catch (err) {
      console.error('搜索失败', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // 重置搜索
  const handleReset = useCallback(() => {
    setSearchFilters(null)
    setPage(0)
    loadExpenses()
  }, [])

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

  return (
    <div className="space-y-4">
      {/* 搜索筛选组件 */}
      <ExpenseSearch 
        onSearch={handleSearch} 
        onReset={handleReset}
        initialFilters={searchFilters || undefined}
      />

      {/* 搜索结果统计 */}
      {searchFilters && (
        <div className="text-sm text-gray-500 px-1">
          找到 {expenses.length} 条记录
          {expenses.length > 0 && (
            <span className="ml-2">
              支出: <span className="text-red-600">¥{expenses.filter(e => e.category !== 'income').reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</span>
              {' / '}
              收入: <span className="text-blue-600">¥{expenses.filter(e => e.category === 'income').reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</span>
            </span>
          )}
        </div>
      )}

      {/* 空状态 */}
      {expenses.length === 0 && !loading && (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500">
          <div className="text-2xl mb-2">📋</div>
          <div>{searchFilters ? '没有找到匹配的记录' : '暂无记录'}</div>
          <div className="text-sm mt-1">
            {searchFilters ? '尝试调整筛选条件' : '开始记下你的第一笔支出吧'}
          </div>
        </div>
      )}

      {/* 记录列表 */}
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

      {/* 分页加载 - 仅在非搜索模式下显示 */}
      {!searchFilters && expenses.length >= 20 && (
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