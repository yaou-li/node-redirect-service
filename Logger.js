'use strict';
require('console-error');
require('console-warn');
require('console-info');

const iniparser = require('iniparser');
const config = iniparser.parseSync('./config.ini');
const util = require('./util');

const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

class Logger {    
    constructor(options) {
        const logLevel = options.logLevel || 'debug';
        this.level = LEVELS[logLevel];
    }

    debug(...args) {
        return this.__print__('log', ...args);
    }

    info(...args) {
        return this.__print__('info', ...args);
    }

    warn(...args) {
        return this.__print__('warn', ...args);
    }

    error(...args) {
        return this.__print__('error', ...args);
    }

    __print__(method, ...args) {
        if (this.level >= LEVELS[method]) {
            let msg = [];
            Array.prototype.slice.call(args).map((arg) => {
                if (typeof arg === 'object') {
                    arg = JSON.stringify(arg);
                }
                msg.push(arg);
            });
            return console[method](`${method.toUpperCase()} [${util.formatTime(new Date, 'yyyy-mm-dd hh:MM:ss')}] ${msg.join(' ')}`);    
        }
        return false;
    }
}

const logger = new Logger({logLevel: config.log_level});
module.exports = {
    debug: logger.debug,
    info: logger.info,
    warn: logger.warn,
    error: logger.error
}

