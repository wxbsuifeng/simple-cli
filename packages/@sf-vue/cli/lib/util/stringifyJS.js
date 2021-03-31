module.exports = function stringifyJS (value) {
  //stringify  将value转化为 string （{} => '{}'）
  const stringify = require('javascript-stringify')
  return stringify(value, (val, indent, stringify) => {
    if (val && val.__expression) {
      return val.__expression
    }
    return stringify(val)
  }, 2)
}