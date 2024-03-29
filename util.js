'use strict';

/**
 * parse the given url
 * reason for not using url lib in node.js:
 * it can not parse the username and password correctly when there is special character
 * @param {String} src 
 */
function parseUrl(src) {
    const reg1 = /^([\w]+):\/\/(.*@)?([^@]+)$/;
    let data = {
        protocol: "",
        username: "",
        password: "",
        hostname: "",
        port: 0,
        path: "",
        query: "",
        params: "",
        hash: ""
    }
    const gs1 = src.match(reg1);
    if (gs1){
        data.protocol = gs1[1];
        if (gs1[2]) {
            const ps = gs1[2].replace(/@$/, '').split(':');
            data.username = ps.shift();
            data.password = ps.join('');
        }
        if (gs1[3]) {
            const reg2 = /^([^:/?]+)(:\d+)?(\/[^?]*)?(\?[^#]*)?(#.*)?$/;
            const gs2 = gs1[3].match(reg2);
            data.hostname = gs2[1];
            data.port = parseInt((gs2[2] || '').replace(/^:/, '')) || 0;
            data.path = gs2[3] || '';
            data.query = (gs2[4] || '').replace(/^\?/, '');
            data.hash = (gs2[5] || '').replace(/^#/, '');

            if( data.query ){
                data.params = {};
                data.query.split('&').forEach(function(v){
                    const s = v.split('=');
                    data.params[s[0]] = s[1];
                })
            }
        }
    }
    return data;
}

/**
 * format Date object in certain way
 * @param {Object Date} time 
 * @param {String} format 
 */
function formatTime(time, format) {
    const year = time.getFullYear();
    const month = time.getMonth() + 1;
    const date = time.getDate();
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();
    const replacements = {
        'yyyy': year,
        'mm': __appendZero__(month),
        'm': month,
        'dd': __appendZero__(date),
        'd': date,
        'hh': __appendZero__(hours),
        'h': hours,
        'MM': __appendZero__(minutes),
        'M': minutes,
        'ss': __appendZero__(seconds),
        's': seconds
    }
    for( let k in replacements ){
        format = format.replace(k, replacements[k]);
    }
    return format;
}

/**
 * add extra 0 to guarantee number of digits
 * @param {String/Number} num 
 */
function __appendZero__(num, guarantee = 2) {
    return `0${num}`.slice(-guarantee);
}

/**
 * dump json as string
 * @param {object} json 
 */
function json2query(json = {}) {
    let querys = [];
    for(let k in json) {
        if (json[k]) {
            querys.push(k + '=' + encodeURIComponent(json[k]));
        }
    }
    return querys.join('&');
}

function isArray(obj){
    return Object.prototype.toString.call(obj) == '[object Array]'
}

module.exports = {
  parseUrl: parseUrl,
  formatTime: formatTime,
  json2query: json2query,
  isArray: isArray
};