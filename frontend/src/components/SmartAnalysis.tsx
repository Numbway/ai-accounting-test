import { useState, useEffect } from 'react'
import api from '../lib/axios'

interface AbnormalExpense {
  date: string
  amount: number
  category?: string
  detail?: string
  reason: string
}

interface RecurringExpense {
  type: string
  name: string
  count: number
  avg_amount: number
  suggestion: string
}

interface Suggestion {
  type: string
  message: string
  suggestion: string
}

interface CategoryAnalysis {
  category: string
  total: number
  count: number
  avg_per_transaction: number
}

interface AnalysisData {
  abnormal_expenses: AbnormalExpense[]
  recurring_expenses: RecurringExpense[]
  suggestions: Suggestion[]
  category_analysis: CategoryAnalysis[]
  summary: {
    total_30d: number
    daily_avg_30d: number
    transaction_count: number
  }
}

export default function SmartAnalysis() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'abnormal' | 'recurring'>('overview')

  useEffect(() => {
    loadAnalysis()
  }, [])

  const loadAnalysis = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/analysis/smart')
      setAnalysis(data)
    } catch (err) {
      console.error('加载智能分析失败', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="animate-pulse text-gray-500">分析中...</div>
      </div>
    )
  }

  if (!analysis || analysis.summary.transaction_count === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center text-gray-500">
        <div className="text-2xl mb-2">🤖</div>
        <div>数据不足，无法生成分析报告</div>
        <div className="text-sm mt-2">记录更多支出后，AI 将为您提供智能分析</div>
      </div>
    )
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
          onClick={() => setActiveTab('abnormal')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
            activeTab === 'abnormal' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'
          }`}
        >
          ⚠️ 异常
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
            activeTab === 'recurring' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'
          }`}
        >
          🔄 固定支出
        </button>
      </div>

      {/* 概览 */}
      {activeTab === 'overview' && (
        <>
          {/* 30天统计 */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="text-sm opacity-80">近30天支出</div>
            <div className="text-3xl font-bold mt-2">¥{analysis.summary.total_30d.toFixed(2)}</div>
            <div className="flex justify-around mt-4 text-sm">
              <div>
                <div className="opacity-80">笔数</div>
                <div className="font-semibold">{analysis.summary.transaction_count}</div>
              </div>
              <div>
                <div className="opacity-80">日均</div>
                <div className="font-semibold">¥{analysis.summary.daily_avg_30d.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* 智能建议 */}
          {analysis.suggestions.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold mb-4">💡 智能建议</h3>
              <div className="space-y-3">
                {analysis.suggestions.map((suggestion, idx) => (
                  <div key={idx} className="bg-blue-50 rounded-lg p-3">
                    <div className="text-sm font-medium text-blue-800">{suggestion.message}</div>
                    <div className="text-xs text-blue-600 mt-1">{suggestion.suggestion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 类别分析 */}
          {analysis.category_analysis.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold mb-4">📈 类别分析（近30天）</h3>
              <div className="space-y-3">
                {analysis.category_analysis.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{cat.category}</div>
                      <div className="text-xs text-gray-500">{cat.count} 笔，均 ¥{cat.avg_per_transaction.toFixed(2)}/笔</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">¥{cat.total.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 异常支出 */}
      {activeTab === 'abnormal' && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold mb-4">⚠️ 异常支出检测</h3>
          {analysis.abnormal_expenses.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-2xl mb-2">✅</div>
              <div>未发现异常支出</div>
              <div className="text-sm mt-2">您的消费很平稳，继续保持！</div>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.abnormal_expenses.map((item, idx) => (
                <div key={idx} className="bg-red-50 rounded-lg p-3 border-l-4 border-red-400">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium text-red-800">
                        {item.date} · {item.category || '大额支出'}
                      </div>
                      {item.detail && (
                        <div className="text-xs text-red-600 mt-1">{item.detail}</div>
                      )}
                      <div className="text-xs text-red-500 mt-1">{item.reason}</div>
                    </div>
                    <div className="text-lg font-bold text-red-600">
                      ¥{item.amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 固定支出 */}
      {activeTab === 'recurring' && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold mb-4">🔄 重复支出识别</h3>
          {analysis.recurring_expenses.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-2xl mb-2">🔍</div>
              <div>未识别到固定支出</div>
              <div className="text-sm mt-2">记录更多数据后，AI 将自动识别订阅和固定账单</div>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.recurring_expenses.map((item, idx) => (
                <div key={idx} className="bg-green-50 rounded-lg p-3 border-l-4 border-green-400">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium text-green-800">{item.name}</div>
                      <div className="text-xs text-green-600 mt-1">
                        近30天出现 {item.count} 次
                      </div>
                      <div className="text-xs text-green-500 mt-1">{item.suggestion}</div>
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      ¥{item.avg_amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
