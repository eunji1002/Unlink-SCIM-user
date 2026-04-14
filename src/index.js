import Resolver from '@forge/resolver';
import api from '@forge/api';

const resolver = new Resolver();

const ORG_ID = process.env.ORG_ID;
const ORG_API_KEY = process.env.ORG_API_KEY;

async function adminFetch(path, options = {}) {
  return api.fetch(`https://api.atlassian.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ORG_API_KEY}`,
      ...(options.headers || {}),
    },
  });
}

// 1차 테스트용: org 사용자 목록 조회
resolver.define('listOrgUsers', async ({ payload }) => {
  const limit = Math.min(Number(payload?.limit ?? 20), 100);
  const cursor = payload?.cursor;

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);

  const res = await adminFetch(
    `/admin/v1/orgs/${ORG_ID}/users?${params.toString()}`,
    { method: 'GET' }
  );

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: await res.text(),
    };
  }

  const data = await res.json();

  // 응답 구조를 그대로 같이 내려줘서 프론트에서 먼저 확인 가능하게 함
  return {
    ok: true,
    raw: data,
  };
});

export const handler = resolver.getDefinitions();