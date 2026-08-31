const config = require('./config')

App({
  globalData: {
    appName: 'AI 发货台账',
    recognitionMode: config.BACKEND_MODE,
    apiBaseUrl: config.API_BASE_URL
  }
})
