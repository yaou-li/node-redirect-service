'use strict';
const iniparser = require('iniparser');
const log = require('./logger');
const config = iniparser.parseSync('./config.ini');
const { isArray } = require('./util');
const BaseRequest = require('./BaseRequest');

class GroupApi extends BaseRequest {
    constructor(options = {}) {
        if (!config.security || !config.security.server) {
            log.error('camera-api config error, missing base url');
        }
        options.baseUrl = config.security.server;
        super(options);
    }

    async getSubjectsForEachGroup() {
        let groups = await this.getGroupList();
        for (let i in groups) {
            let res = await this.get('/subject', {
                group_id: groups[i].id,
                page: 1,
                size: 1
            });
            let subjects = JSON.parse(res.body).data;
            if (isArray(subjects) && subjects.length > 0) {
                subjects.map((subject) => {
                    if (groups[i].subject) return subject;
                    groups[i].subject = {
                        id: subject.photos[0].group_index,
                        score: groups[i].threshold + +(Math.random() * 10).toFixed(2),
                        tag: subject.photos[0].tag
                    }
                });
            }
        }
        groups = groups.filter((group) => group.subject);    //filter group if does not has any subjects
        return groups;
    }
    
    async getGroupList() {
        let res = await this.get('/group');
        return JSON.parse(res.body).data;
    }
}

module.exports = new GroupApi();