// 'use strict';
const iniparser = require('iniparser');
const WebSocket = require('ws');

const config = iniparser.parseSync('./config.ini');
const util = require('./util');
const notify = require('./Notify');
const log = require('./Logger');
const cameraApi = require('./CameraApi');
const redis = require('redis');
const { CAMERA_STATUS, ALARM_TYPE } = require('./Constants');

class CameraClient {
    constructor(options = {}) {
        this.options = options || {};
        this.camera = options.camera || {};
        this.connTimeoutInt = options.connTimeoutInt || 20000;
        this.memoryKeeperInt = options.memoryKeeperInt || 10 * 60 * 1000;
        this.REDIS_CAPTURE_TOPIC = `PORTFACE_CAPTURE_${this.camera.id}`;
        this.REDIS_CAPTURE_RESPONSE_TOPIC = `PORTFACE_CAPTURE_RESPONSE_${this.camera.id}`;
        this.trackCaches = {};
        this.run();
    }

    run() {
        try {
            this.initRedis();
            this.wsUrl = this.getWebSocketUrl(this.camera);
            console.log(this.wsUrl);
            // set timeout checker for websocket connection
            this.setConnTimer();
            log.info('[worker.websocket] connecting...', log.formatCamera(this.camera), this.wsUrl); 
            this.ws = new WebSocket(this.wsUrl);
            this.ws.on('open', this.onOpen.bind(this));
            this.ws.on('message', this.onMessage.bind(this));
            this.ws.on('pong', this.onPong.bind(this));
            const onError = this.onError.bind(this);
            this.ws.on('error', onError);
            this.ws.on('close', this.onClose.bind(this));
        } catch(exception) {
            log.error(exception.message);
        }
    }

    initRedis() {
        const redisOpts = {
            host: config.redis.host,
            port: config.redis.port,
            db: config.redis.db,
            retry_strategy: () => {
                return 2000
            }
        };
        const error = (err) => {
            log.error(`redis connect error - ${redisOpts.host}:${redisOpts.port} - ${err}`);
        }
        const connect = () => {
            log.info(`redis connect success - ${redisOpts.host}:${redisOpts.port}`);
        }
        // notify frontend for capture and alarm
        const message = (channel, message) => {
            // 在保存成功的时候保存capture_id
            const res = JSON.parse(message);
            if (res.capture) {
                notify.capture(res.capture, this.camera);
            }
            if (res.alarm) {
                res.alarm = util.isArray(res.alarm) ? res.alarm : [res.alarm];
                res.alarm.map((alarm) => {
                    notify.alarm(alarm, this.camera);
                });
            }
        }
        
        this.subClient = redis.createClient(redisOpts);
        this.pubClient = redis.createClient(redisOpts);
        this.subClient.on('error', error);
        this.subClient.on('connect', connect);
        this.pubClient.on('error', error);
        this.pubClient.on('connect', connect);
        this.subClient.on('message', message);
        this.subClient.subscribe(this.REDIS_CAPTURE_RESPONSE_TOPIC);
    }

    getWebSocketUrl(camera) {
        // console.log(camera);
        const deploy = camera.deploy_solution;
        let wsOpts = {
            ip: camera.core.ip,
            port: camera.core.port,
            path: `/${deploy.conf.interface || 'video_track'}`,
            params: {
                interval: deploy.conf.interval || 10000,
                url: encodeURIComponent(this.parseCameraUrl(camera.src)),
                roi: camera.roi,
                limit: camera.configs.limit,
                crop: deploy.conf.crop || 'face',
                name: (camera.configs.APP_NAME || 'deploy') + camera.id,
                // keepclip: 1800,
                analyze: true,
                more: 1,
                extract: 1,
                facemin: deploy.conf.min_detect_face
            }
        };
        if (deploy.conf.roll && deploy.conf.yaw && deploy.conf.pitch && deploy.conf.blurness) {
            wsOpts.params.threshold = `${deploy.conf.roll},${deploy.conf.yaw},${deploy.conf.pitch},${deploy.conf.blurness}`;
        }
        
        // only alarm need below logic
        if (deploy.alarm_type == ALARM_TYPE.RECOGNIZE) {
            let groupIds = [];
            // can not use different threshold for each group
            let minAlert = 100;
            deploy.groups.map((group) => {
                groupIds.push(group.group.id);
                minAlert = Math.min(minAlert, group.threshold);
            });
            if (groupIds.length) {
                wsOpts.params.group = groupIds.join(',');
            }
            wsOpts.params.record_hitrate = deploy.conf.hitrate;
            wsOpts.params.hitrate_score = deploy.conf.hitrate_score;
            wsOpts.params.record_scoregap = deploy.conf.scoregap;
            wsOpts.params.alert = deploy.conf.minAlert;
        }
        let query = [];
        
        Object.keys(wsOpts.params).map((k) => {
            if (wsOpts.params[k]) {
                query.push(`${k}=${wsOpts.params[k]}`);
            }
        });
        if (deploy.conf.others) {
            query = query.concat(deploy.conf.others.split('\n'));
        }
        return `ws://${wsOpts.ip}:${wsOpts.port}${wsOpts.path}?${query.join('&')}`;
    }

    /**
     * core always pick the best capture of the track
     * so only need to save the best one and compare
     * @param {object} data
     */
    needSave(data) {
        const trackId = data.track;
        // pts: timestamp of that capture
        // assume core will always give the best choice of capture for one track
        // so if it return the same capture, igore it because it has been saved
        if (this.trackCaches.hasOwnProperty(trackId) && 
            this.trackCaches[trackId].pts === data.pts) {
            return false;
        } 

        this.trackCaches[trackId] = data;
        return true;
    }

    /**
     * send the track gone signal to portface
     * portface consider the track is over
     * will take the capture and load into group in core
     * @param {object} data 
     */
    saveTrackGone(data) {
        let params = {};
        const trackId = data.track;
        const track = this.trackCaches[track_id] || '';
        if (track) {
            // 处理最好质量人脸的seq
            params.clip_id = track.clip_seq;
            params.track_id = trackId;
            params.capture_id = capture_id || '';
            params.result = JSON.stringify(data);
            params.camera_id = this.camera.id;
            params.DATA_TYPE = 'FACE_GONE';
            this.pubClient.publish(this.REDIS_CAPTURE_TOPIC, JSON.stringify(params));
        }
    }

    onOpen() {
        if (this.connTimeout) {
            clearTimeout(this.connTimeout);
        }
        this.memoryKeeper = this.setMemoryKeeper();
        this.heartbeat = this.setHeartBeat();

        log.info('[worker.websocket] connection open', log.formatCamera(this.camera), this.wsUrl);
        cameraApi.update(this.camera, {operation_status: CAMERA_STATUS.WORKING});
        notify.cameraStatus(CAMERA_STATUS.WORKING, this.camera);
    }

    onMessage(data) {
        try {
            data = JSON.parse(data);
            data.server_time = new Date;
            switch(data.type) {
                case 'gone':
                    this.saveTrackGone(data);
                    break;
                case 'recognize':
                    delete data.frames;
                    log.debug('[worker.websocket.message.faceResult]', log.formatCamera(this.camera), data.result, data);
                    if (this.needSave(data)) {
                        this.pubClient.pubClient.publish(this.REDIS_CAPTURE_TOPIC, JSON.stringify({
                            camera: this.camera,
                            result: data,
                            core_id: this.camera.core.id,
                            DATA_TYPE:'FACE'
                        }));
                    }
                    break;
                default:
                    log.error("[worker.websocket.message]", log.formatCamera(this.camera), data, "other data type");
            }
        } catch (e) {
            log.error('[worker.websocket.message.exception]', log.formatCamera(this.camera), e);
        }
        
    }

    onError(e) {
        try {
            if (this.connTimeout) {
                clearTimeout(this.connTimeout);
            }
            log.error(`[worker.websocket.error] camera = ${log.formatCamera(this.camera)}`, e);
            log.error(`[worker.websocket.error] url=${this.wsUrl}`);
            this.close(1001);
            if ([CAMERA_STATUS.CAPTURE_ERROR, CAMERA_STATUS.ERROR].indexOf(this.camera.operation_status) < 0) {
                cameraApi.update(this.camera, {operation_status: CAMERA_STATUS.CAPTURE_ERROR});
                notify.cameraStatus(CAMERA_STATUS.CAPTURE_ERROR, this.camera);
            }
        } catch(e) {
            console.log(e);
        }
            
        
    }

    onClose(code) {
        log.error('[worker.websocket.close]', log.formatCamera(this.camera), 'code=' + code, this.wsUrl);
        if (code == 1000) {
            cameraApi.update(this.camera, {operation_status: CAMERA_STATUS.FREE});
            notify.cameraStatus(CAMERA_STATUS.FREE, this.camera);
        } else if ([CAMERA_STATUS.CAPTURE_ERROR, CAMERA_STATUS.ERROR].indexOf(this.camera.operation_status) < 0){
            cameraApi.update(this.camera, {operation_status: CAMERA_STATUS.CAPTURE_ERROR});
            notify.cameraStatus(CAMERA_STATUS.ERROR, this.camera);
        }
    }

    onPong() {
        this.wsAlive = true;
    }

    /**
     * set a max timeout limit to avoid request pending
     */
    setConnTimer() {
        return setTimeout(() => {
            this.close(1003);
        }, this.connTimeoutInt);
    }

    /**
     * set memory keeper to clear uncleared track
     * if the track is more than 10 min we consider it as uncleared
     * for example someone staying there over 10 mins
     * or if someone's track gone is lost
     * saveTrackGone and release it to avoid memory leak
     */
    setMemoryKeeper() {
        return setInterval(() => {
            const trackCount = 0;
            for(let trackId in this.trackCaches){
                let track = this.trackCaches[trackId];
                if( new Date - track.server_time > 10 * 60 * 1000 ){ // 如果某个track的时间超过了10分钟，则自动丢弃，且置为track消失
                    log.debug("[worker.trackTimeout]", log.formatCamera(this.camera), {track_id: trackId});
                    this.saveTrackGone({track: trackId});
                    delete this.trackCaches[trackId];
                } else {
                    trackCount++;
                }
            }
            log.debug("[worker.trackCaches]", log.formatCamera(this.camera), {track_count: trackCount});
        }, this.memoryKeeperInt);
    }

    /**
     * add ping pong message to core
     * this supports only in "ws" lib
     */
    setHeartBeat() {
        return setInterval(() => {
            try {
                if (this.wsAlive === false) {
                    clearInterval(this.heartbeat);
                    return this.ws && this.ws.terminate();
                }
                this.wsAlive = false;
                this.ws && this.ws.ping(() => {});
            } catch(e) {
                log.error(e.message);
            }
        }, 30000);
    }

    updateCamera(camera) {
        this.camera = camera || {};
    }

    parseCameraUrl(src) {
        try {
            let r = util.parseUrl(src);
            if( r.password ){
                return src.replace(`:${r.password}@`, `:${encodeURIComponent(r.password)}@`);
            }
        } catch(e) {
            log.error("parseCameraUrl error", {src:src, error: e});
        }
        return src;
    }
    
    close(code) {
        if (this.memoryKeeper) {
            clearInterval(this.memoryKeeper);
        }
        this.ws && this.ws.close(code || 1000);
        this.subClient.quit();
        log.info("quit redis sub");
        this.pubClient.quit();
        log.info("quit redis pub");
    }    
}

module.exports = CameraClient;