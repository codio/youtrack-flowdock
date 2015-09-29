// import request from 'superagent'
// import logger from 'superagent-logger'
import debug from 'debug'

const error = debug('MailListener:error')
const log = debug('MailListener:log')

// const TOKEN = process.env.YF_FLOWDOCK_TOKEN

function send (content) {
  log('Sending message')
  log(content)
  // request
  //   .post('https://api.flowdock.com/messages')
  //   .use(logger)
  //   .send({
  //     flow_token: TOKEN
  //     ...content
  //   })
  //   .end((err, res) => {
  //     if (err) {
  //       error('Failed to send to flowdock', err)
  //     }
  //   })
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

function parseBody (action, body) {
  // Find the user
  let user = ''
  log(body)
  if (action === 'created') {
    user = match(body, /New\sissue\swas\sreported\sby\s(.*):/)
  } else {
    user = match(body, /was\supdated\sby\s(.*)\sin\sproject/) ||
      match(body, /User\s(.*)\schanged/)
  }

  if (user == null) {
    error('Could not find any user in\n\n')
    error(body)
  }
  return {
    user: user
  }
}

export function parse (mail) {
  const {action, id, title} = parseSubject(mail.subject)

  const isComment = action === 'commented'
  const {user} = parseBody(action, mail.text)
  const author = {}

  if (user) author.name = user

  return {
    event: isComment ? 'discussion' : 'activity',
    author: author,
    title: `${user} ${action} on Youtrack`,
    external_thread_id: id,
    thread: {
      title: title,
      body: null,
      external_url: `https://codio.myjetbrains.com/youtrack/issue/${id}`
    }
  }
}

export default function (mail, seqno) {
  if (mail.text == null) return

  const result = parse(mail)
  send(result)
}
