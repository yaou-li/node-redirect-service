'use strict';
const request = require('request');

class BaseRequest {
    constructor(options = {}) {
        //base url is optional, will use it in the beginning of query url if set up
        this.baseUrl = options.baseUrl || '';
        this.timeout = options.timeout || 5000;
        this.maxRedirects = options.maxRedirects || 10;
        this.agent = options.agent || {};
        this.followAllRedirects = options.followAllRedirects || true;
    }

    get(url, payloads = {}, extraOptions = {}) {
        return this.send('GET', url, payloads, extraOptions);
    }

    post(url, payloads = {}, extraOptions = {}) {
        return this.send('POST', url, payloads, extraOptions);
    }
    
    del(url, payloads = {}, extraOptions = {}) {
        return this.send('DELETE', url, payloads, extraOptions);
    }

    put(url, payloads = {}, extraOptions = {}) {
        return this.send('PUT', url, payloads, extraOptions);
    }

    send(method = 'GET', url = '', payloads = {}, extraOptions = {}) {
        let options = {
            method: method,
            baseUrl: this.baseUrl,
            url: url,
            timeout: this.timeout,
            followAllRedirects: this.followAllRedirects,
            agent: this.agent,
            maxRedirects: 10
        };

        if (extraOptions.responseType === 'raw_binary') {
            options.encoding = null;
        }

        if (extraOptions.headers) {
            options.headers = extraOptions.headers
        }  

        switch(method) {
            case 'GET':
                const query = this.json2query(payloads);
                options.url = query ? `${options.url}?${query}` : options.url;
                break;
            case 'POST':
            case 'PUT':
            case 'DELETE':
                if (extraOptions.contentType === 'form') {
                    options.formData = payloads;
                } else {
                    // default to json format
                    options.json = payloads;
                }
                break;
        }

        return new Promise((resolve) => {
            request(options, (err, res, body) => {
                resolve({err: err, res: res, body: body});
            });
        });
    }

    json2query(json = {}) {
        let querys = [];
        for(let k in json) {
            querys.push(k + '=' + encodeURIComponent(json[k]));
        }
        return querys.join('&');
    }
}

module.exports = BaseRequest;