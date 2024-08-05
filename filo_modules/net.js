const express = require('express');
const chalk = require("chalk");
const router = express.Router();

const http = require('http');
const https = require('https');

function checkNet(url, required, callback) {
    if (required) {
        const options = {
            method: 'HEAD',
            timeout: 10000
        };
    
        const protocol = url.startsWith('https') ? https : http;
        const request = protocol.request(url, options, (response) => {
            request.abort();
    
            if (response.statusCode === 200) {
                callback(true, '[' + chalk.green.bold("OK") + ']');
            } else {
                callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ' Status Code: ' + response.statusCode + ']');
            }
        });
    
        request.on('error', (err) => {
            callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ' Failed to establish a connection]');
        });
    
        request.on('timeout', () => {
            request.destroy();
    
            callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ' Timeout]');
        });
    
        request.end();
    } else {
        callback(true, '[' + chalk.yellow.bold("SKIPPED") + ']');
    }
}

module.exports = {
    checkNet
};