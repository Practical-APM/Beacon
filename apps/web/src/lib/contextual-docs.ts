/** Map app routes to the most relevant docs walkthrough. */
export function contextualDocsGuide(pathname: string, search = ''): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (pathname.startsWith('/integrations')) {
    return '/docs?guide=connect-stack&step=0';
  }
  if (pathname.startsWith('/projects/')) {
    return '/docs?guide=triage-risk&step=1';
  }
  if (pathname.startsWith('/dashboard')) {
    return '/docs?guide=triage-risk&step=0';
  }
  if (pathname.startsWith('/settings')) {
    const tab = new URLSearchParams(query).get('tab');
    if (tab === 'privacy') return '/docs#privacy';
    if (tab === 'notifications') return '/docs?guide=triage-risk&step=2';
    return '/docs#settings';
  }
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/select-org')) {
    return '/docs?guide=try-prototype&step=0';
  }
  return '/docs';
}

export function contextualDocsLabel(pathname: string, search = ''): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (pathname.startsWith('/integrations')) return 'Setup guide';
  if (pathname.startsWith('/projects/')) return 'Triage guide';
  if (pathname.startsWith('/dashboard')) return 'Dashboard guide';
  if (pathname.startsWith('/settings')) {
    const tab = new URLSearchParams(query).get('tab');
    if (tab === 'privacy') return 'Privacy docs';
    if (tab === 'notifications') return 'Alert guide';
    return 'Settings docs';
  }
  return 'Documentation';
}
