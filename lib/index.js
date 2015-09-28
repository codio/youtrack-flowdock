import Listener from './mail-listener'
import flowdockMailHandler from './mail-handler-flowdock'

// Start everything

const {env} = process

const listener = new Listener({
  username: env.YF_EMAIL_USER,
  password: env.YF_EMAIL_PASS
})

listener.on('mail', flowdockMailHandler)
