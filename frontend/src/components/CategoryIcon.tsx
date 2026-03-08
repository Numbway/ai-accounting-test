// 类别 emoji 映射
const CATEGORY_EMOJI: Record<string, string> = {
  food: '🍔',
  transport: '🚌',
  shopping: '🛒',
  living: '🏠',
  medical: '💊',
  entertainment: '🎬',
  income: '💰',
  other: '📦'
}

interface CategoryIconProps {
  category: string
  size?: 'sm' | 'md' | 'lg'
}

export default function CategoryIcon({ category, size = 'md' }: CategoryIconProps) {
  const emoji = CATEGORY_EMOJI[category] || '📦'
  
  const sizeMap = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl'
  }
  
  return (
    <span className={sizeMap[size]} role="img" aria-label={category}>
      {emoji}
    </span>
  )
}

// 获取类别中文名
export function getCategoryName(category: string): string {
  const nameMap: Record<string, string> = {
    food: '餐饮',
    transport: '交通',
    shopping: '购物',
    living: '居住',
    medical: '医疗',
    entertainment: '娱乐',
    income: '收入',
    other: '其他'
  }
  return nameMap[category] || '其他'
}