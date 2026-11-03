// 站点配置：改完保存并重新部署即可，不需要构建工具。
window.FEEDBACK_CONFIG = {
  // auto    = 填了 env + accessKey 就走云端；在 localhost 且没填时走本机服务；其它情况显示"未配置"
  // local   = 强制走本机 Node 服务（仅本机预览用）
  // cloudbase = 强制走腾讯云开发
  mode: 'auto',

  // 腾讯云开发环境 ID，例如 "prod-1a2b3c"（控制台首页可复制）
  env: '',
  // Publishable Key（控制台 → 环境配置 → API Key 配置 → 生成）
  accessKey: '',
  // 环境地域，默认上海
  region: 'ap-shanghai',
  // 云数据库集合名
  collection: 'feedback',
  // 公示栏自动刷新间隔（毫秒）
  pollMs: 30000,
};
