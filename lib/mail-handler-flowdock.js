import request from 'superagent'
import logger from 'superagent-logger'
import debug from 'debug'
import jsdom from 'jsdom'
import {readFileSync} from 'fs'

const error = debug('MailListener:error')
const log = debug('MailListener:log')

const TOKEN = process.env.YF_FLOWDOCK_TOKEN

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

function parseBody (body) {
  log(body)
  jsdom.env(body, (err, window) => {
    if (err) return error(err)

    log(window.document.getElementsByTagName('table').text)
  })

  return {
    user: 'me'
  }
}

export default function (mail) {
  // Ignore all non html emails
  if (mail.html == null) return

  const {action, id, title} = parseSubject(mail.subject)

  const isComment = action === 'commented'
  const {user} = parseBody(mail.html)

  send({
    event: isComment ? 'discussion' : 'activity',
    author: {
      name: user
    },
    title: `${user} ${action} on Youtrack`,
    external_thread_id: id,
    thread: {
      title: title,
      body: null,
      external_url: `https://codio.myjetbrains.com/youtrack/issue/${id}`
    }
  })
}
