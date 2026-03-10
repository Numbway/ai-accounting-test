import { useState, useCallback, useRef } from 'react'
import api from '../lib/axios'

interface ImportRecord {
  date: string
  amount: number
  category: string
  detail?: string
  payment_method?: string
  merchant?: string
}

interface ImportResult {
  success: number
  failed: number
  errors: string[]
  total: number
  processed: number
}

export default function ImportData() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentRow, setCurrentRow] = useState(0)
  const [totalRows, setTotalRows] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  // 系统标准字段
  const systemFields = [
    { key: 'date', label: '日期', required: true },
    { key: 'type', label: '收支类型', required: false },
    { key: 'amount', label: '金额', required: true },
    { key: 'category', label: '类别', required: true },
    { key: 'detail', label: '详情', required: false },
    { key: 'payment_method', label: '支付方式', required: false },
    { key: 'merchant', label: '商户', required: false },
  ]

  const parseCSV = (content: string): { headers: string[]; rows: string[][]; totalRows: number } => {
    const lines = content.trim().split('\n')
    if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 }

    // 解析 CSV（简单实现，处理引号）
    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseLine(lines[0])
    const rows = lines.slice(1).filter(line => line.trim()).map(parseLine)
    return { headers, rows, totalRows: rows.length }
  }

  const detectFieldMapping = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {}
    const headerLowerMap = headers.reduce((acc, h, i) => {
      acc[h.toLowerCase().replace(/\s+/g, '')] = h
      return acc
    }, {} as Record<string, string>)

    // 自动映射常见字段名
    const fieldPatterns: Record<string, string[]> = {
      date: ['date', '日期', '时间', 'time', '消费日期'],
      type: ['type', '收支类型', '类型', '收支', '收入支出'],
      amount: ['amount', '金额', '价格', 'price', '花费', '支出', 'money'],
      category: ['category', '类别', '分类', '类型', 'type'],
      detail: ['detail', '详情', '描述', '备注', 'description', 'note', 'memo'],
      payment_method: ['payment', '支付方式', '支付', '付款方式', 'paymethod'],
      merchant: ['merchant', '商户', '商家', '店铺', 'store', 'shop'],
    }

    for (const [field, patterns] of Object.entries(fieldPatterns)) {
      for (const pattern of patterns) {
        if (headerLowerMap[pattern]) {
          mapping[field] = headerLowerMap[pattern]
          break
        }
      }
    }

    return mapping
  }

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // 检查文件类型
    if (!selectedFile.name.endsWith('.csv')) {
      setError('请选择 CSV 文件')
      return
    }

    setFile(selectedFile)
    setError(null)
    setResult(null)
    setProgress(0)
    setCurrentRow(0)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      try {
        // 处理 UTF-8 BOM
        const cleanContent = content.replace(/^\uFEFF/, '')
        const { headers, rows, totalRows } = parseCSV(cleanContent)

        if (headers.length === 0) {
          setError('CSV 文件格式错误')
          return
        }

        setCsvHeaders(headers)
        setTotalRows(totalRows)

        // 自动检测字段映射
        const autoMapping = detectFieldMapping(headers)
        setFieldMapping(autoMapping)

        // 解析预览数据（前5条）
        const previewData: ImportRecord[] = rows.slice(0, 5).map((row, idx) => {
          const record: any = { line: idx + 2 }
          headers.forEach((header, i) => {
            record[header] = row[i] || ''
          })
          return record as ImportRecord
        })

        setPreview(previewData)
      } catch (err) {
        setError('解析 CSV 失败: ' + (err as Error).message)
      }
    }
    reader.readAsText(selectedFile)
  }, [])

  // 模拟进度更新
  const simulateProgress = (total: number) => {
    let current = 0
    const batchSize = Math.max(1, Math.floor(total / 20)) // 分20步完成
    
    const updateProgress = () => {
      current += batchSize
      const progressPercent = Math.min(95, Math.floor((current / total) * 100))
      setCurrentRow(Math.min(current, total))
      setProgress(progressPercent)
      
      if (current < total * 0.95) {
        setTimeout(updateProgress, 100)
      }
    }
    
    updateProgress()
  }

  const handleImport = async () => {
    if (!file) return

    // 验证必填字段映射
    const requiredFields = systemFields.filter(f => f.required)
    for (const field of requiredFields) {
      if (!fieldMapping[field.key]) {
        setError(`请映射必填字段: ${field.label}`)
        return
      }
    }

    setImporting(true)
    setError(null)
    setResult(null)
    setProgress(0)

    // 开始模拟进度
    simulateProgress(totalRows)

    try {
      const reader = new FileReader()
      
      const importPromise = new Promise<void>((resolve, reject) => {
        reader.onload = async (event) => {
          try {
            const content = event.target?.result as string
            const cleanContent = content.replace(/^\uFEFF/, '')

            // 创建 AbortController 用于取消请求
            abortControllerRef.current = new AbortController()

            const { data } = await api.post('/api/import/csv', {
              csv_content: cleanContent,
              field_mapping: fieldMapping,
            }, {
              signal: abortControllerRef.current.signal
            })

            setResult({ ...data, total: totalRows, processed: totalRows })
            setProgress(100)
            setCurrentRow(totalRows)
            
            if (data.success > 0) {
              // 清空文件选择
              setFile(null)
              setPreview([])
              setCsvHeaders([])
            }
            resolve()
          } catch (err: any) {
            reject(err)
          }
        }
        reader.onerror = () => reject(new Error('读取文件失败'))
      })

      reader.readAsText(file)
      await importPromise
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('导入已取消')
      } else {
        setError(err.response?.data?.detail || '导入失败')
      }
      setProgress(0)
      setCurrentRow(0)
    } finally {
      setImporting(false)
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setImporting(false)
    setProgress(0)
    setCurrentRow(0)
  }

  // 计算进度条颜色
  const getProgressColor = () => {
    if (progress < 30) return 'bg-red-500'
    if (progress < 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="font-semibold mb-4">📥 数据导入</h3>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {result && (
        <div className={`p-3 rounded-lg text-sm mb-4 ${result.failed === 0 ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-700'}`}>
          <div className="font-medium">导入完成</div>
          <div className="flex gap-4 mt-1">
            <span>成功: <span className="font-bold text-green-600">{result.success}</span> 条</span>
            {result.failed > 0 && <span>失败: <span className="font-bold text-red-600">{result.failed}</span> 条</span>}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 text-xs">
              <div className="font-medium">错误详情:</div>
              {result.errors.slice(0, 5).map((err, i) => (
                <div key={i} className="text-red-500">{err}</div>
              ))}
              {result.errors.length > 5 && (
                <div className="text-gray-500">...还有 {result.errors.length - 5} 条错误</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {/* 文件上传 */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">选择 CSV 文件</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={importing}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 disabled:opacity-50"
          />
          <p className="text-xs text-gray-400 mt-1">
            支持从其他记账软件导出的 CSV 格式
          </p>
        </div>

        {/* 进度条 */}
        {importing && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">正在导入...</span>
              <span className="text-sm text-gray-500">{currentRow} / {totalRows} 行</span>
            </div>
            
            {/* 进度条 */}
            <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`absolute h-full rounded-full transition-all duration-300 ease-out ${getProgressColor()}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* 百分比 */}
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">{progress}%</span>
              <button
                onClick={handleCancel}
                className="text-xs text-red-500 hover:text-red-600 underline"
              >
                取消导入
              </button>
            </div>
            
            {/* 状态提示 */}
            <div className="mt-2 text-xs text-gray-400">
              {progress < 30 && '正在解析数据...'}
              {progress >= 30 && progress < 70 && '正在导入记录...'}
              {progress >= 70 && progress < 100 && '即将完成...'}
              {progress === 100 && '处理完成！'}
            </div>
          </div>
        )}

        {/* 字段映射 */}
        {csvHeaders.length > 0 && !importing && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">字段映射</h4>
            <div className="space-y-2">
              {systemFields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-24">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={fieldMapping[field.key] || ''}
                    onChange={(e) => setFieldMapping({ ...fieldMapping, [field.key]: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">-- 选择 CSV 列 --</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 数据预览 */}
        {preview.length > 0 && !importing && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">数据预览（前5条，共{totalRows}条）</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {systemFields.map((field) => fieldMapping[field.key] && (
                      <th key={field.key} className="px-2 py-2 text-left text-gray-600">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      {systemFields.map((field) => fieldMapping[field.key] && (
                        <td key={field.key} className="px-2 py-2 text-gray-800">
                          {(row as any)[fieldMapping[field.key]] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 导入按钮 */}
        {file && !importing && (
          <button
            onClick={handleImport}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition"
          >
            📥 开始导入 ({totalRows} 条记录)
          </button>
        )}
      </div>
    </div>
  )
}
