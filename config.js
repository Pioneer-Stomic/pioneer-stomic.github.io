// 站点配置：改完保存并重新部署即可，不需要构建工具。
window.FEEDBACK_CONFIG = {
  // auto    = 填了 env + accessKey 就走云端；在 localhost 且没填时走本机服务；其它情况显示"未配置"
  // local   = 强制走本机 Node 服务（仅本机预览用）
  // cloudbase = 强制走腾讯云开发
  mode: 'auto',

  // 腾讯云开发环境 ID（PG 模式）
  env: 'pioneer-stomic-d9gvr5ztg66f4d931',
  // Publishable Key（控制台 → 环境配置 → API Key 配置 → 生成）
  accessKey:
    'eyJhbGciOiJSUzI1NiIsImtpZCI6ImJjYzFhYmNkLWJiOGYtNDEyNy1iMjZmLTc2Mzc2ZmRlMTU2MiJ9.eyJpc3MiOiJodHRwczovL3Bpb25lZXItc3RvbWljLWQ5Z3ZyNXp0ZzY2ZjRkOTMxLmFwLXNoYW5naGFpLnRjYi1hcGkudGVuY2VudGNsb3VkYXBpLmNvbSIsInN1YiI6ImFub24iLCJhdWQiOiJwaW9uZWVyLXN0b21pYy1kOWd2cjV6dGc2NmY0ZDkzMSIsImV4cCI6NDA5NzM4Njk0NSwiaWF0IjoxNzkzNzAzNzQ1LCJub25jZSI6ImFiZG1IMkJCVG9PUUpsZWlmRUdmNFEiLCJhdF9oYXNoIjoiYWJkbUgyQkJUb09RSmxlaWZFR2Y0USIsIm5hbWUiOiJBbm9ueW1vdXMiLCJzY29wZSI6ImFub255bW91cyIsInByb2plY3RfaWQiOiJwaW9uZWVyLXN0b21pYy1kOWd2cjV6dGc2NmY0ZDkzMSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.xtD8A2l3I_zLOqpmsX_w42MK4GNjuil7XYRdBwRHf1fD2KG_HEN_DLtK6RSSA5xYik00C6MNcLlZ69tIY4rMneXZUbWxKd2i59uch7HkHvFMAc1RaCZNIVCPOCHKTe1GwIBFQXsw8Sn9vNcPEeS5q4SvjPFK4ANK2LaUWaWveRe9z9cw62GYbO45DUON-yEwbmX0Z1D2GZqHO56PM9AYdy6oGbaDL8RElQbvlz3ScnVx5NzCDeE854_6Ajx3ENCDkchiGynwzsN6GA-VvmDw-bHPXbOFs0mBeLvX3qBWDDWQ2_LO5KgfqoQ2ZLjMa1QQY6hKzebRoKCrJvz6dXO7hw',
  // 环境地域，默认上海
  region: 'ap-shanghai',
  // 数据表名（PostgreSQL）
  collection: 'feedback',
  // 公示栏自动刷新间隔（毫秒）
  pollMs: 30000,
};
