import Resolver from '@forge/resolver';
import api from '@forge/api';

const resolver = new Resolver();

const ORG_ID = process.env.ORG_ID;
const ORG_API_KEY = process.env.ORG_API_KEY;
const MAX_PICKER_USERS = 500;
const PAGE_SIZE = 100;

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

function extractCursor(nextLinkOrCursor) {
  if (!nextLinkOrCursor) {
    return null;
  }

  if (!String(nextLinkOrCursor).includes('cursor=')) {
    return nextLinkOrCursor;
  }

  try {
    const url = new URL(nextLinkOrCursor);
    return url.searchParams.get('cursor');
  } catch (error) {
    return nextLinkOrCursor;
  }
}

function mapOrgUser(user) {
  const accountId = user.accountId || user.account_id;
  const displayName =
    user.name ||
    user.displayName ||
    user.nickname ||
    user.publicName ||
    user.email ||
    accountId;

  const secondaryText =
    user.email ||
    user.emailAddress ||
    accountId;

  return {
    accountId,
    displayName,
    secondaryText,
    accountStatus: user.accountStatus || user.account_status || user.status || 'unknown',
    accountType: user.accountType || user.account_type || 'unknown',
  };
}

async function getScimLinksForEmail(email) {
  const res = await adminFetch(
    `/admin/user-provisioning/v1/org/${ORG_ID}/get-scim-links-for-email`,
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: await res.text(),
    };
  }

  const data = await res.json();

  return {
    ok: true,
    scimLinks: Array.isArray(data?.scimLinks) ? data.scimLinks : [],
  };
}

async function unlinkScimUser({ scimDirectoryId, scimUserId }) {
  const res = await adminFetch(
    `/admin/user-provisioning/v1/org/${ORG_ID}/scimDirectoryId/${scimDirectoryId}/scimUserId/${scimUserId}/unlink`,
    {
      method: 'PATCH',
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: await res.text(),
    };
  }

  return {
    ok: true,
  };
}

resolver.define('getOrgUsersForPicker', async () => {
  if (!ORG_ID || !ORG_API_KEY) {
    return {
      ok: false,
      error: 'ORG_ID or ORG_API_KEY is missing.',
    };
  }

  const users = [];
  let cursor = null;
  let hasMore = false;

  do {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));

    if (cursor) {
      params.set('cursor', cursor);
    }

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
    const pageUsers = Array.isArray(data?.data) ? data.data : [];

    users.push(...pageUsers.map(mapOrgUser));

    cursor = extractCursor(data?.links?.next);
    hasMore = Boolean(cursor);
  } while (cursor && users.length < MAX_PICKER_USERS);

  const uniqueUsers = Array.from(
    new Map(
      users
        .filter((user) => Boolean(user.accountId))
        .map((user) => [user.accountId, user])
    ).values()
  );

  return {
    ok: true,
    users: uniqueUsers.slice(0, MAX_PICKER_USERS),
    hasMore,
    truncated: uniqueUsers.length >= MAX_PICKER_USERS,
  };
});

resolver.define('unlinkSelectedUsers', async ({ payload }) => {
  if (!ORG_ID || !ORG_API_KEY) {
    return {
      ok: false,
      error: 'ORG_ID or ORG_API_KEY is missing.',
    };
  }

  const users = Array.isArray(payload?.users) ? payload.users : [];

  if (users.length === 0) {
    return {
      ok: false,
      error: 'No users were provided for unlink.',
    };
  }

  const results = [];

  // Unlinking changes identity state, so we keep this flow sequential and
  // capture a clear per-user outcome for the admin page.
  for (const user of users) {
    const email = user?.email || user?.secondaryText;
    const accountId = user?.accountId;
    const displayName = user?.displayName || email || accountId || 'Unknown user';

    if (!email) {
      results.push({
        accountId,
        displayName,
        ok: false,
        message: 'Email is missing, so SCIM link lookup could not run.',
      });
      continue;
    }

    const scimLookup = await getScimLinksForEmail(email);

    if (!scimLookup.ok) {
      results.push({
        accountId,
        displayName,
        ok: false,
        message: `SCIM link lookup failed (${scimLookup.status ?? 'unknown'}).`,
        details: scimLookup.error,
      });
      continue;
    }

    const matchingLink = scimLookup.scimLinks.find(
      (link) => link.atlassianAccountId === accountId
    );
    const scimLink =
      matchingLink ||
      (scimLookup.scimLinks.length === 1 ? scimLookup.scimLinks[0] : null);

    if (!scimLink) {
      results.push({
        accountId,
        displayName,
        ok: false,
        message: 'No matching SCIM link was found for this user.',
      });
      continue;
    }

    const unlinkResult = await unlinkScimUser({
      scimDirectoryId: scimLink.directoryId,
      scimUserId: scimLink.scimUserId,
    });

    if (!unlinkResult.ok) {
      results.push({
        accountId,
        displayName,
        ok: false,
        message: `SCIM unlink failed (${unlinkResult.status ?? 'unknown'}).`,
        details: unlinkResult.error,
      });
      continue;
    }

    results.push({
      accountId,
      displayName,
      ok: true,
      message: 'SCIM unlink completed.',
    });
  }

  return {
    ok: true,
    results,
    summary: {
      total: results.length,
      succeeded: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
    },
  };
});

export const handler = resolver.getDefinitions();
