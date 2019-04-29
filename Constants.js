module.exports =  {
    CAMERA_STATUS: {
        INIT: 0,
        WORKING: 1,
        ERROR: 2,
        FREE: 3,
        CAPTURE_ERROR: 4
    },
    CAMERA_TYPE: {
        NORMAL: 0,
        HK: 1,
        DH: 2,
        WSSERVER: 10,
        FTPSERVER: 11,
    },
    ALARM_TYPE: {
        RECOGNIZE: 0,
        PASS: 1,
        MINORITY: 2
    },
    LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },
    MOCKER_TYPE: {
        CREATE: 1,
        SEND: 2
    },
    TRACK_TYPE: {
        GONE: 'gone',
        RECOG: 'recognize'
    }
}
