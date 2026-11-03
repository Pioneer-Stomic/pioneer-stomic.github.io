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
      return (data.items || []).map(normalizeRow);
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
      return normalizeRow(data.item);
    },
  };
}

/**
 * CloudBase PG 模式：Publishable Key → anon 角色 → PostgREST（app.rdb()）
 * 权限由数据库的表级 GRANT + RLS 策略决定，SQL 见仓库根目录 cloudbase.sql。
 */
function createCloudbaseApi({ config, sdk }) {
  if (!sdk || typeof sdk.init !== 'function') throw new ApiError('CloudBase SDK 未加载');
  const table = config.collection || 'feedback';

  let db = null;
  function rdb() {
    if (!db) {
      const app = sdk.init({
        env: config.env,
        accessKey: config.accessKey,
        region: config.region || 'ap-shanghai',
      });
      if (typeof app.rdb !== 'function') {
        throw new ApiError('当前 SDK 不支持 PostgreSQL 访问，请确认 CloudBase 环境是 PG 模式');
      }
      db = app.rdb();
    }
    return db;
  }

  return {
    mode: 'cloudbase',
    async list() {
      const res = await callSdk(() =>
        rdb()
          .from(table)
          .select('id, name, course, content, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
      );
      if (res?.error) throw mapCloudError(res.error);
      return (res?.data || []).map(normalizeRow);
    },
    async submit(input) {
      const checked = validateFeedback(input);
      if (!checked.ok) throw new ApiError(checked.message, { field: checked.field });

      const res = await callSdk(() =>
        rdb()
          .from(table)
          .insert({
            name: checked.value.name,
            course: checked.value.course,
            content: checked.value.content,
          })
          .select(),
      );
      if (res?.error) throw mapCloudError(res.error);

      const row = Array.isArray(res?.data) ? res.data[0] : res?.data;
      return normalizeRow(row || { ...checked.value, created_at: new Date().toISOString() });
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
  if (err && typeof err === 'object' && (err.code || err.message)) return mapCloudError(err);
  return new ApiError('云端请求失败，请稍后重试', { cause: err });
}

function mapCloudError(err = {}) {
  const code = String(err.code || '');
  const raw = String(err.message || '');
  const lower = raw.toLowerCase();
  let friendly = raw || '云端请求失败，请稍后重试';

  if (code === '42501' || lower.includes('permission denied')) {
    friendly = '数据库拒绝访问：请检查 feedback 表的 RLS 策略，以及 anon 角色的 GRANT 权限';
  } else if (
    code === '42P01' ||
    lower.includes('does not exist') ||
    lower.includes('could not find the table')
  ) {
    friendly = '数据表还没准备好：请先在 SQL 编辑器执行 cloudbase.sql，稍等 1 分钟再刷新';
  } else if (code === '23514' || lower.includes('violates check constraint')) {
    friendly = '内容不符合数据库约束：姓名 1–20 字、课程 ≤20 字、内容 5–1000 字';
  } else if (lower.includes('failed to fetch') || lower.includes('network')) {
    friendly = '网络异常，无法连接云端数据库';
  } else if (lower.includes('jwt') || lower.includes('api key') || code === '401') {
    friendly = '鉴权失败：请检查 config.js 里的环境 ID 与 Publishable Key';
  }

  return new ApiError(friendly, { code: code || undefined });
}

function normalizeRow(row = {}) {
  return {
    id: String(row.id ?? row._id ?? ''),
    name: String(row.name ?? ''),
    course: String(row.course ?? ''),
    content: String(row.content ?? ''),
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}
