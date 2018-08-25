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


// User Routes

// Add user to group
app.post('/api/users/:userId/addGroup', (req, res) => {
  userId = req.params['userId']
  groupId = req.query.groupId
  console.log(groupId)
  data = {
    'userName': req.body['userName'],
    'groupName': req.body['groupName']
  }
  
  updates = {}
  updates['/groups/' + groupId + '/users/' + userId] = data.userName  
  updates['/users/' + userId + '/groups/' + groupId] = data.groupName
  admin.database().ref().update(updates)

  res.send({'Success': data.userName + ' was added to: ' + data.groupName + '.'})
})

// Contribute to pool
app.post('/api/users/:userId/contribute', (req, res) => {
  const userId = req.params['userId']
  data = {
    'userId': userId,
    'groupId': req.body['groupId'],
    'amount': req.body['amount']
  }
  const transId = admin.database().ref().child('transctions').push().key

  // Update transactions for relevant tables
  var updates = {}
  updates['/transactions/' + transId] = data
  updates['/groups/' + data.groupId + '/transactions/' + transId] = data
  updates['/users/' + userId +  '/transactions/' + transId] = data
  admin.database().ref().update(updates)
  
  // Update table funds
  admin.database().ref('/groups/' + data.groupId + '/funds').once('value').then((snap) => {
    update = {}
    update['/groups/' + data.groupId + '/funds'] = parseFloat(snap.val()) + parseFloat(data.amount)
    admin.database().ref().update(update)
  })

  res.send({'Success': 'Transaction: ' + transId + ' was processed.'})
})

// Get all users
app.get('/api/users', (req, res) => {
  admin.database().ref().child('users').once('value').then((snap) => {
    res.send(snap.val())
  })
})

// Get user by id
app.get('/api/users/:userId', (req, res) => {
  userId = req.params['userId']

  admin.database().ref('/users/' + userId).once('value').then((snap) => {
    res.send(snap.val())
  })
})

// Add user
app.post('/api/users', (req, res) => {
  data = {
    'name': req.body['name']
  }

  const userId = insert('users', data)
  res.send({'id': userId})
})

// Update user
app.put('api/users/:userId', (req, res) => {
  const userId = req.params['userId']
  data = {
    'name': req.body['name']
  }

  admin.database().ref('users/' + userId).set(data)
  res.send({'id': userId})
})


// Group Routes

// Get all groups
app.get('/api/groups', (req, res) => {
  admin.database().ref('/groups').once('value').then((snap) => {
    res.send(snap.val())
  })
})

// Get group by id
app.get('/api/groups/:groupId', (req, res) => {
  groupId = req.params['groupId']

  admin.database().ref('/groups/' + groupId).once('value').then((snap) => {
    res.send(snap.val())
  })
})

// Add group
app.post('/api/groups', (req, res) => {
  data = {
    'name': req.body['name'],
    'funds': 0
  }

  const groupId = insert('groups', data)
  res.send({'id': groupId})
})

// Update group
app.put('api/groups/:groupId', (req, res) => {
  const groupId = req.params['groupId']
  data = {
    'name': req.body['name'],
    'funds': req.funds['funds']
  }

  admin.database().ref('groups/' + groupId).set(data)
  res.send({'id': groupId})
})

// Get Transactions
app.get('/api/transactions', (req, res) => {
  admin.database().ref('/transactions').once('value').then((snap) => {
    res.send(snap.val())
  })
})

// Clear database
app.delete('/api/clear', (req, res) => {
  updates = {}
  updates['/groups'] = null
  updates['/users'] = null
  updates['/transactions'] = null
  admin.database().ref().update(updates)

  res.send({'Success': 'Database cleared.'})
})

function insert(dbName, data) {
  var id = admin.database().ref().child(dbName).push().key

  var update = {}
  update['/' + dbName + '/' + id] = data
  
  admin.database().ref().update(update)
  return id
}

app.listen(3000, () => console.log('Example app listening on port 3000!'))