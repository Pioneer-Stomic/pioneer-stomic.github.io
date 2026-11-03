import { validateFeedback } from './validation.js';

// CloudBase 官方 CDN（腾讯自建，国内可访问），UMD 包会挂到 window.cloudbase
export const SDK_URL = 'https://static.cloudbase.net/cloudbase-js-sdk/3.11.0/cloudbase.full.js';

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.field = options.field;
    this.status = options.status;
    this.cause = options.cause;
  }
}

/**
 * 决定用哪套存储：
 * - 显式 local / cloudbase 直接用；
 * - auto 时，配置了 env + accessKey 就走云端；
 * - 否则只有 localhost/127.0.0.1 才走本机服务，公网上则视为未配置。
 */
export function resolveMode(config = {}, location = globalThis.location) {
  const forced = config.mode;
  if (forced === 'local' || forced === 'cloudbase') return forced;
  if (config.env && config.accessKey) return 'cloudbase';
  const host = String(location?.hostname ?? '');
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return 'local';
  return 'unconfigured';
}

export function createApi({ mode, config = {}, sdk = null, fetchImpl = globalThis.fetch } = {}) {
  if (mode === 'local') return createLocalApi(fetchImpl);
  if (mode === 'cloudbase') return createCloudbaseApi({ config, sdk });
  throw new ApiError('当前站点尚未配置数据存储');
}

function createLocalApi(fetchImpl) {
  if (typeof fetchImpl !== 'function') throw new ApiError('当前环境不支持网络请求');

  return {
    mode: 'local',
    async list() {
      let res;
      try {
        res = await fetchImpl('/api/feedback', { headers: { accept: 'application/json' } });
      } catch (err) {
        throw new ApiError('网络异常，无法连接本机服务', { cause: err });
      }
      if (!res.ok) throw new ApiError(`加载失败（HTTP ${res.status}）`, { status: res.status });
      const data = await res.json().catch(() => ({}));
      return (data.items || []).map(normalizeItem);
    },
    async submit(input) {
      const checked = validateFeedback(input);
      if (!checked.ok) throw new ApiError(checked.message, { field: checked.field });

      let res;
      try {
        res = await fetchImpl('/api/feedback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(checked.value),
        });
      } catch (err) {
        throw new ApiError('网络异常，提交失败，请稍后重试', { cause: err });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(data?.error?.message || `提交失败（HTTP ${res.status}）`, {
          field: data?.error?.field,
          status: res.status,
        });
      }
      return normalizeItem(data.item);
    },
  };
}

function createCloudbaseApi({ config, sdk }) {
  if (!sdk || typeof sdk.init !== 'function') throw new ApiError('CloudBase SDK 未加载');

  let db = null;
  function database() {
    if (!db) {
      const app = sdk.init({
        env: config.env,
        accessKey: config.accessKey,
        region: config.region || 'ap-shanghai',
      });
      db = app.database();
    }
    return db;
  }
  const collection = () => database().collection(config.collection || 'feedback');

  return {
    mode: 'cloudbase',
    async list() {
      const res = await callSdk(() => collection().orderBy('createdAt', 'desc').limit(200).get());
      if (res?.code) throw mapCloudError(res);
      return (res?.data || []).map(normalizeItem);
    },
    async submit(input) {
      const checked = validateFeedback(input);
      if (!checked.ok) throw new ApiError(checked.message, { field: checked.field });

      const res = await callSdk(() => collection().add({ ...checked.value, createdAt: new Date() }));
      if (res?.code) throw mapCloudError(res);
      return { id: String(res?.id ?? ''), ...checked.value, createdAt: new Date() };
    },
  };
}

async function callSdk(fn) {
  try {
    return await fn();
  } catch (err) {
    throw asApiError(err);
  }
}

function asApiError(err) {
  if (err instanceof ApiError) return err;
  if (err && typeof err === 'object' && err.code) return mapCloudError(err);
  return new ApiError(err?.message || '云端请求失败，请稍后重试', { cause: err });
}

const CLOUD_ERROR_TEXT = {
  DATABASE_PERMISSION_DENIED: '数据库拒绝访问：请检查 feedback 集合的安全规则是否允许读写',
  PERMISSION_DENIED: '数据库拒绝访问：请检查 feedback 集合的安全规则',
  INVALID_API_KEY: 'Publishable Key 无效：请检查 config.js 里的 accessKey',
  INVALID_ACCESS_KEY: 'Publishable Key 无效：请检查 config.js 里的 accessKey',
  ENV_NOT_FOUND: '环境不存在：请检查 config.js 里的 env',
  INVALID_ENV: '环境 ID 格式不正确：请检查 config.js 里的 env',
  NETWORK_ERROR: '网络异常，无法连接云端数据库',
};

function mapCloudError(res = {}) {
  const code = res.code;
  const friendly = CLOUD_ERROR_TEXT[code] || `云端返回错误：${res.message || code || '未知错误'}`;
  return new ApiError(friendly, { code });
}

function normalizeItem(doc = {}) {
  return {
    id: String(doc._id ?? doc.id ?? ''),
    name: String(doc.name ?? ''),
    course: String(doc.course ?? ''),
    content: String(doc.content ?? ''),
    createdAt: doc.createdAt ?? null,
  };
}
