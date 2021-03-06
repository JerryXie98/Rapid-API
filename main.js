const express = require('express')
var admin = require('firebase-admin')
const bodyParser = require('body-parser')
var paypal = require('paypal-rest-sdk')

// Firebase setup
const config = {
  "type": process.env.TYPE,
  "project_id": process.env.PROJECT_ID,
  "private_key_id": process.env.PRIVATE_KEY_ID,
  "private_key": JSON.parse(process.env.PRIVATE_KEY),
  "client_email": process.env.CLIENT_EMAIL,
  "client_id": process.env.CLIENT_ID,
  "auth_uri": process.env.AUTH_URI,
  "token_uri": process.env.TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER,
  "client_x509_cert_url": process.env.CLIENT_CERT
}
admin.initializeApp({
  credential: admin.credential.cert(config),
  databaseURL: 'https://rapid-14d88.firebaseio.com'
})

// paypal.configure({
//   'mode': 'sandbox', //sandbox or live
//   'client_id': process.env.PAYPAL_CLIENT,
//   'client_secret': process.env.PAYPAL_SECRET
// })

var app = express()
app.use(bodyParser.json())

app.get('/', (req, res) => res.send('Rapid API is up and running! ' + config['private_key']))

app.get('/api/login', (req, res) => {
  email = req.query['email']
  password = req.query['password']

  admin.database().ref().child('users').once('value').then((snap) => {
    data = snap.val()
    filtered = Object.keys(data).forEach(el => {
      if (data[el]['email'] == email) {
        if (data[el]['password'] == password) {
          res.send({'user': data[el]})
        } else {
          res.status(401).send({'Error': 'Authentication failed.'})
        }
      }
    })
    res.status(404).send({'Error': 'No user found.'})
  })
})

// User Routes

// Add user to group
app.post('/api/users/:userId/addGroup', async (req, res) => {
  const userId = req.params['userId']
  const groupId = req.query['groupId']
  
  let user = await admin.database().ref('/users/' + userId).once('value')
  let group = await admin.database().ref('/groups/' + groupId).once('value')
  
  let updates = {}
  updates['/groups/' + groupId + '/users/' + userId] = {'name': user.val()['name'], 'email': user.val()['email']}
  updates['/users/' + userId + '/groups/' + groupId] = {'name': group.val()['name'], 'funds': group.val()['funds']}
  admin.database().ref().update(updates)

  res.send({'Success': user.val()['name'] + ' was added to: ' + group.val()['name'] + '.'})
})

// Contribute to pool
app.post('/api/users/:userId/contribute', async (req, res) => {
  const userId = req.params['userId']
  data = {
    'userId': userId,
    'groupId': req.body['groupId'],
    'amount': req.body['amount']
  }
  const transId = admin.database().ref().child('transctions').push().key

  // Update table funds
  let groupFunds = await admin.database().ref('/groups/' + data.groupId + '/funds').once('value')
  let userFunds = await admin.database().ref('/users/' + data.userId + '/funds').once('value')
  const newGroupFund = parseFloat(groupFunds.val()) + parseFloat(data.amount)
  const newUserFund = parseFloat(userFunds.val()) - parseFloat(data.amount)

  if (newUserFund > 0) {
    updates = {}
    updates['/groups/' + data.groupId + '/funds'] = newGroupFund
    updates['/users/' + data.userId + '/funds'] = newUserFund
    admin.database().ref().update(updates)

    // Add transaction
    var trans = {}
    trans['/transactions/' + transId] = data
    trans['/groups/' + data.groupId + '/transactions/' + transId] = data
    trans['/users/' + userId +  '/transactions/' + transId] = data
    admin.database().ref().update(trans)

    // Update group info under users
    userUpdates = {}
    let users = await admin.database().ref('/groups/' + data.groupId + '/users').once('value')
    let groupName = await admin.database().ref('/groups/' + data.groupId + '/name').once('value') 
    const userIdArray = Object.keys(users.val())
    userIdArray.forEach(uid => {
      userUpdates['/users/' + uid + '/groups/' + data.groupId] = {'name': groupName.val(), 'funds': newGroupFund}
    })
    admin.database().ref().update(userUpdates)

    res.send({'Success': 'Transaction: ' + transId + ' was processed.'})
  } else {
    res.status(422).send({'Error': 'Insufficient funds.'})
  }
})

// Get all users
app.get('/api/users', (req, res) => {
  email = req.query['email']

  admin.database().ref().child('users').once('value').then((snap) => {
    if (email) {
      data = snap.val()
      filtered = Object.keys(data).filter(el => data[el]['email'] == email)
      if (filtered.length == 1) {
        res.send(data[filtered[0]])
      } else {
        res.status(404).send({'Error': 'No single user with email: ' + email + ' found.'})
      }
      res.send(Object.keys(data).filter(el => data[el]['email'] == email))
    } else {
      res.send(snap.val())
    }
  })
})

// Get user by id
app.get('/api/users/:userId', (req, res) => {
  userId = req.params['userId']

  admin.database().ref('/users/' + userId).once('value').then((snap) => {
    if (snap.val() != null) {
      res.send(snap.val())
    } else {
      res.status(404).send({'Error': 'No user found.'})
    }
  })
})

// Add user
app.post('/api/users', (req, res) => {
  data = {
    'name': req.body['name'],
    'email': req.body['email'],
    'password': req.body['password'],
    'funds': req.body['funds']
  }

  const userId = insert('users', data)
  res.send({'id': userId})
})

// Update user
app.put('/api/users/:userId', (req, res) => {
  const userId = req.params['userId']
  data = {
    'name': req.body['name'],
    'email': req.body['email'],
    'password': req.body['password'],
    'funds': req.body['funds']
  }

  admin.database().ref('/users/' + userId).set(data)
  res.send({'id': userId})
})

// Delete user
app.delete('/api/users/:userId', (req, res) => {
  const userId = req.params['userId']
  let updates = {}
  updates['/users/' + userId] = null
  admin.database().ref().update(updates)

  res.send({'Success': 'Group removed.'})
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
    if (snap.val() != null) {
      res.send(snap.val())
    } else {
      res.status(404).send({'Error': 'No group found.'})
    }
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
app.put('/api/groups/:groupId', (req, res) => {
  const groupId = req.params['groupId']
  data = {
    'name': req.body['name'],
    'funds': req.funds['funds']
  }

  admin.database().ref('/groups/' + groupId).set(data)
  res.send({'id': groupId})
})

// Delete group
app.delete('/api/groups/:groupId', (req, res) => {
  const groupId = req.params['groupId']
  let updates = {}
  updates['/groups/' + groupId] = null
  admin.database().ref().update(updates)

  res.send({'Success': 'Group removed.'})
})

// Get Transactions
app.get('/api/transactions', (req, res) => {
  admin.database().ref('/transactions').once('value').then((snap) => {
    res.send(snap.val())
  })
})

// Get Transction by Id
app.get('/api/transactions/:transId', (req, res) => {
  transId = req.params['transId']

  admin.database().ref('/transactions/' + transId).once('value').then((snap) => {
    if (snap.val() != null) {
      res.send(snap.val())
    } else {
      res.status(404).send({'Error': 'No transaction found.'})
    }
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

// Clear element
// Example: users/aweduasi13 delete user with that id: aweduasi13
app.delete('/api/clear/:elementString', (req, res) => {
  const elementString = req.params['elementString']
  let updates = {}
  updates['/' + elementString]
  admin.database().ref().update(updates)

  res.send({'Success': 'Element cleared.'})
})

function insert(dbName, data) {
  var id = admin.database().ref().child(dbName).push().key

  var update = {}
  update['/' + dbName + '/' + id] = data
  
  admin.database().ref().update(update)
  return id
}

app.listen(process.env.PORT ? process.env.PORT : 3000, () => console.log('Example app listening on port 3000!'))