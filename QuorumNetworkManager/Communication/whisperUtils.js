var crypto = require('crypto')
var fs = require('fs')
var path = require('path')

var config = require('../config.js')

function getSymmetricKey(shh, cb){
  if(config.whisper.symKeyID){
    cb(null, config.whisper.symKeyID)
  } else {
    shh.generateSymKeyFromPassword(
      config.whisper.symKeyPassword, function(err, id){
      config.whisper.symKeyID = id
      cb(err, config.whisper.symKeyID)
    })
  }
}

async function encryptAndSaveWhisperKeys(whisperId, shh){
  return new Promise(async function(resolve, reject){
    let publicKey = await shh.getPublicKey(whisperId)       
    let privateKey = await shh.getPrivateKey(whisperId)       
    let stringObj = JSON.stringify({ whisperId, publicKey, privateKey })
    let cipher = crypto.createCipher('aes192', config.whisper.diskEncryptionPassword)
    let encryptedObj = cipher.update(stringObj, 'utf8', 'hex')
    encryptedObj += cipher.final('hex')
    let relativePath = config.whisper.diskEncryptionDirectory
    if (!fs.existsSync(relativePath)){
      fs.mkdirSync(relativePath)
    }
    fs.writeFileSync(path.join(relativePath, config.whisper.diskEncryptionFileName), encryptedObj)
    resolve(true)
  })
}

async function readAndDecryptWhisperKeys(shh){
  return new Promise(async function(resolve, reject){
    let filePath = path.join(config.whisper.diskEncryptionDirectory, config.whisper.diskEncryptionFileName)
    let fileContents = fs.readFileSync(filePath, 'utf8')
    let decipher = crypto.createDecipher('aes192', config.whisper.diskEncryptionPassword)
    let stringObj = decipher.update(fileContents, 'hex', 'utf8')
    stringObj += decipher.final('utf8')
    let obj = JSON.parse(stringObj)
    resolve(obj)
  })
}

async function getAsymmetricKey(shh, cb){
  let filePath = path.join(config.whisper.diskEncryptionDirectory, config.whisper.diskEncryptionFileName)
  if(config.whisper.asymKeyID){
    await encryptAndSaveWhisperKeys(config.whisper.asymKeyID, shh)
    cb(null, config.whisper.asymKeyID)
  } else if(fs.existsSync(filePath)){
    let keys = await readAndDecryptWhisperKeys(shh)
    let whisperId = await shh.addPrivateKey(keys.privateKey)
    config.whisper.asymKeyID = whisperId
    cb(null, config.whisper.asymKeyID)
  } else {
    shh.newKeyPair(async function(err, id){
      await encryptAndSaveWhisperKeys(id, shh)
      config.whisper.asymKeyID = id
      cb(err, config.whisper.asymKeyID)
    })
  }
}

function addSubscription(symKeyID, topicArr, shh, onData){
  let topics = buildFilterObject(topicArr).topics
  let subscription = shh.subscribe('messages', {topics, symKeyID})
  subscription.on('data', onData)
  subscription.on('error', function(error){
    console.log('addSubscription ERROR:', error)
  })
  return subscription
}

function addBootstrapSubscription(topics, shh, onData, cb){
  getSymmetricKey(shh, function(err, symKeyID){
    if(err){console.log('addBootstrapSubscription ERROR:', err)}
    let subscription = addSubscription(symKeyID, topics, shh, onData)
    if(cb){
      cb(null, subscription)
    }
  })
}

function buildTopicHexString(topic) {
  let hexString = '0x' + new Buffer(topic).toString('hex')
  return hexString.substring(0, 10)
}

function buildFilterObject(topics) {
  let hexTopics = []
  for(let topic of topics){
    hexTopics.push(buildTopicHexString(topic))
  }
  return {'topics': hexTopics}
}

// TODO: this can be improved to take in some defaults for ttl and workToProve
// TODO: this can also perhaps have the option between an object with the parameters or
// the individual parameters
function buildPostObject(shh, topic, payload, ttl, cb) {
  getSymmetricKey(shh, function(err, symKeyID) {
    if(err){console.log('getSymmetricKey ERROR:', err)}
    getAsymmetricKey(shh, function(err, sig) {
      if(err){console.log('getAsymmetricKey ERROR:', err)}
      let powTime = config.whisper.powTime
      let powTarget = config.whisper.powTarget
      postObj = {
        symKeyID,
        sig,
        topic,
        payload,
        ttl,
        powTime,
        powTarget
      };
      cb(null, postObj);
    });
  });
}

function post(message, shh, topic, cb){
  let hexMessage = '0x' + new Buffer(message).toString('hex')
  let hexTopic = buildTopicHexString(topic);
  buildPostObject(shh, hexTopic, hexMessage, 10, function(){
    shh.post(postObj, function(err, res){
      if(err){console.log('Whisper util post ERROR:', err)}
      if(cb){
        cb(err, res);
      }
    })
  });
}

// interval specified in milliseconds
function postAtInterval(message, shh, topic, interval, cb) {
  let intervalID = setInterval(function(){
    post(message, shh, topic, function(err, res){
      if(err){console.log('Post at interval ERROR:', err)}
    })
  }, interval)
  cb(null, intervalID);
}

exports.getAsymmetricKey = getAsymmetricKey
exports.addSubscription = addSubscription
exports.addBootstrapSubscription = addBootstrapSubscription
exports.post = post
exports.postAtInterval = postAtInterval
