import { useState, useCallback, useEffect } from 'react'
import dayjs from 'dayjs'

interface SearchFilters {
  keyword: string
  category: string
  startDate: string
  endDate: string
  minAmount: string
  maxAmount: string
}

interface ExpenseSearchProps {
  onSearch: (filters: SearchFilters) => void
  onReset: () => void
  initialFilters?: SearchFilters
}

const CATEGORIES = [
  { value: '', label: '全部类别', emoji: '📋' },
  { value: 'food', label: '餐饮', emoji: '🍔' },
  { value: 'transport', label: '交通', emoji: '🚌' },
  { value: 'shopping', label: '购物', emoji: '🛒' },
  { value: 'living', label: '居住', emoji: '🏠' },
  { value: 'medical', label: '医疗', emoji: '💊' },
  { value: 'entertainment', label: '娱乐', emoji: '🎬' },
  { value: 'income', label: '收入', emoji: '💰' },
  { value: 'other', label: '其他', emoji: '📦' },
]

const DATE_PRESETS = [
  { label: '今天', days: 0 },
  { label: '最近7天', days: 7 },
  { label: '最近30天', days: 30 },
  { label: '本月', days: -1 }, // 特殊处理
  { label: '上月', days: -2 }, // 特殊处理
]

export default function ExpenseSearch({ onSearch, onReset, initialFilters }: ExpenseSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    keyword: '',
    category: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 初始化时应用传入的 filters
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters)
    }
  }, [initialFilters])

  // 更新单个 filter
  const updateFilter = useCallback((key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  // 应用日期预设
  const applyDatePreset = useCallback((days: number) => {
    const today = dayjs()
    let start: dayjs.Dayjs
    let end: dayjs.Dayjs = today

    if (days === 0) {
      // 今天
      start = today
      end = today
    } else if (days === -1) {
      // 本月
      start = today.startOf('month')
      end = today
    } else if (days === -2) {
      // 上月
      start = today.subtract(1, 'month').startOf('month')
      end = today.subtract(1, 'month').endOf('month')
    } else {
      // 最近 N 天
      start = today.subtract(days, 'day')
    }

    setFilters(prev => ({
      ...prev,
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    }))
  }, [])

  // 执行搜索
  const handleSearch = useCallback(() => {
    onSearch(filters)
  }, [filters, onSearch])

  // 重置搜索
  const handleReset = useCallback(() => {
    setFilters({
      keyword: '',
      category: '',
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
    })
    onReset()
  }, [onReset])

  // 检查是否有活动的筛选条件
  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
      {/* 搜索关键词 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={filters.keyword}
            onChange={(e) => updateFilter('keyword', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索详情、商户..."
            className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </span>
          {filters.keyword && (
            <button
              type="button"
              onClick={() => updateFilter('keyword', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleSearch}
          className="px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition"
        >
          搜索
        </button>
      </div>

      {/* 快捷筛选：类别 + 日期 */}
      <div className="flex flex-wrap gap-2">
        {/* 类别选择 */}
        <select
          value={filters.category}
          onChange={(e) => updateFilter('category', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        >
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>
              {cat.emoji} {cat.label}
            </option>
          ))}
        </select>

        {/* 日期预设 */}
        {DATE_PRESETS.map(preset => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyDatePreset(preset.days)}
            className={`px-3 py-2 text-sm rounded-lg border transition ${
              (preset.days >= 0 && 
                filters.startDate === dayjs().subtract(preset.days, 'day').format('YYYY-MM-DD') &&
                filters.endDate === dayjs().format('YYYY-MM-DD')) ||
              (preset.days === -1 && 
                filters.startDate === dayjs().startOf('month').format('YYYY-MM-DD')) ||
              (preset.days === -2 && 
                filters.startDate === dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'))
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* 高级筛选开关 */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
      >
        {showAdvanced ? '收起高级筛选' : '高级筛选'}
        <span>{showAdvanced ? '▲' : '▼'}</span>
      </button>

      {/* 高级筛选 */}
      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          {/* 日期范围 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">开始日期</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => updateFilter('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">结束日期</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => updateFilter('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 金额范围 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">最小金额</label>
              <input
                type="number"
                value={filters.minAmount}
                onChange={(e) => updateFilter('minAmount', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">最大金额</label>
              <input
                type="number"
                value={filters.maxAmount}
                onChange={(e) => updateFilter('maxAmount', e.target.value)}
                placeholder="∞"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 重置按钮 */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleReset}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          重置所有筛选
        </button>
      )}
    </div>
  )
}

export type { SearchFilters }
