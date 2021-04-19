module.exports = function injectImports (fileInfo, api, { imports }) {
  const j = api.jscodeshift
  const root = j(fileInfo.source)

  const toImportAST = i => j(`${i}\n`).nodes()[0].program.body[0]
  const toImportHash = node => JSON.stringify({
    specifiers: node.specifiers.map(s => s.local.name),
    source: node.source.raw
  })

  const declarations = root.find(j.ImportDeclaration)
  const importSet = new Set(declarations.nodes().map(toImportHash))
  const nonDuplicates = node => !importSet.has(toImportHash(node))

  const importASTNodes = imports.map(toImportAST).filter(nonDuplicates)

  if (declarations.length) {
    declarations
      .at(-1)
      .forEach(({ node }) => delete node.loc)
      .insertAfter(importASTNodes)
  } else {
    root.get().node.program.body.unshift(...importASTNodes)
  }

  return root.toSource()
}