import { useState } from 'react'
import ExpenseInput from './components/ExpenseInput'
import ExpenseList from './components/ExpenseList'
import Stats from './pages/Stats'
import CategoryIcon from './components/CategoryIcon'
import ExportData from './components/ExportData'
import ImportData from './components/ImportData'
import BudgetSetting from './components/BudgetSetting'

type Tab = 'home' | 'list' | 'stats' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home')

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">📋 AI 记账</h1>
          <div className="flex gap-2">
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
      <main className="max-w-md mx-auto px-4 py-4">
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
  const [summary] = useState({ total: 520, count: 12 })
  
  const currentMonth = new Date().toLocaleString('zh-CN', { year: 'numeric', month: 'long' })
  
  return (
    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
      <div className="text-sm opacity-80">{currentMonth}</div>
      <div className="text-3xl font-bold mt-1">¥{summary.total.toFixed(2)}</div>
      <div className="text-sm opacity-80 mt-1">共 {summary.count} 笔支出</div>
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