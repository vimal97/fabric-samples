/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('SampleWebApp');
var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var util = require('util');
var app = express();
var expressJWT = require('express-jwt');
var jwt = require('jsonwebtoken');
var bearerToken = require('express-bearer-token');
var cors = require('cors');

var user = require('./registerUser')
// var invoke = require('./invoke');
// var query = require('./query');
var host = process.env.HOST || "localhost";
var port = process.env.PORT || "4000";
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// SET CONFIGURATONS ////////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors());
app.use(cors());
//support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
	extended: false
}));
// set secret variable
app.set('secret', 'thisismysecret');
app.use(expressJWT({
    secret: 'thisismysecret',
    algorithms: ['RS256'] 
}).unless({
	path: ['/users']
}));
app.use(bearerToken());
app.use(function(req, res, next) {
	logger.debug(' ------>>>>>> new request for %s',req.originalUrl);
	if (req.originalUrl.indexOf('/users') >= 0) {
		return next();
	}

	var token = req.token;
	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token. Make sure to include the ' +
					'token returned from /users call in the authorization header ' +
					' as a Bearer token'
			});
			return;
		} else {
			// add the decoded user name and org name to the request object
			// for the downstream code to use
			req.username = decoded.username;
			req.orgname = decoded.orgName;
			logger.debug(util.format('Decoded from JWT token: username - %s, orgname - %s', decoded.username, decoded.orgName));
			return next();
		}
	});
});

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
var server = http.createServer(app).listen(port, function() {
    console.log('\n****************** SERVER STARTED ************************');
    console.log('***************  http://%s:%s  ******************\n',host,port);
    server.timeout = 240000;
});

function getErrorMessage(field) {
	var response = {
		success: false,
		message: field + ' field is missing or Invalid in the request'
	};
	return response;
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////// REST ENDPOINTS START HERE ///////////////////////////
///////////////////////////////////////////////////////////////////////////////

// Register and enroll user
app.post('/users', async function(req, res) {
	var username = req.body.username;
	var orgName = req.body.orgName;
	logger.debug('End point : /users');
	logger.debug('User name : ' + username);
	logger.debug('Org name  : ' + orgName);
	if (!username) {
		res.json(getErrorMessage('\'username\''));
		return;
	}
	if (!orgName) {
		res.json(getErrorMessage('\'orgName\''));
		return;
	}
	var token = jwt.sign({
		exp: Math.floor(Date.now() / 1000) + 36000,
		username: username,
		orgName: orgName
	}, app.get('secret'));
	let response = await user.enrollUser(username, orgName)
	logger.debug('-- returned from registering the username %s for organization %s',username,orgName);
    if (response.success) {
		logger.debug('Successfully registered the username %s for organization %s',username,orgName);
		response.token = token;
		res.json(response);
	} else {
		logger.debug('Failed to register the username %s for organization %s with::%s',username,orgName,response);
		res.json({success: false, message: response});
	}

});

// Invoke transaction on chaincode on target peers
app.post('/channels/:channelName/chaincodes/:chaincodeName', async function(req, res) {
	logger.debug('==================== INVOKE ON CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.params.chaincodeName;
	var channelName = req.params.channelName;
	var fcn = req.body.fcn;
	var args = req.body.args;
	logger.debug('channelName  : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('fcn  : ' + fcn);
	logger.debug('args  : ' + args);
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!fcn) {
		res.json(getErrorMessage('\'fcn\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, req.username, req.orgname);
	res.send(message);
});

// Query on chaincode on target peers
app.get('/channels/:channelName/chaincodes/:chaincodeName', async function(req, res) {
	logger.debug('==================== QUERY BY CHAINCODE ==================');
	var channelName = req.params.channelName;
	var chaincodeName = req.params.chaincodeName;
	let args = req.query.args;
	let fcn = req.query.fcn;
	let peer = req.query.peer;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('fcn : ' + fcn);
	logger.debug('args : ' + args);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!fcn) {
		res.json(getErrorMessage('\'fcn\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}
	args = args.replace(/'/g, '"');
	args = JSON.parse(args);
	logger.debug(args);

	let message = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.username, req.orgname);
	res.send(message);
});

/////////////////////////////////////////////
////////////TO BE IMPLEMENTED////////////////
/////////////////////////////////////////////


// //  Query Get Block by BlockNumber
// app.get('/channels/:channelName/blocks/:blockId', async function(req, res) {
// 	logger.debug('==================== GET BLOCK BY NUMBER ==================');
// 	let blockId = req.params.blockId;
// 	let peer = req.query.peer;
// 	logger.debug('channelName : ' + req.params.channelName);
// 	logger.debug('BlockID : ' + blockId);
// 	logger.debug('Peer : ' + peer);
// 	if (!blockId) {
// 		res.json(getErrorMessage('\'blockId\''));
// 		return;
// 	}

// 	let message = await query.getBlockByNumber(peer, req.params.channelName, blockId, req.username, req.orgname);
// 	res.send(message);
// });
// // Query Get Transaction by Transaction ID
// app.get('/channels/:channelName/transactions/:trxnId', async function(req, res) {
// 	logger.debug('================ GET TRANSACTION BY TRANSACTION_ID ======================');
// 	logger.debug('channelName : ' + req.params.channelName);
// 	let trxnId = req.params.trxnId;
// 	let peer = req.query.peer;
// 	if (!trxnId) {
// 		res.json(getErrorMessage('\'trxnId\''));
// 		return;
// 	}

// 	let message = await query.getTransactionByID(peer, req.params.channelName, trxnId, req.username, req.orgname);
// 	res.send(message);
// });
// // Query Get Block by Hash
// app.get('/channels/:channelName/blocks', async function(req, res) {
// 	logger.debug('================ GET BLOCK BY HASH ======================');
// 	logger.debug('channelName : ' + req.params.channelName);
// 	let hash = req.query.hash;
// 	let peer = req.query.peer;
// 	if (!hash) {
// 		res.json(getErrorMessage('\'hash\''));
// 		return;
// 	}

// 	let message = await query.getBlockByHash(peer, req.params.channelName, hash, req.username, req.orgname);
// 	res.send(message);
// });
// //Query for Channel Information
// app.get('/channels/:channelName', async function(req, res) {
// 	logger.debug('================ GET CHANNEL INFORMATION ======================');
// 	logger.debug('channelName : ' + req.params.channelName);
// 	let peer = req.query.peer;

// 	let message = await query.getChainInfo(peer, req.params.channelName, req.username, req.orgname);
// 	res.send(message);
// });
// //Query for Channel instantiated chaincodes
// app.get('/channels/:channelName/chaincodes', async function(req, res) {
// 	logger.debug('================ GET INSTANTIATED CHAINCODES ======================');
// 	logger.debug('channelName : ' + req.params.channelName);
// 	let peer = req.query.peer;

// 	let message = await query.getInstalledChaincodes(peer, req.params.channelName, 'instantiated', req.username, req.orgname);
// 	res.send(message);
// });
// // Query to fetch all Installed/instantiated chaincodes
// app.get('/chaincodes', async function(req, res) {
// 	var peer = req.query.peer;
// 	var installType = req.query.type;
// 	logger.debug('================ GET INSTALLED CHAINCODES ======================');

// 	let message = await query.getInstalledChaincodes(peer, null, 'installed', req.username, req.orgname)
// 	res.send(message);
// });
// // Query to fetch channels
// app.get('/channels', async function(req, res) {
// 	logger.debug('================ GET CHANNELS ======================');
// 	logger.debug('peer: ' + req.query.peer);
// 	var peer = req.query.peer;
// 	if (!peer) {
// 		res.json(getErrorMessage('\'peer\''));
// 		return;
// 	}

// 	let message = await query.getChannels(peer, req.username, req.orgname);
// 	res.send(message);
// });
