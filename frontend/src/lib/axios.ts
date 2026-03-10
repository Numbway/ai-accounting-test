import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

// 创建 axios 实例
const api = axios.create({
  baseURL: '',  // 使用相对路径
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 自动添加 token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理认证错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 清除登录状态
      useAuthStore.getState().logout()
      // 可以在这里触发重新登录
      window.dispatchEvent(new CustomEvent('auth:required'))
    }
    return Promise.reject(error)
  }
)

export default api
