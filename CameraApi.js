'use strict';
const iniparser = require('iniparser');
const log = require('./logger');
const config = iniparser.parseSync('./config.ini');
const BaseRequest = require('./BaseRequest');

class CameraApi extends BaseRequest {
    constructor(options = {}) {
        if (!config.security || !config.security.server) {
            log.error('camera-api config error, missing base url');
        }
        options.baseUrl = config.security.server;
        options.TIMEOUT = options.TIMEOUT || 10000;
        super(options);
    }

    async update(camera, params) {
        this.put(config.camera.api_put_camera.replace('#[id]', camera.id), params);
    }

    async getCameras(params) {
        const res = await this.get(config.camera.api_get_camera, params);
        if (!this.errorHandler(res)) {
            return false;
        }
        return JSON.parse(res.body).data;
    }

    errorHandler(ob) {
        const {err, res, body} = ob;
        if (err || res.statusCode !== 200) {
            log.error('[cameraApi] Error queryCamera', err, body);
            return false;
        }
        return true;
    }
}

module.exports = new CameraApi();