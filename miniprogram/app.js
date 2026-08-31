App({
  onLaunch() {
    const { cloudEnvId } = this.globalData
    if (cloudEnvId && wx.cloud) {
      wx.cloud.init({
        env: cloudEnvId,
        traceUser: true
      })
    }
  },

  globalData: {
    appName: 'AI 发货台账',
    recognitionMode: 'mock',
    cloudEnvId: ''
  }
})
