function preloadCSS(html: string): string {
  return html.replace(
    /<link rel="stylesheet" href="(.*)">/g,
    `
    <link rel="preload" as="style" href="$1" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="$1"></noscript>
  `
  )
}


export function preloadCSSPlugin() {
  return {
    name: 'preload-css-plugin',
    transformIndexHtml: (html: string) => preloadCSS(html)
  }
}
