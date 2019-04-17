'use strict';
const BaseRequest = require('./BaseRequest');
const log = require('./Logger');

class Notify extends BaseRequest {
    constructor(options) {
        super(options);
    }

    async notifyCapture(capture, camera) {
        let channels = ['capture',`capture/camera/${camera.id}`];
        if (camera.user_group_id) {
            channels.push(`capture/group/${camera.user_group_id}`);
        }
        const info = {channel: channels, captureId: capture.id};
        const res = await this.post(channels.join('|'), capture);
        return this.resultHandler(res, 'capture', info);
    }

    async notifyAlarm(alarm, camera) {
        let channels = ['alarm', `alarm/camera/${camera.id}`];
        if (camera.user_group_id) {
            channels.push(`alarm/group/${camera.user_group_id}`);
        }
        const info = {channel: channels, alarmId: alarm.id};
        const res = await this.post(channels.join('|'), alarm);
        return this.resultHandler(res, 'alarm', info);
    }
    
    async notifyCameraStatus(status, camera) {
        let channels = ['camera_status', `camera_status/${camera.id}`];
        const info = {channel: channels, status: status};
        const res = await this.post(channels.join('|'), {operation_status: status});
        return this.resultHandler(res, 'alarm', info);
    }

    resultHandler(ob, type, info) {
        const {err, res} = ob;
        if (err || res.statusCode !== 200) {
            log.error(`[notify] ${type} notify failure`, info);
        } else {
            log.debug(`[notify] ${type} notify success`, info);
        }
        return this;
    }
}

module.exports = Notify;