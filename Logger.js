'use strict';
require('console-error');
require('console-warn');
require('console-info');

const iniparser = require('iniparser');
const config = iniparser.parseSync('./config.ini');
const util = require('./util');
const { LEVELS } = require('./Constants');

class Logger {    
    constructor(options) {
        const logLevel = options.logLevel || 'debug';
        this.level = LEVELS[logLevel.toUpperCase()];
    }
    
    formatCamera(camera) {
        camera = camera || {id:'', src:'', capture_src:''};
        return `camera<${camera.id}|${camera.src}|${camera.capture_src}>`;
    }

    debug(...args) {
        return this.__print__('debug', ...args);
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
        if (this.level <= LEVELS[method.toUpperCase()]) {
            let msg = [];
            Array.prototype.slice.call(args).map((arg) => {
                if (typeof arg === 'object') {
                    arg = JSON.stringify(arg);
                }
                msg.push(arg);
            });
            let funcType = method != 'debug' ? method : 'log';
            return console[funcType](`${funcType.toUpperCase()} [${util.formatTime(new Date, 'yyyy-mm-dd hh:MM:ss')}] ${msg.join(' ')}`);
        }
        return false;
    }
}

const logger = new Logger({logLevel: config.log_level});
module.exports = logger;

