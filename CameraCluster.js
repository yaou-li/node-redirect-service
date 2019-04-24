'use strict';
const cluster = require('cluster');

const log = require('./Logger');
const cameraApi = require('./CameraApi');
const { CAMERA_STATUS } = require('./Constants');

class CameraCluster {
    constructor(options = {}) {
        this.workerNum = options.workerNum || 4;
        this.workers = [];
        cluster.on('fork', this.onFork);
        cluster.on('online', this.onOnline);
        cluster.on('listening', this.onListening);
        cluster.on('disconnect', this.onDisconnect);
        cluster.on('exit', this.onExit);
        this.createWorkers();
    }
    createWorkers() {
        let workerNum = this.workerNum;
        while (workerNum > 0) {
            this.workers.push(cluster.fork());
            workerNum--;
        }
        return this;
    }
    renewWorker(worker) {
        let index = workers.indexOf(worker);
        if (index > 0) {
            this.workers.splice(index, 1, cluster.fork());
        }
        return this;
    }
    onFork(worker) {
        log.info(`[master]fork: worker${worker.id}`);
    }
    onOnline(worker) {
        log.info(`[master]online: worker${worker.id}`);
    }
    onListening(worker, address) {
        log.info(`[master]listening: worker${worker.id}, pid: ${worker.process.pid}, address: ${address.address}:${address.port}`);
    }
    onDisconnect(worker) {
        log.info(`[master]disconnect: worker${worker.id}`);
    }
    onExit(worker) {
        log.info(`[master]exit: worker${worker.id}`);
        this.renewWorker(worker);
    }
 
    async serveCameras() {
        const cameras = await cameraApi.getCameras({
            type: 0,
            status: `${CAMERA_STATUS.INIT},${CAMERA_STATUS.WORKING},${CAMERA_STATUS.ERROR},${CAMERA_STATUS.CAPTURE_ERROR}`
        });
        if (cameras) {
            log.debug(`[query camera] camera length = ${cameras.length}`);
            this.workers.map((worker, index) => {
                let _cameras = cameras.filter(camera => ((camera.id - 1) % this.workerNum) == index);
                worker.send(_cameras);
            });
        }
        setTimeout(() => {
            this.serveCameras();
        }, 5000);
    }

}

module.exports = CameraCluster;