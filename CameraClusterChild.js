'use strict';
const cluster = require('cluster');

const log = require('./Logger');
const util = require('./util');
const CameraClient = require('./CameraClient');
const WebSocket = require('ws');

class CameraClusterChild {
    constructor(options = {}) {
        this.cameraClients = options.cameraClients || {};
        this.cameras = {};
    }

    onMessage(cameras) {
        if (!util.isArray(cameras) || cameras.length <= 0) return this;
        let worker = cluster.worker;
        log.info(`[worker] start worker ${worker.id}`);
        this.saveCameras(cameras).updateClients();
        Object.keys(this.cameras).map((cameraId) => {
            if (!this.cameraClients.hasOwnProperty(cameraId)) {
                this.cameraClients[cameraId] = new CameraClient({camera: this.cameras[cameraId]});
            }
        });
        return this;
    }

    saveCameras(cameras) {
        if (!util.isArray(cameras)) {
            this.cameras = {};
            return this;
        }
        cameras.map((camera) => {
            this.cameras[camera.id] = camera;
        }); 
        return this;
    }

    /**
     * close & remove client if it's not existing in cameras info anymore
     * close & remove client if url is changed
     * create new client if the connection is closed
     */
    updateClients() {
        Object.keys(this.cameraClients).map((cameraId) => {
            const client = this.cameraClients[cameraId]
            const camera = this.cameras[cameraId];
            if (!camera) {
                log.debug("[worker.cameraGone]", log.formatCamera(camera));
                client.close();
                delete this.cameraClients[cameraId];
            } else if (client.wsUrl != client.getWebSocketUrl(camera)) {
                log.debug("[worker.cameraUrlChanged]", log.formatCamera(camera), log.formatCamera(client.camera));
                client.close();
                this.cameraClients[cameraId] = new CameraClient({camera: camera});
            } else if (client.ws.readyState == WebSocket.CLOSED) {
                log.debug("[worker.wsClosed]", log.formatCamera({camera: camera}));
                this.cameraClients[cameraId] = new CameraClient({camera: camera});
            } else {
                client.updateCamera(camera);
            }
        });
        return this;
    }
    
}

module.exports = CameraClusterChild;