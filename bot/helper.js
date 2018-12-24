function parseTokens(s) {
  const regex = /"[^"]+"|'[^']+'|\S+/g
  const tokens = s.match(regex)
    .map(token => token.trim())
    .map(token => token[0] === '"' ? token.slice(1, -1) : token)
  return tokens
}

function trimAround(s) {
  const trimmed = s.split('\n')
    .map(token => token.trim().length > 0 ? token.trim() : '\n')
    .join('\n')
    .trim()
  return trimmed
}

module.exports = {
  parseTokens,
  trimAround
}
