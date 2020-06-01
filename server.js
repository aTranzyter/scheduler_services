/**
 * Created by Akshay on 02/11/18.
 */
// server.js

// modules =================================================
var express = require('express');
var app = express();
var cron = require('node-cron');
const { spawn } = require("child_process");
var mysqldump = require('mysqldump');
var models = require('./app/models');
const config = require('./app/config');
// var zipFolder = require('zip-folder');
const compressing = require('compressing');
var rimraf = require("rimraf");
const { TIMELOGGER } = require('./app/winston.js');

// const path = require('path');
const fs = require('fs');
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');

// Set the region 
// AWS.config.update({region: 'US EAST (Ohio)'});

// Create S3 service object
var s3 = new AWS.S3({
    credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.SECRET_ACCESS_KEY_ID,
    },
    params: { Bucket: config.S3_BUCKET_NAME }
});

// Call S3 to list the buckets
// s3.listBuckets(function (err, data) {
//     if (err) {
//         console.log("Error", err);
//     } else {
//         console.log("Success", data.Buckets);
//     }
// });

// config.isProd = process.argv.includes('--production');

// set our port
var port = process.env.APP_PORT || 8082;

// Sync sequelize
const syncSequelize = function () {
    models.sequelize.sync().then(async function () {
        // start app ===============================================
        // startup our app at http://localhost:8082
        app.listen(port);
        console.log('server running on port ' + port);
        TIMELOGGER.info('server running on port ' + port);

        // start cron after database syncup
        cron.schedule(config.SCHDULE_INTERVAL, function () {
            console.log(' Scheduler ', new Date().getSeconds());
            backupMysql();
            backupNeo4j();
        });
    }).catch(function (err) {
        console.log(' SEQUEL ERR ', err);
        TIMELOGGER.log('SEQUEL ERR ', err);
        // On Error Retry after 1 sec
        setTimeout(() => {
            TIMELOGGER.info('ReSync DataBase');
            syncSequelize();
        }, 1000);
    });

}

syncSequelize();

const backupMysql = function () {
    if (!fs.existsSync(config.SQL_BACKUP_FOLDER)) {
        try {
            fs.mkdirSync(config.SQL_BACKUP_FOLDER);
        } catch (err) {
            // console.log('move_file mkdirSync err ');
            TIMELOGGER.error(`move_file mkdirSync err: ${err}`);
        }
    }
    let sqlFileName = `${config.SQL_BACKUP_FOLDER}/${config.SQL_BACKUP_FILE}_${getDate()}.sql.gz`;
    let sqlBackupFileName = `${config.BACKUP_ARCHIVE}/${config.SQL_BACKUP_FILE}_backup_${getDate()}.sql.gz`;
    console.log('sqlFileName ', sqlFileName)
    console.log('sqlBackupFileName ', sqlBackupFileName);
    
    mysqldump({
        connection: {
            host: config.SQL.host,
            user: config.SQL.username,
            password: config.SQL.password,
            database: config.SQL.database,
        },
        dumpToFile: sqlFileName,
        compressFile: true,
    }).then(() => {
        TIMELOGGER.info('Backup Successfull.. Starting Upload to s3');
        if (config.AWS_ACCESS_KEY_ID && config.SECRET_ACCESS_KEY_ID && config.S3_BUCKET_NAME) {
            uploadFile(sqlFileName, sqlBackupFileName);
        } else {
            moveToBackUp(sqlFileName, sqlBackupFileName);
        }
    })
    .catch(err => {
        console.log('******************* ', err);
    });
}

const backupNeo4j = function () {
    let data = spawn("node", ["./app/neo4j-backup.js", "-a", "bolt://" + config.NEO4J_HOST, "-u",
    config.NEO4J_USERNAME, "-p", config.NEO4J_PASSWORD, "-d", `${config.NEO4J_BACKUP_FILE}`]);

    data.stdout.on("data", data => {
        console.log(`stdout: ${data}`);
        // TIMELOGGER.info(`stdout: ${JSON.stringify(data)}`);
    });

    data.stderr.on("data", data => {
        console.log(`stderr: ${data}`);
        TIMELOGGER.error(`stderr: ${JSON.stringify(data)}`);
    });

    data.on('error', (error) => {
        console.log(`error: ${error.message}`);
        TIMELOGGER.error(`error: ${error.message}`);
        return;
    });

    data.on("close", code => {
        console.log(`child process exited with code ${code}`);
        TIMELOGGER.info(`child process exited with code ${code}`);
        zipBackupFolder();
    });
}

const zipBackupFolder = function () {
    let neo4JZip = `${config.NEO4J_BACKUP_FILE}_${getDate()}.gz`;
    let neo4JBackupZip = `${config.BACKUP_ARCHIVE}/${config.NEO4J_BACKUP_FILE.slice(2)}_backup_${getDate()}.gz`;

    compressing.tgz.compressDir(`${config.NEO4J_BACKUP_FILE}`, neo4JZip)
        .then(() => {
            console.log('Done');
            rimraf(config.NEO4J_BACKUP_FILE, function () {
                TIMELOGGER.info(`Neo4j backup Zip created and folder removed`);
                console.log("done"); 
                });
            TIMELOGGER.info(`Zipped Successfully ${config.NEO4J_BACKUP_FILE}.gz`);
            if (config.AWS_ACCESS_KEY_ID && config.SECRET_ACCESS_KEY_ID && config.S3_BUCKET_NAME) {
                uploadFile(neo4JZip, neo4JBackupZip);
            } else {
                moveToBackUp(neo4JZip, neo4JBackupZip);
            }
        })
        .catch(err => {
            console.log('err ', err);
            TIMELOGGER.error(`${JSON.stringify(err)}`);
        });
}

const uploadFile = (filePath, backupPath) => {
    let fileName;
    fileName = `${filePath.slice(2)}`;
    if (fileName.includes('/')) {
        fileName = fileName.slice(fileName.lastIndexOf('/') + 1);
    }
    TIMELOGGER.info(`Uploading ${fileName} To S3.`);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            TIMELOGGER.error(`${JSON.stringify(err)}`)
            return;
            // throw err;
        }
        const params = {
            Bucket: config.S3_BUCKET_NAME, // pass your bucket name
            Key: fileName, // file will be saved as testBucket/contacts.csv
            Body: JSON.stringify(data, null, 2)
        };
        s3.upload(params, function (s3Err, data) {
            if (s3Err) {
                TIMELOGGER.error(`${JSON.stringify(s3Err)}`);
                return;
            }
            console.log(`File uploaded successfully at ${data.Location}`);
            TIMELOGGER.info(`File uploaded successfully at ${data.Location}`);
            moveToBackUp(filePath, backupPath);
        });
    });
};

const moveToBackUp = function (oldPath, newPath) {
    if (!fs.existsSync(config.BACKUP_ARCHIVE)) {
        try {
            fs.mkdirSync(config.BACKUP_ARCHIVE);
        } catch (err) {
            // console.log('move_file mkdirSync err ');
            TIMELOGGER.error(`move_file mkdirSync err: ${err}`);
        }
    }
    var readStream = fs.createReadStream(oldPath);
    var writeStream = fs.createWriteStream(newPath);

    readStream.on('error', function (err) {
        if (err)
            TIMELOGGER.error(`File Upload read stream error: ${err.message}`)
    });
    writeStream.on('error', function (err) {

        if (err)
            TIMELOGGER.error(`File Upload write stream error: ${err.message}`)

    });

    readStream.on('close', function () {
        deleteFile(oldPath);
    });

    readStream.pipe(writeStream);
}

var getDate = function() {
    let d = new Date();
    return `${d.getDate()}_${(d.getMonth() + 1)}_${d.getFullYear()}_${d.getHours()}_${d.getMinutes()}_${d.getSeconds()}`; 
}

var deleteFile = function(filePath) {
    fs.unlink(filePath, function (err) {
        if (err)
            TIMELOGGER.error(`File Upload write stream error: ${err.message}`)

        TIMELOGGER.info(`File deleted after upload`)
    });
}

// expose app
exports = module.exports = app;
