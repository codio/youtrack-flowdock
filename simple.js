import request from 'superagent'

const id = 'codio-6471'

request
  .post('https://api.flowdock.com/messages')
  .send({
    flow_token: process.env.YF_FLOWDOCK_TOKEN,
    event: 'activity',
    author: {
      name: 'Friedel Ziegelmayer'
    },
    external_thread_id: id,
    title: 'changed status',
    thread: {
      title: 'Test Issue Number 2',
      external_url: `https://codio.myjetbrains.com/youtrack/issue/${id}`,
      fields: [{label: 'Type', value: 'Do it'}]
    }
  })
  .end((err, res) => {
    if (err) {
      console.error('Failed to send to flowdock', err)
    }
  })
