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
  log('Sending message')
  log(content)
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
  var i2 = content.search(end)

  return content.substring(i1, i2).trim()
}

function parseBody (action, body) {
  // Find the user
  let user = ''
  log(body)
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

  if (action === 'commented') {
    msg = between(body, /Created\sby\s.*\n/g, /<\s.*\s>View</)
  } else if (action === 'created') {
    msg = between(body, /Created\sby\s.*\n/g, /Priority\s/)
  }

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
    const lines = body.split('\n')
    fields = lines.filter(line => {
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
  }

  return {
    user: user,
    msg: msg,
    status: status,
    fields: fields
  }
}

export function parse (mail) {
  const {action, id, title} = parseSubject(mail.subject)

  const isComment = action === 'commented'
  const {user, msg, status, fields} = parseBody(action, mail.text)
  const author = {}

  if (user) author.name = user

  const res = {
    event: isComment ? 'discussion' : 'activity',
    author: author,
    title: `${action} on Youtrack`,
    external_thread_id: id,
    thread: {
      title: title,
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

  const result = parse(mail)
  send(result)
}
