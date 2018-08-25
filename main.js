const express = require('express')
var admin = require('firebase-admin')
const bodyParser = require('body-parser');

// Firebase setup
const serviceAccount = require('./serviceAccountKey.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://rapid-14d88.firebaseio.com'
})

var app = express()
app.use(bodyParser.json())

app.get('/', (req, res) => res.send('Rapid API is up and running!'))

app.post('/api/groups', (req, res) => {
  // Get a key for a new group
  var groupId = admin.database().ref().child('groups').push().key
  console.log(req.body)

  // Can do batch updates
  var updates = {}
  updates['/groups/' + groupId] = req.body

  admin.database().ref().update(updates)
  res.send({'id': groupId})
})

app.get('/api/groups/:groupId', (req, res) => {
  groupId = req.params['groupId']

  admin.database().ref('/groups/' + groupId).once('value').then((snap) => {
    res.send(snap.val())
  })
})

app.listen(3000, () => console.log('Example app listening on port 3000!'))