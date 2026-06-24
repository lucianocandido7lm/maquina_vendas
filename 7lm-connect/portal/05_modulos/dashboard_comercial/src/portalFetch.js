const TOKEN_KEYS = ['sevenlm_connect_token_de_acesso'];

const readToken = () => {
  try {
    for (const key of TOKEN_KEYS) {
      const token = window.sessionStorage?.getItem(key);
      if (token) return token;
    }
  } catch {
    return '';
  }
  return '';
};

export const installPortalFetch = () => {
  if (typeof window === 'undefined' || window.__sevenLmDashboardFetchInstalled) return;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    const isPortalApi = typeof url === 'string' && (
      url.startsWith('/api/') ||
      url.startsWith(`${window.location.origin}/api/`)
    );

    if (!isPortalApi) {
      return nativeFetch(input, init);
    }

    const token = readToken();
    const headers = new Headers(init?.headers || (typeof input !== 'string' ? input?.headers : undefined) || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return nativeFetch(input, {
      ...init,
      credentials: init?.credentials || 'same-origin',
      headers,
    });
  };

  window.__sevenLmDashboardFetchInstalled = true;
};
