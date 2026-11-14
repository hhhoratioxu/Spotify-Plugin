// Fixed route labels only: no account/device IDs, query strings or headers.
// Kept inside one function because the local-only wrapper serializes it.
export function diagnosticRoute(request) {
  const value = typeof request?.url === 'string' && request.url.length <= 4096 ? request.url : '';
  const match = /^https:\/\/(?:spclient\.wg|[a-z0-9-]+-spclient)\.spotify\.com(?::443)?(\/[^?#]*)/.exec(value);
  const path = match?.[1] || '';
  const rules = [
    ['lyrics', /^\/color-lyrics\/v2\/track\/[0-9A-Za-z]{22}(?:\/image\/[^/\s]+)?\/?$/],
    ['extended-metadata', /^\/extended-metadata\/v0\/extended-metadata\/?$/],
    ['metadata', /^\/metadata\/4\/track\/[0-9a-f]{32}\/?$/],
    ['connect-state', /^\/connect-state\/v1\/devices\/[0-9A-Za-z_-]{16,128}\/?$/],
    ['context-resolve', /^\/context-resolve\/v1\/spotify(?::|%3[aA])[^/\s]{1,512}\/?$/],
    ['player-cards', /^\/scrollsita\/v1\/scroll\/spotify(?::|%3[aA])track(?::|%3[aA])[0-9A-Za-z]{22}\/?$/],
    ['lyrics-entry', /^\/(?:user-customization-service\/v1\/customize|bootstrap\/v1\/bootstrap|v1\/customize)\/?$/]
  ];
  return {
    route: rules.find(([, pattern]) => pattern.test(path))?.[0] || 'other',
    method: /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(request?.method) ? request.method : 'other'
  };
}
