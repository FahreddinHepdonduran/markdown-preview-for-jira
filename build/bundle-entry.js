import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import taskLists from 'markdown-it-task-lists'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'

// Common languages — keeps the bundle reasonable while covering ~everything
// people put in a README or a ticket attachment.
const langs = {
  bash: () => import('highlight.js/lib/languages/bash'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  css: () => import('highlight.js/lib/languages/css'),
  diff: () => import('highlight.js/lib/languages/diff'),
  dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
  go: () => import('highlight.js/lib/languages/go'),
  graphql: () => import('highlight.js/lib/languages/graphql'),
  groovy: () => import('highlight.js/lib/languages/groovy'),
  ini: () => import('highlight.js/lib/languages/ini'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  less: () => import('highlight.js/lib/languages/less'),
  lua: () => import('highlight.js/lib/languages/lua'),
  makefile: () => import('highlight.js/lib/languages/makefile'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  nginx: () => import('highlight.js/lib/languages/nginx'),
  objectivec: () => import('highlight.js/lib/languages/objectivec'),
  perl: () => import('highlight.js/lib/languages/perl'),
  php: () => import('highlight.js/lib/languages/php'),
  plaintext: () => import('highlight.js/lib/languages/plaintext'),
  powershell: () => import('highlight.js/lib/languages/powershell'),
  properties: () => import('highlight.js/lib/languages/properties'),
  python: () => import('highlight.js/lib/languages/python'),
  r: () => import('highlight.js/lib/languages/r'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rust: () => import('highlight.js/lib/languages/rust'),
  scala: () => import('highlight.js/lib/languages/scala'),
  scss: () => import('highlight.js/lib/languages/scss'),
  shell: () => import('highlight.js/lib/languages/shell'),
  sql: () => import('highlight.js/lib/languages/sql'),
  swift: () => import('highlight.js/lib/languages/swift'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  xml: () => import('highlight.js/lib/languages/xml'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
}

async function registerLanguages () {
  await Promise.all(Object.entries(langs).map(async ([name, load]) => {
    const mod = await load()
    hljs.registerLanguage(name, mod.default)
  }))
  hljs.registerAliases(['js', 'mjs', 'cjs'], { languageName: 'javascript' })
  hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' })
  hljs.registerAliases(['py'], { languageName: 'python' })
  hljs.registerAliases(['sh', 'zsh', 'console'], { languageName: 'bash' })
  hljs.registerAliases(['yml'], { languageName: 'yaml' })
  hljs.registerAliases(['html', 'svg'], { languageName: 'xml' })
  hljs.registerAliases(['md'], { languageName: 'markdown' })
  hljs.registerAliases(['cs'], { languageName: 'csharp' })
  hljs.registerAliases(['tf', 'hcl', 'toml'], { languageName: 'ini' })
}

window.MDP = { MarkdownIt, anchor, taskLists, DOMPurify, hljs, registerLanguages }
