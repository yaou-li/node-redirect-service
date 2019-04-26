'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CameraClient = require('./CameraClient');
const log = require('./Logger');
const { MOCKER_TYPE } = require('./Constants');

class CameraMocker extends CameraClient {
    constructor(options) {
        super(options);
        this.type = options.type || MOCKER_TYPE.SEND;
        this.path = options.path || './data';
        this.interval = options.interval || 1000;
        this.fps = options.fps || 2;
        this.trackInterval = options.trackInterval || 3000;
        this.tracks = {};
        this.queue = {};
        this.lastTime = 0;
        this.index = 0;
        this.mock = this.mock.bind(this);
    }

    /**
     * read data from test data files and subscribe the response topic to send notify data
     */
    async run() {
        switch (this.type) {
            case MOCKER_TYPE.CREATE:
                this.createPath();
                super.run();
                break;
            case MOCKER_TYPE.SEND:
                await this.readFiles(this.path);
                this.lastTime = +new Date();
                this.mock();
                break;
        }
    }

    onMessage(data) {
        try {
            data = JSON.parse(data);
            data.server_time = new Date;
            this.create(data);
        } catch (e) {
            log.error('[worker.websocket.message.exception]', log.formatCamera(this.camera), e);
        }
    }

    createPath() {
        if (!fs.existsSync(this.path)) {
            fs.mkdirSync(this.path);
        }
        return this;
    }

    async create (data) {
        const filename = `${data.uuid}_${data.track}_${this.camera.id}.json`;
        const abs = path.resolve(this.path, filename)
        if (['gone','recognize'].indexOf(data.type) > -1) {
            fs.appendFileSync(abs, JSON.stringify(data));
            fs.appendFileSync(abs, '\n');
            log.info(`[${+new Date()}] mock data write to ${abs}`);
        }
    }

    /**
     * clear the folder
     */
    clear() {

    }

    /**
     * start reading & sending data from cache to redis
     */
    mock() {
        if (Object.keys(this.queue).length < this.fps) {
            console.log('enqueueing', Object.keys(this.queue).length);
            this.enqueue();
        }
        let randomInterval = parseInt(Math.random() * this.interval);
        setTimeout(this.mock, randomInterval);
    }

    /**
     * pick a track and send the first piece of data 
     * set up interval to finish the rest
     * @param {int} time 
     */
    enqueue() {
        try {
            // avgPerInterval : track per interval, interval can be more than 1s, but fps is track per second
            // time diff between curr time and last enqueue time
            // num of track should be enqueue at this interval
            let startTime = +new Date();
            let avgPerInterval = (this.interval * this.fps) / 1000;
            let timeDiff = startTime - this.lastTime;
            let num = !timeDiff ? 1 : parseInt((timeDiff / this.interval) * avgPerInterval);
            num = Math.min(num, this.fps - Object.keys(this.queue).length);
            if (num > 0) {
                this.lastTime = startTime;
            }
            this.send(num)
            return this;
        } catch (e) {
            console.log(e.message);
        }
        
    }

    /**
     * clear the time interval after track gone is sent
     * @param {string} trackId 
     */
    unqueue(trackId) {
        clearInterval(this.queue[trackId].timeInterval);
        delete this.queue[trackId];
        console.log('unqueue', Object.keys(this.queue).length, trackId);
    }

    send(num) {
        while(num > 0) {
            const trackId = this.pickOneTrack();
            if (this.queue.hasOwnProperty(trackId)) {
                continue;
            }
            this.queue[trackId] = {
                next: 0,
            };
            this.sendOne(trackId);    
            
            num--;
        }
    }

    /**
     * send track data and update the next status
     * @param {string} trackId 
     */
    sendOne(trackId) {
        let next = this.queue[trackId].next || 0;
        let data = this.updateCaptureTime(this.tracks[trackId]);
        super.onMessage(JSON.stringify(data[next]));
        this.queue[trackId].next = next + 1;
        //unqueue if already the last one.
        if (next === this.tracks[trackId].length - 1) {
            this.unqueue(trackId);
        } else {
            setTimeout(() => {
                this.sendOne(trackId);
            }, this.trackInterval);
        }
        return this;
    }

    /**
     * pick track in sequence and reassure uuid is unique
     */
    pickOneTrack() {
        const trackIds = Object.keys(this.tracks);
        this.index = this.index >= trackIds.length ? 0 : this.index;
        const trackId = trackIds[this.index];
        const utime = +new Date();
        //update track uuid so the portface will not ignore it
        this.tracks[trackId].map((data) => {
            data.uuid = data.uuid + utime;
        });
        this.index++;
        return trackId;
    }

    updateCaptureTime(data) {
        if (data.timestamp) {
            data.timestamp = +new Date;
        }
        return data;
    }

    /**
     * read test data from dir given
     * @param {object} dir 
     */
    readFiles(dir) {
        let files = fs.readdirSync(dir);
        let promises = [];
        files.map((file) => {
            const abs = path.resolve(dir,file);    
            const fp = new Promise((resolve) => {
                const rl = readline.createInterface({
                    input: fs.createReadStream(abs),
                    crlfDelay: Infinity
                });

                rl.on('line', (line) => {
                    let data = JSON.parse(line);
                    this.tracks[data.uuid] = !this.tracks[data.uuid] ? [] : this.tracks[data.uuid];
                    this.tracks[data.uuid].push(data);
                });

                rl.on('close', () => {
                    log.info(`[${+new Date()}] mock data read from ${abs}`);
                    resolve();
                });
            });
            promises.push(fp);
        });
        return Promise.all(promises).then(() => {
            return true;
        });
    }
    
}

module.exports = CameraMocker;