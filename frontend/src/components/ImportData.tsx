import { useState, useCallback } from 'react'
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
}

export default function ImportData() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])

  // 系统标准字段
  const systemFields = [
    { key: 'date', label: '日期', required: true },
    { key: 'amount', label: '金额', required: true },
    { key: 'category', label: '类别', required: true },
    { key: 'detail', label: '详情', required: false },
    { key: 'payment_method', label: '支付方式', required: false },
    { key: 'merchant', label: '商户', required: false },
  ]

  const parseCSV = (content: string): { headers: string[]; rows: string[][] } => {
    const lines = content.trim().split('\n')
    if (lines.length === 0) return { headers: [], rows: [] }

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
    const rows = lines.slice(1).map(parseLine)
    return { headers, rows }
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
      amount: ['amount', '金额', '价格', 'price', '花费', '支出', 'money'],
      category: ['category', '类别', '分类', '类型', 'type'],
      detail: ['detail', '详情', '描述', '备注', 'description', 'note'],
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

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      try {
        // 处理 UTF-8 BOM
        const cleanContent = content.replace(/^\uFEFF/, '')
        const { headers, rows } = parseCSV(cleanContent)

        if (headers.length === 0) {
          setError('CSV 文件格式错误')
          return
        }

        setCsvHeaders(headers)

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

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const content = event.target?.result as string
        const cleanContent = content.replace(/^\uFEFF/, '')

        const { data } = await api.post('/api/import/csv', {
          csv_content: cleanContent,
          field_mapping: fieldMapping,
        })

        setResult(data)
        if (data.success > 0) {
          // 清空文件选择
          setFile(null)
          setPreview([])
          setCsvHeaders([])
        }
      }
      reader.readAsText(file)
    } catch (err: any) {
      setError(err.response?.data?.detail || '导入失败')
    } finally {
      setImporting(false)
    }
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
          <div>成功: {result.success} 条</div>
          {result.failed > 0 && <div>失败: {result.failed} 条</div>}
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
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-400 mt-1">
            支持从其他记账软件导出的 CSV 格式
          </p>
        </div>

        {/* 字段映射 */}
        {csvHeaders.length > 0 && (
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
        {preview.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">数据预览（前5条）</h4>
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
        {file && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium disabled:bg-gray-300"
          >
            {importing ? '导入中...' : '📥 开始导入'}
          </button>
        )}
      </div>
    </div>
  )
}
