import { useState, useEffect } from 'react'
import axios from 'axios'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

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

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#B8B8B8']

export default function Stats() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [year, month])

  const loadStats = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`/api/stats/${year}/${month}`)
      setStats(data)
    } catch (err) {
      console.error('加载失败', err)
    } finally {
      setLoading(false)
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

  const monthLabel = `${year}年${month}月`

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
        <div>本月暂无支出记录</div>
      </div>
    )
  }

  const chartData = stats.categories.map(cat => ({
    name: cat.category_full,
    value: cat.total_amount,
    percentage: cat.percentage.toFixed(1)
  }))

  return (
    <div className="space-y-4">
      {/* 月份选择 */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
        <button onClick={() => changeMonth(-1)} className="text-xl p-2">◀</button>
        <span className="font-medium">{monthLabel}</span>
        <button onClick={() => changeMonth(1)} className="text-xl p-2">▶</button>
      </div>

      {/* 总支出 */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white text-center">
        <div className="text-sm opacity-80">本月支出</div>
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
              <Tooltip 
                formatter={(value: number) => `¥${value.toFixed(2)}`}
              />
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
    </div>
  )
}