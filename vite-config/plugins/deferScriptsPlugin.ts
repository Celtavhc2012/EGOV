function deferNonCriticalJS(html: string): string {
  const jsRegex = /\n.*<script type="module" /
  const nonCriticalJs = html.match(jsRegex)
  if (nonCriticalJs === null) {
    return html
  }

  const deferredJs = nonCriticalJs[0] + 'defer '

  return html.replace(jsRegex, deferredJs)
}


export function deferScripsPlugin() {
  return {
    name: 'defer-scripts-plugin',
    transformIndexHtml: (html: string) => deferNonCriticalJS(html)
  }
}
