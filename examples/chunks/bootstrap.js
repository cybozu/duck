(() => {
  const [, basename] = /([^/]*).html$/.exec(location.pathname);
  const params = new URLSearchParams();
  params.set('id', basename);
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode) {
    params.set('mode', mode);
  } else {
    params.set('mode', 'RAW');
  }
  const url = new URL('http://localhost:9810/compile');
  url.search = params.toString();
  document.write(`<script src="${url}"></script>`);
})();
