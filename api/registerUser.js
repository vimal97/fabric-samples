/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const { exec } = require("child_process");
const path = require('path');

async function enrollUser(username, organization) {
    try {
        // load the network configuration
        const ccpPath = path.resolve(__dirname, '..', 'test-network', 'organizations', 'peerOrganizations', `${organization}.example.com`, `connection-${organization}.json`);
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA.
        const caURL = ccp.certificateAuthorities['ca.' + organization + '.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get(username);
        if (userIdentity) {
            console.log('An identity for the user ' + username + ' already exists in the wallet');
            return {
                'success': false,
                'error': `Failed to register user ${username}: user already enrolled`
            };
        }

        // Check to see if we've already enrolled the admin user.
        const adminIdentity = await wallet.get('admin');
        if (!adminIdentity) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            return {
                success: false,
                error: `Failed to register user ${username}: no admin identity found`
            }
        }
        // build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'admin');

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({
            affiliation:  organization + '.department1',
            enrollmentID: username,
            role: 'client'
        }, adminUser);
        const enrollment = await ca.enroll({
            enrollmentID: username,
            enrollmentSecret: secret
        });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            type: 'X.509',
        };
        if(organization == 'org1')
            x509Identity.mspId = 'Org1MSP'
        else if(organization == 'org2')
            x509Identity.mspId = 'Org2MSP'
        await wallet.put(username, x509Identity);
        console.log('Successfully registered and enrolled admin user ' + username + ' and imported it into the wallet');
        return {
            'success': true,
            'username': username,
            'orgName': organization,
            'token': "",
            'message': "Successfully enrolled user"
        }
    } catch (error) {
        console.error(`Failed to register user ${username}: ${error}`);
        return {
            'success': false,
            'error': `Failed to register user ${username}: ${error}`
        }
    }
}

exports.enrollUser = enrollUser
