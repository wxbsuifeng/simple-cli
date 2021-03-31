module.exports = function extendJSConfig (value, source) {
  //ast相关操作
  const recast = require('recast')
  const stringifyJS = require('./stringifyJS')

  let exportsIndentifier = null

  const ast = recast.parse(source)

  recast.types.visit(ast, {
    visitAssignmentExpression (path) {
      const { node } = path
      if(
        node.left.type === 'MemberExpression' &&
        node.left.object.name === 'module' &&
        node.left.property.name === 'exports'
      ) {
        if(node.right.type === 'ObjectExpression') {
          augmentExports(node.right)
        } else if (node.right.type === 'Identifier') {
          exportsIndentifier = node.right.name
        }
        return false
      }
      this.traverse(path)
    }
  })

  if(exportsIndentifier) {
    recast.types.visit(ast, {
      visitVariableDeclarator ({ node }) {
        if(
          node.id.name === exportsIndentifier &&
          node.init.type === 'ObjectExpression'
        ) {
          augmentExports(node.init)
        }
        return false
      }
    })
  }

  function augmentExports (node) {
    const valueAST = recast.parse(`(${stringifyJS(value, null, 2)})`)
    const props = valueAST.program.body[0].expression.properties
    const existingProps = node.properties
    for(const prop of props) {
      const isUndefinedProp = 
        prop.value.type === 'Indentifier' && prop.value.name === 'undefined'

      const existing = existingProps.findIndex(p => {
        return !p.computed && p.key.name === prop.key.name
      })
      if(existing > -1) {
        existingProps[existing].value = prop.value

        if(isUndefinedProp) {
          existingProps.splice(existing, 1)
        }
      } else if (!isUndefinedProp) {
        existingProps.push(prop)
      }
    }
  }

  return recast.print(ast).code
}