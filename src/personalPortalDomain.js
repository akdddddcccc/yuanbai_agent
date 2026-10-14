// Only the user's confirmed personal host receives this visual revision.
// Every other production host, including academy deployments, retains Portal.
export function usePersonalPortal(hostname, development = false) {
  return hostname === 'apps-demo.muyang23333.top'
    || (development && ['localhost', '127.0.0.1', '[::1]'].includes(hostname));
}
