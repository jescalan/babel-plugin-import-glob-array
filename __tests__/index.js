const babel = require('babel-core')
const plugin = require('../')
const fs = require('fs')
const path = require('path')

it('works', () => {
  const { content, filename } = loadFixture('basic')
  const { code } = babel.transform(content, { plugins: [plugin], filename })
  expect(code).toMatchSnapshot()
})

function loadFixture(name) {
  const filename = path.join(__dirname, `fixtures/${name}.js`)
  return { content: fs.readFileSync(filename, 'utf8'), filename }
}
