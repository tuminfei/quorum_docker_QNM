const util = require('../util.js')
var config = require('../config.js')

var whisperUtils = require('./whisperUtils.js')

function requestExistingIstanbulNetworkMembership(result, cb){

  console.log('[*] Requesting existing network membership. This will block until the other node responds')
  
  let shh = result.communicationNetwork.web3WSRPC.shh;

  let receivedNetworkMembership = false
  let subscription = null

  function onData(msg){
    let message = null
    if(msg && msg.payload){
      message = util.Hex2a(msg.payload)
    }
    if(message && message.indexOf('response|existingIstanbulNetworkMembership') >= 0){
      receivedNetworkMembership = true
      if(subscription){
        subscription.unsubscribe(function(err, res){
          if(err) { console.log('requestExistingIstanbulNetworkMembership unsubscribe ERROR:', err) }
          subscription = null
        })
      }
      let messageTokens = message.split('|')
      console.log('[*] Network membership:', messageTokens[2])
      cb(null, result)
    }
  }

  whisperUtils.addBootstrapSubscription(['NetworkMembership'], shh, onData, 
    function(err, _subscription){
    subscription = _subscription
  })

  let request = "request|existingIstanbulNetworkMembership";
  request += '|'+result.enodeList[0]
  request += '|'+config.identity.nodeName

  whisperUtils.postAtInterval(request, shh, 'NetworkMembership', 5*1000, function(err, intervalID){
    let checkNetworkMembership = setInterval(function(){
      if(receivedNetworkMembership){
        clearInterval(intervalID)
        clearInterval(checkNetworkMembership)
      } 
    }, 1000)
  })
}

function existingIstanbulNetworkMembership(result, cb){
  let request = 'request|existingIstanbulNetworkMembership'

  let shh = result.communicationNetwork.web3WSRPC.shh
  let web3IPC = result.web3IPC

  function onData(msg){
    let message = null
    if(msg && msg.payload){
      message = util.Hex2a(msg.payload)
    } 
    if(message && message.indexOf(request) >= 0){
      if(result.networkMembership == 'allowAll'){
        let from = msg.from // TODO: This needs to be added into a DB.
        let messageTokens = message.split('|')
        let peerEnode = messageTokens[2]
        let peerName = messageTokens[3]
        web3IPC.admin.addPeer(peerEnode, function(err, raftID){
          if(err){console.log('addPeer ERROR:', err)}
          console.log(peerName + ' has joined the network')
          let responseString = 'response|existingIstanbulNetworkMembership|ACCEPTED|'
          whisperUtils.post(responseString, shh, 'NetworkMembership')
        })
      } else if(result.networkMembership === 'permissionedNodes') {
        // TODO
      } else if(result.networkMembership == 'allowOnlyPreAuth') {
        // TODO
      }
    }
  }

  whisperUtils.addBootstrapSubscription(["NetworkMembership"], shh, onData)

  cb(null, result)
}

exports.existingIstanbulNetworkMembership = existingIstanbulNetworkMembership
exports.requestExistingIstanbulNetworkMembership = requestExistingIstanbulNetworkMembership
