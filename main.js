'use strict';

const cluster = require('cluster');
const iniparser = require('iniparser');

const log = require('./Logger');
const config = iniparser.parseSync('./config.ini');
const workerNum = parseInt(config.camera.worker_number);
const CameraCluster = require('./CameraCluster');
const CameraClusterChild = require('./CameraClusterChild');

if (cluster.isMaster) {
    const cameraCluster = new CameraCluster({workerNum: workerNum});
    setTimeout(() => {
        cameraCluster.serveCameras();
    }, 1000);
} else {
    const cameraClusterChild = new CameraClusterChild();
    process.on('message',(cameras) => {
        cameraClusterChild.onMessage(cameras);
    });
    process.on('uncaughtException', (err) => {
        log.error(`[worker-${cluster.worker.id}] Caught exception: ${err}`);
    });
}