import { useState } from 'react'
import axios from 'axios'

export default function ExportData() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  })

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params: any = {}
      if (dateRange.startDate) {
        params.start_date = new Date(dateRange.startDate).toISOString()
      }
      if (dateRange.endDate) {
        params.end_date = new Date(dateRange.endDate).toISOString()
      }
      
      const { data } = await axios.get('/api/export/csv', { params })
      
      // 创建下载链接
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `记账数据_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (err: any) {
      setError(err.response?.data?.detail || '导出失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="font-semibold mb-4">📊 数据导出</h3>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">开始日期</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">结束日期</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>
        
        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium disabled:bg-gray-300"
        >
          {loading ? '导出中...' : '📥 导出 CSV'}
        </button>
        
        <p className="text-xs text-gray-500 text-center">
          不选择日期则导出全部数据
        </p>
      </div>
    </div>
  )
}