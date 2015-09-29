import {EventEmitter} from 'events'
import MailListener from 'mail-listener3'
import debug from 'debug'

const error = debug('MailListener:error')
const log = debug('MailListener:log')

export default class Listener extends EventEmitter {
  constructor (config) {
    super()

    this._listener = new MailListener({
      username: '',
      password: '',
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false
      },
      mailbox: 'INBOX',
      searchFilter: [
        ['FROM', 'no_reply@jetbrains.com'],
        'UNSEEN'
      ],
      markSeen: true,
      fetchUnreadOnStart: true,
      attachments: false,
      ...config
    })

    this._listener.on('server:connected', this._onConnected)
    this._listener.on('server:disconnected', this._onDisconnected)
    this._listener.on('error', this._onError)
    this._listener.on('mail', this._onMail)
    this._listener.on('done', this._onDone)

    this._listener.start()
  }

  _onConnected = () => {
    log('IMAP Connection established')
  }

  _onDisconnected = () => {
    log('IMAP Connection terminated')
  }

  _onError = err => {
    error(err)
  }

  _onMail = (mail, seqno, attributes) => {
    log('Got mail %s', seqno)

    this.emit('mail', mail, seqno)
  }

  _onDone = () => {
    log('All messages processed')
  }

  stop () {
    this._listener.stop()
  }
}
