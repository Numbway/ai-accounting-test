import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar
} from 'recharts'
import SmartAnalysis from '../components/SmartAnalysis'

interface CategoryStat {
  category: string
  category_full: string
  total_amount: number
  count: number
  percentage: number
}

interface MonthlyStats {
  year: number
  month: number
  total_amount: number
  count: number
  daily_avg: number
  categories: CategoryStat[]
}

interface DailyData {
  date: string
  amount: number
}

interface BudgetStatus {
  year: number
  month: number
  budget_amount: number
  spent_amount: number
  remaining_amount: number
  percentage: number
  is_over_budget: boolean
}

type TimeRange = 'month' | '3months' | '6months' | 'year'

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#B8B8B8']

export default function Stats() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [timeRange, setTimeRange] = useState<TimeRange>('month')
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [budget, setBudget] = useState<BudgetStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'trend' | 'analysis'>('overview')

  useEffect(() => {
    loadData()
  }, [year, month, timeRange])

  const loadData = async () => {
    setLoading(true)
    try {
      // 加载统计数据
      const { data: statsData } = await axios.get(`/api/stats/${year}/${month}`)
      setStats(statsData)

      // 加载预算数据
      try {
        const { data: budgetData } = await axios.get(`/api/budget/${year}/${month}`)
        setBudget(budgetData)
      } catch {
        setBudget(null)
      }

      // 加载趋势数据
      await loadTrendData()
    } catch (err) {
      console.error('加载失败', err)
    } finally {
      setLoading(false)
    }
  }

  const loadTrendData = async () => {
    try {
      let startDate: Date
      let endDate = new Date(year, month, 0) // 本月最后一天

      switch (timeRange) {
        case 'month':
          startDate = new Date(year, month - 1, 1)
          break
        case '3months':
          startDate = new Date(year, month - 3, 1)
          break
        case '6months':
          startDate = new Date(year, month - 6, 1)
          break
        case 'year':
          startDate = new Date(year, 0, 1)
          endDate = new Date(year, 11, 31)
          break
        default:
          startDate = new Date(year, month - 1, 1)
      }

      const params = {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        limit: 1000,
      }

      const { data: expenses } = await axios.get('/api/expenses', { params })

      // 按日期聚合
      const dailyMap = new Map<string, number>()
      expenses.forEach((e: any) => {
        const date = e.date.split('T')[0]
        dailyMap.set(date, (dailyMap.get(date) || 0) + e.amount)
      })

      // 转换为数组并排序
      const sortedDates = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, amount]) => ({
          date: timeRange === 'year' ? date.slice(5) : date.slice(5), // 显示 MM-DD
          fullDate: date,
          amount,
        }))

      setDailyData(sortedDates)
    } catch (err) {
      console.error('加载趋势数据失败', err)
    }
  }

  const changeMonth = (delta: number) => {
    let newMonth = month + delta
    let newYear = year
    if (newMonth > 12) {
      newMonth = 1
      newYear++
    } else if (newMonth < 1) {
      newMonth = 12
      newYear--
    }
    setYear(newYear)
    setMonth(newMonth)
  }

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'month': return `${year}年${month}月`
      case '3months': return '近3个月'
      case '6months': return '近6个月'
      case 'year': return `${year}年全年`
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!stats || stats.total_amount === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center text-gray-500">
        <div className="text-2xl mb-2">📊</div>
        <div>暂无支出记录</div>
      </div>
    )
  }

  const chartData = stats.categories.map(cat => ({
    name: cat.category_full,
    value: cat.total_amount,
    percentage: cat.percentage.toFixed(1)
  }))

  // 预算进度条颜色
  const getBudgetColor = () => {
    if (!budget) return 'bg-gray-300'
    if (budget.percentage >= 100) return 'bg-red-500'
    if (budget.percentage >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-4">
      {/* 标签切换 */}
      <div className="bg-white rounded-xl p-2 shadow-sm flex">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
            activeTab === 'overview' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'
          }`}
        >
          📊 概览
        </button>
        <button
          onClick={() => setActiveTab('trend')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
            activeTab === 'trend' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'
          }`}
        >
          📈 趋势
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
            activeTab === 'analysis' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'
          }`}
        >
          🤖 分析
        </button>
      </div>

      {/* 月份选择（仅概览模式） */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
          <button onClick={() => changeMonth(-1)} className="text-xl p-2">◀</button>
          <span className="font-medium">{getTimeRangeLabel()}</span>
          <button onClick={() => changeMonth(1)} className="text-xl p-2">▶</button>
        </div>
      )}

      {/* 时间范围选择（仅趋势模式） */}
      {activeTab === 'trend' && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'month', label: '本月' },
              { key: '3months', label: '近3月' },
              { key: '6months', label: '近6月' },
              { key: 'year', label: '本年' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeRange(key as TimeRange)}
                className={`py-2 text-sm font-medium rounded-lg transition ${
                  timeRange === key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 总支出 */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white text-center">
        <div className="text-sm opacity-80">
          {activeTab === 'trend' ? getTimeRangeLabel() : '本月支出'}
        </div>
        <div className="text-4xl font-bold mt-2">¥{stats.total_amount.toFixed(2)}</div>
        <div className="flex justify-around mt-4 text-sm">
          <div>
            <div className="opacity-80">笔数</div>
            <div className="font-semibold">{stats.count}</div>
          </div>
          <div>
            <div className="opacity-80">日均</div>
            <div className="font-semibold">¥{stats.daily_avg.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* 预算进度条 */}
      {budget && budget.budget_amount > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">💰 本月预算</h3>
            <span className={`text-sm font-medium ${budget.is_over_budget ? 'text-red-500' : 'text-green-600'}`}>
              {budget.is_over_budget ? '已超支' : `剩余 ¥${budget.remaining_amount.toFixed(2)}`}
            </span>
          </div>
          <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`absolute h-full rounded-full transition-all duration-500 ${getBudgetColor()}`}
              style={{ width: `${Math.min(budget.percentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>已用 ¥{budget.spent_amount.toFixed(2)}</span>
            <span>预算 ¥{budget.budget_amount.toFixed(2)} ({budget.percentage.toFixed(1)}%)</span>
          </div>
        </div>
      )}

      {/* 概览内容 */}
      {activeTab === 'overview' && (
        <>
          {/* 饼图 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-medium mb-4">支出分类</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  <Legend
                    formatter={(value, entry: any) => {
                      const data = entry.payload as any
                      return `${value} (${data.percentage}%)`
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 分类明细 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-medium mb-4">分类明细</h3>
            <div className="space-y-3">
              {stats.categories.map((cat, idx) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{cat.category_full}</div>
                    <div className="text-xs text-gray-500">{cat.count} 笔</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">¥{cat.total_amount.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{cat.percentage.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 趋势内容 */}
      {activeTab === 'trend' && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-medium mb-4">支出趋势</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `¥${value}`}
                />
                <Tooltip
                  formatter={(value: number) => [`¥${value.toFixed(2)}`, '金额']}
                  labelFormatter={(label) => `${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3B82F6' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {dailyData.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              该时间段暂无数据
            </div>
          )}
        </div>
      )}

      {/* 智能分析内容 */}
      {activeTab === 'analysis' && <SmartAnalysis />}
        </div>
      )}
    </div>
  )
}
