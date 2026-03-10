import { useState, useRef, useCallback } from 'react'

interface VoiceInputProps {
  onResult: (text: string) => void
  onError?: (error: string) => void
  disabled?: boolean
}

export default function VoiceInput({ onResult, onError, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // 检查浏览器支持
  const checkSupport = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setIsSupported(false)
      onError?.('您的浏览器不支持语音识别，请使用 Chrome、Edge 或 Safari')
      return false
    }
    return true
  }, [onError])

  // 开始录音
  const startListening = useCallback(() => {
    if (!checkSupport()) return

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionAPI()
    
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results
      if (results.length > 0) {
        const transcript = results[0][0].transcript
        // 如果是最终结果，调用 onResult
        if (results[0].isFinal) {
          onResult(transcript)
          setIsListening(false)
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('语音识别错误:', event.error)
      let errorMessage = '语音识别失败'
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = '没有检测到语音，请重试'
          break
        case 'aborted':
          errorMessage = '语音识别已取消'
          break
        case 'audio-capture':
          errorMessage = '无法访问麦克风'
          break
        case 'not-allowed':
          errorMessage = '麦克风权限被拒绝'
          break
        case 'network':
          errorMessage = '网络错误，请检查网络连接'
          break
      }
      
      onError?.(errorMessage)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [checkSupport, onResult, onError])

  // 停止录音
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }, [])

  // 切换录音状态
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        className="p-2 text-gray-400 cursor-not-allowed"
        title="浏览器不支持语音识别"
      >
        🎤
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      className={`p-2 rounded-lg transition-all duration-200 ${
        isListening
          ? 'bg-red-500 text-white animate-pulse'
          : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isListening ? '点击停止录音' : '点击开始语音输入'}
    >
      {isListening ? (
        <span className="flex items-center gap-1">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
          <span className="text-xs">录音中...</span>
        </span>
      ) : (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  )
}

// TypeScript 类型声明 for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResult {
  isFinal: boolean
  [index: number]: {
    transcript: string
    confidence: number
  }
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  start(): void
  stop(): void
  abort(): void
}

// 添加 TypeScript 类型声明
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}
