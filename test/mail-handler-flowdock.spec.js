import fs from 'fs'
import {expect} from 'chai'

import {parse} from'../lib/mail-handler-flowdock'

function read (path) {
  return JSON.parse(fs.readFileSync(path).toString())
}

describe('MailHandler Flowdock', () => {
  const files = fs.readdirSync('./test/fixtures')
  const actual = files.filter(elem => elem.match(/^actual/))

  actual.forEach(fileName => {
    const input = read(`./test/fixtures/${fileName}`)
    const expected = read(`./test/fixtures/${fileName.replace(/^actual/, 'expected')}`)

    it(`handles ${fileName.replace(/^actual-/, '').replace(/\.json/, '')}`, () => {
      expect(parse(input)).to.be.eql(expected)
    })
  })
})
