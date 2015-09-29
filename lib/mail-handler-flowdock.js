import request from 'superagent'
import logger from 'superagent-logger'
import debug from 'debug'
import _ from 'lodash'

const error = debug('MailListener:error')
const log = debug('MailListener:log')

const TOKEN = process.env.YF_FLOWDOCK_TOKEN

const FIELDS = [
  'Priority',
  'Type',
  'State',
  'Action to Take',
  'Assignee',
  'Subsystem',
  'Documentation Required',
  'Due Date',
  'Github Issue',
  '_version',
  'Estimation'
]

function send (content) {
  request
    .post('https://api.flowdock.com/messages')
    .use(logger)
    .send({
      flow_token: TOKEN,
      ...content
    })
    .end((err, res) => {
      if (err) {
        error('Failed to send to flowdock', err)
      }
    })
}

function parseSubject (subject) {
  const res = {
    action: '',
    id: '',
    title: ''
  }

  const parsed = subject.match(
      /\[YouTrack,\s([^\]]+)\]\sIssue\s([^:]+):\s?(.*)/
  ) || subject.match(
      /\[YouTrack,\s([^\]]+)\]\s\w+\s([^:]+):\s?(.*)/
  )

  if (parsed == null) return res

  res.action = (parsed[1] || '').toLowerCase()
  res.id = parsed[2]
  res.title = parsed[3]

  return res
}

function match (content, regex) {
  return (content.match(regex) || [])[1]
}

//
// start has to have the global flag for this to work
//
function between (content, start, end) {
  start.exec(content)
  var i1 = start.lastIndex
  var i2 = content.substring(i1).search(end)

  return content.substring(i1, i1 + i2).trim()
}

function parseBody (action, body, htmlBody) {
  // Find the user
  let user = ''

  if (action === 'created') {
    user = match(body, /Created\sby\s(.*)\s\n/)
  } else {
    user = match(body, /was\supdated\sby\s(.*)\sin\sproject/) ||
      match(body, /User\s(.*)\schanged/)
  }

  if (user == null) {
    error('Could not find any user in\n\n')
    error(body)
  } else {
    user = user.trim()
  }

  // Parse msg
  let msg = null

  if (action === 'created' || action === 'commented') {
    msg = between(htmlBody, /<div\sclass="wiki\stext">/g, /<\/td>/).trim()
    msg = msg.replace(/<\/div>\n?\s?$/, '').trim()
  }
  log(msg)

  // parse view link
  let link

  if (action === 'commented') {
    link = match(htmlBody, /href="(.*)">\n?\s*View\s*<\/a>/)
  }

  log(link)

  // Parse status
  let status

  if (action === 'created') {
    status = {
      color: 'green',
      value: 'open'
    }
  } else if (action === 'resolved') {
    status = {
      color: 'red',
      value: 'resolved'
    }
  }

  // Parse fields
  let fields
  const arrow = /[^\u0000-\u0080]+/

  if (action === 'updated') {
    fields = body.split('\n').filter(line => {
      // Matches any non ascii code point, used to find
      // the arrows ->
      return line.match(arrow)
    }).map(line => {
      const label = _.find(FIELDS, field => line.match(new RegExp(`^${field}`)))
      const value = line.substring(line.match(arrow).index + 1).trim()
      return {
        label: label,
        value: value
      }
    })
  } else if (action === 'created') {
    fields = body.split('\n').filter(line => {
      return _.any(FIELDS.map(field => {
        return line.match(new RegExp(`^${field}`))
      }))
    }).map(line => {
      const label = _.find(FIELDS, field => line.match(new RegExp(`^${field}`)))
      const value = line.replace(label, '').trim()
      return {
        label: label,
        value: value
      }
    })
  }

  return {
    user: user,
    msg: msg,
    status: status,
    fields: fields,
    link: link
  }
}

export function parse (mail, seqno) {
  const {action, id, title} = parseSubject(mail.subject)

  const isComment = action === 'commented'
  const {user, msg, status, fields, link} = parseBody(action, mail.text, mail.html)
  const author = {}

  if (user) author.name = user

  const res = {
    event: isComment ? 'discussion' : 'activity',
    author: author,
    title: isComment && link ? `<a href="${link}">${action}</a>` : action,
    external_thread_id: id,
    thread: {
      title: `${id} - ${title}`,
      external_url: `https://codio.myjetbrains.com/youtrack/issue/${id}`
    }
  }

  if (status) res.thread.status = status

  if (action === 'created') res.thread.body = msg
  else if (msg) res.body = msg

  if (fields) res.thread.fields = fields

  return res
}

export default function (mail, seqno) {
  if (mail.text == null) return

  const result = parse(mail, seqno)
  log(result)
  send(result)
}
