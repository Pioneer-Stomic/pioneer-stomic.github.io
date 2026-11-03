// 前后端共用的校验规则：浏览器与本机服务都从这里读取，避免两边不一致。
export const LIMITS = Object.freeze({
  nameMax: 20,
  courseMax: 20,
  contentMin: 5,
  contentMax: 1000,
});

function fail(field, message) {
  return { ok: false, field, message };
}

export function validateFeedback(input = {}) {
  const name = String(input.name ?? '').trim();
  const course = String(input.course ?? '').trim();
  const content = String(input.content ?? '').trim();

  if (!name) return fail('name', '请填写姓名');
  if (name.length > LIMITS.nameMax) return fail('name', `姓名最多 ${LIMITS.nameMax} 个字`);
  if (course.length > LIMITS.courseMax) return fail('course', `课程名称最多 ${LIMITS.courseMax} 个字`);
  if (!content) return fail('content', '请填写学习难点或课程困惑');
  if (content.length < LIMITS.contentMin) return fail('content', `内容太短了，至少写 ${LIMITS.contentMin} 个字`);
  if (content.length > LIMITS.contentMax) return fail('content', `内容最多 ${LIMITS.contentMax} 个字`);

  return { ok: true, value: { name, course, content } };
}
