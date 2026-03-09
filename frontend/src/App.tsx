import { useState, useEffect } from 'react'
import api from './lib/axios'
import { useAuthStore } from './stores/authStore'
import ExpenseInput from './components/ExpenseInput'
import ExpenseList from './components/ExpenseList'
import Stats from './pages/Stats'
import CategoryIcon from './components/CategoryIcon'
import ExportData from './components/ExportData'
import ImportData from './components/ImportData'
import BudgetSetting from './components/BudgetSetting'
import AuthModal from './components/AuthModal'

type Tab = 'home' | 'list' | 'stats' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { isAuthenticated, user, logout } = useAuthStore()

  // 监听认证事件
  useEffect(() => {
    const handleAuthRequired = () => setShowAuthModal(true)
    window.addEventListener('auth:required', handleAuthRequired)
    return () => window.removeEventListener('auth:required', handleAuthRequired)
  }, [])

  // 如果未登录，显示登录弹窗
  useEffect(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true)
    }
  }, [isAuthenticated])

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 登录弹窗 */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => {
          setShowAuthModal(false)
          // 如果关闭时仍未登录，保持打开
          if (!isAuthenticated) {
            setShowAuthModal(true)
          }
        }} 
      />

      {/* 顶部导航 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">📋 AI 记账</h1>
          <div className="flex gap-2 items-center">
            {isAuthenticated && user && (
              <span className="text-xs text-gray-500">👤 {user.display_name || user.username}</span>
            )}
            {isAuthenticated && (
              <button 
                onClick={() => {
                  logout()
                  api.post('/api/auth/logout').catch(() => {})
                  setShowAuthModal(true)
                }}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                退出
              </button>
            )}
            <button 
              onClick={() => setActiveTab('settings')}
              className="text-sm text-gray-500 hover:text-gray-700 transition"
            >
              设置
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-md mx-auto px-4 py-4 pb-24">
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* 快速记账 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="text-lg font-semibold mb-3">快速记账</h2>
              <ExpenseInput onSuccess={() => {
                // 记账成功后可以切换到列表页
              }} />
            </div>

            {/* 本月统计概览 */}
            <MonthlySummary />
          </div>
        )}

        {activeTab === 'list' && (
          <ExpenseList />
        )}

        {activeTab === 'stats' && (
          <Stats />
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <ImportData />
            <ExportData />
            <BudgetSetting />
          </div>
        )}
      </main>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-md mx-auto flex justify-around py-2">
          <NavButton 
            active={activeTab === 'home'} 
            onClick={() => setActiveTab('home')}
            icon="🏠"
            label="首页"
          />
          <NavButton 
            active={activeTab === 'list'} 
            onClick={() => setActiveTab('list')}
            icon="📋"
            label="记录"
          />
          <NavButton 
            active={activeTab === 'stats'} 
            onClick={() => setActiveTab('stats')}
            icon="📊"
            label="统计"
          />
          <NavButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon="⚙️"
            label="设置"
          />
        </div>
      </nav>
    </div>
  )
}

// 月度概览组件
function MonthlySummary() {
  const [summary, setSummary] = useState({
    total_amount: 0,
    count: 0,
    daily_avg: 0,
    month_over_month_change: 0,
    loading: true
  })
  const { isAuthenticated } = useAuthStore()
  
  const currentMonth = new Date().toLocaleString('zh-CN', { year: 'numeric', month: 'long' })
  
  useEffect(() => {
    if (isAuthenticated) {
      loadSummary()
    }
  }, [isAuthenticated])
  
  const loadSummary = async () => {
    try {
      const { data } = await api.get('/api/summary/current')
      setSummary({
        total_amount: data.total_amount,
        count: data.count,
        daily_avg: data.daily_avg,
        month_over_month_change: data.month_over_month_change,
        loading: false
      })
    } catch (err) {
      console.error('加载概览失败', err)
      setSummary(prev => ({ ...prev, loading: false }))
    }
  }
  
  if (!isAuthenticated) {
    return (
      <div className="bg-gradient-to-r from-gray-400 to-gray-500 rounded-xl p-4 text-white text-center">
        <div className="text-sm opacity-80">请先登录</div>
        <div className="text-lg mt-2">查看您的月度概览</div>
      </div>
    )
  }
  
  if (summary.loading) {
    return (
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
        <div className="animate-pulse">
          <div className="text-sm opacity-80">{currentMonth}</div>
          <div className="text-3xl font-bold mt-1">--</div>
          <div className="text-sm opacity-80 mt-1">加载中...</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
      <div className="flex justify-between items-start">
        <div className="text-sm opacity-80">{currentMonth}</div>
        {summary.month_over_month_change !== 0 && (
          <div className={`text-xs px-2 py-1 rounded-full ${
            summary.month_over_month_change > 0 ? 'bg-red-400' : 'bg-green-400'
          }`}>
            {summary.month_over_month_change > 0 ? '↑' : '↓'} {Math.abs(summary.month_over_month_change).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-3xl font-bold mt-1">¥{summary.total_amount.toFixed(2)}</div>
      <div className="flex justify-between mt-2 text-sm opacity-80">
        <span>共 {summary.count} 笔支出</span>
        <span>日均 ¥{summary.daily_avg.toFixed(2)}</span>
      </div>
    </div>
  )
}

// 导航按钮
function NavButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean
  onClick: () => void
  icon: string
  label: string
}) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
        active ? 'text-blue-500 bg-blue-50' : 'text-gray-500'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs">{label}</span>
    </button>
  )
}

export default App
