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
const ERROR = 'error';
const SUCCESS = 'success';
var startTime = new Date();
// const path = require('path');
const fs = require('fs');
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
const Importer = require('./app/mysql-import');
var RESPONSE;

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
function getFileListFromS3(cb) {
    s3.listObjects(function (err, data) {
        if (err) {
            console.log("Error ", err);
        } else {
            // console.log("data ", data);
            filterData(data.Contents, cb);
        }
    });
}

function filterData(data, cb) {
    let sql_array = [];
    let neo4j_array = [];

    if (data && data.length) {
        data.forEach(item => {
            if (item.Key.indexOf('cypher') > 0) {
                neo4j_array.push(item);
            } else if (item.Key.indexOf('sql') > 0) {
                sql_array.push(item);
            }
        });
        neo4j_array.sort((a, b) => {
            return a.LastModified < b.LastModified ? 1 : (a.LastModified > b.LastModified ? -1 : 0);
        });
        sql_array.sort((a, b) => {
            return a.LastModified < b.LastModified ? 1 : (a.LastModified > b.LastModified ? -1 : 0);
        });

        // console.log('neo4j_array ', neo4j_array[0], ' sql_array ', sql_array[0]);
        cb({ neo4j: neo4j_array[0], mysql: sql_array[0] });
    }
}

function downloadFileFromS3(data, cb) {
    if (!fs.existsSync(config.RESTORE_FOLDER)) {
        try {
            fs.mkdirSync(config.RESTORE_FOLDER);
        } catch (err) {
            // console.log('move_file mkdirSync err ');
            TIMELOGGER.error(`move_file mkdirSync err: ${err}`);
            cb({ error: err });
            batch_process_log(err, startTime, ERROR);
            // return resolve({ error: err });
        }
    }
    let file = fs.createWriteStream(`${config.RESTORE_FOLDER}/${data.Key}`);
    TIMELOGGER.info('Get File From S3');
    s3.getObject({ Key: data.Key }).createReadStream()
        .on('end', () => {
            return cb({ "message": "Written SuccessFully" });
        })
        .on('error', (error) => {
            TIMELOGGER.error('S3 File Download Error: ' + JSON.stringify(error));
            return cb({ error: error });
        }).pipe(file)
    // });
}
// config.isProd = process.argv.includes('--production');

// set our port
var port = process.env.APP_PORT || 8082;


app.get('/backup', async function (req, response) {
    RESPONSE = response;
    startTime = new Date();
    Promise.all([backupMysql(), backupNeo4j_APOC()]).then((res) => {
        let result = {};
        // console.log('res res res resres res ************************ ', res);
        res.forEach((item, index) => {
            let dbName = index == 0 ? 'SQL' : 'NEO4J';
            if (item && item['error']) {
                result[dbName] = {
                    message: item['error'].message,
                    code: item['error'].code,
                    statusCode: 500
                };
            } else {
                result[dbName] = {
                    ...item,
                    statusCode: 200
                }

            }
        });
        RESPONSE.status(200).send(result);
    });
    // backupNeo4j();
});

app.get('/restore', async function (req, response) {
    RESPONSE = response;
    startTime = new Date();
    getFileListFromS3(function (data) {
        if (!data) {
            return response.status(500).send();
        }
        Promise.all([RestoreMysql(data.mysql), RestoreNeo4j(data.neo4j)]).then((res) => {
            let result = {};
            res.forEach((item, index) => {
                let dbName = index == 0 ? 'SQL' : 'NEO4J';
                if (item['error']) {
                    result[dbName] = {
                        message: item['error'].message,
                        code: item['error'].code,
                        statusCode: 500
                    };
                } else {
                    result[dbName] = {
                        ...item,
                        statusCode: 200
                    }

                }
            });
            RESPONSE.status(200).send(result);
        })
    })
});

app.get('/restore/neo4j', function(req, response) {
    RESPONSE = response;
    startTime = new Date();
    getFileListFromS3(function (data) {
        if (!data) {
            return response.status(500).send();
        }
        Promise.all([RestoreNeo4j(data.neo4j)]).then((res) => {
            let result = {};
            res.forEach((item, index) => {
                let dbName = index == 0 ? 'SQL' : 'NEO4J';
                if (item['error']) {
                    result[dbName] = {
                        message: item['error'].message,
                        code: item['error'].code,
                        statusCode: 500
                    };
                } else {
                    result[dbName] = {
                        ...item,
                        statusCode: 200
                    }

                }
            });
            RESPONSE.status(200).send(result);
        })
    })
});


app.get('/restore/mysql', function(req, response) {
    RESPONSE = response;
    startTime = new Date();
    getFileListFromS3(function (data) {
        if (!data) {
            return response.status(500).send();
        }
        Promise.all([RestoreMysql(data.mysql)]).then((res) => {
            let result = {};
            res.forEach((item, index) => {
                let dbName = index == 0 ? 'SQL' : 'NEO4J';
                if (item['error']) {
                    result[dbName] = {
                        message: item['error'].message,
                        code: item['error'].code,
                        statusCode: 500
                    };
                } else {
                    result[dbName] = {
                        ...item,
                        statusCode: 200
                    }

                }
            });
            RESPONSE.status(200).send(result);
        })
    })
})

function RestoreMysql(data) {
    // eslint-disable-next-line
    return new Promise((resolve, reject) => {
        console.log('sql data ', data);
        // DOWNLOAD FILE FROM S3 BUCKET
        downloadFileFromS3(data, function (fileData) {
            if (fileData['error']) {
                return resolve(fileData);
            } else {
                let importer = new Importer({
                    host: config.SQL.host,
                    user: config.SQL.username,
                    password: config.SQL.password,
                    database: config.SQL.database});
                
                console.log(' importer ', importer);
                importer.import(`${config.RESTORE_FOLDER}/${data.Key}`).then(() => {
                    var files_imported = importer.getImported();
                    console.log(`${files_imported.length} SQL file(s) imported.`);
                    resolve({"message": "Imported Sql SuccessFully"});
                }).catch(err => {
                    console.error(err);
                    resolve({error: err});
                });
            }
        })
    });
}

function RestoreNeo4j(data) {
    // eslint-disable-next-line
    return new Promise((resolve, reject) => {
        // console.log('data neo4j ', data);        // DOWNLOAD FILE FROM S3 BUCKET
        downloadFileFromS3(data, function (fileData) {
            if (fileData['error']) {
                TIMELOGGER.error('S3 File Download Error, FILE: ' + data.Key);
                return resolve(fileData);
            } else {
                TIMELOGGER.info('Latest File Downloaded Successfully, FILE: '+ data.Key);
                const apocJs = require('./app/neo4j-apoc');
                apocJs.upload_APOC_backup(`${config.RESTORE_FOLDER}/${data.Key}`, function (args) {
                    console.log('upload_APOC_backup args ', args);
                    TIMELOGGER.info('Restored SuccessFully !');
                    return resolve(args);
                });
            }
        })
    });
}
// Sync sequelize
const syncSequelize = function () {
    models.sequelize.sync({force: true}).then(async function () {
        // start app ===============================================
        // startup our app at http://localhost:8082
        app.listen(port);
        console.log('server running on port ' + port);
        TIMELOGGER.info('server running on port ' + port);
        setTimeout(() => {
            // start cron after database syncup
            cron.schedule(config.SCHDULE_INTERVAL, function () {
                console.log(' Scheduler ', new Date().getSeconds());
                startTime = new Date();
                backupMysql();
                // backupNeo4j();
                backupNeo4j_APOC();
            });
        }, (1000 * 60 * 2));
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
    // eslint-disable-next-line
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(config.SQL_BACKUP_FOLDER)) {
            try {
                fs.mkdirSync(config.SQL_BACKUP_FOLDER);
            } catch (err) {
                // console.log('move_file mkdirSync err ');
                TIMELOGGER.error(`move_file mkdirSync err: ${err}`);
                batch_process_log(err, startTime, ERROR);
                return resolve({ error: err });
            }
        }
        let sqlFileName = `${config.SQL_BACKUP_FOLDER}/${config.SQL_BACKUP_FILE}_${getDate()}.sql`;
        let sqlBackupFileName = `${config.BACKUP_ARCHIVE}/${config.SQL_BACKUP_FILE}_backup_${getDate()}.sql`;
        // console.log('sqlFileName ', sqlFileName)
        // console.log('sqlBackupFileName ', sqlBackupFileName);

        mysqldump({
            connection: {
                host: config.SQL.host,
                user: config.SQL.username,
                password: config.SQL.password,
                database: config.SQL.database,
            },
            dumpToFile: sqlFileName,
            // compressFile: true,
        }).then(async () => {
            TIMELOGGER.info('Backup Successfull.. Starting Upload to s3');
            let result;
            if (config.AWS_ACCESS_KEY_ID && config.SECRET_ACCESS_KEY_ID && config.S3_BUCKET_NAME) {
                result = await uploadFile(sqlFileName, sqlBackupFileName);
            } else {
                moveToBackUp(sqlFileName, sqlBackupFileName);
            }
            return resolve(result);
        })
            .catch(err => {
                // console.log('******************* ', err);
                batch_process_log(err, startTime, ERROR);
                return resolve({ error: err });
            });
    })
}

const backupNeo4j_APOC = function () {
    // eslint-disable-next-line
   return new Promise((resolve, reject) => {
        const apocJs = require('./app/neo4j-apoc');
        apocJs.create_APOC_backup(async function (args) {
            // console.log("args backupNeo4j_APOC ", args);
            TIMELOGGER.info('Backup File Created');
            let neo_original = `./neo4j/all.cypher`;
            let neo_rename = `./neo4j/${getDate()}_${config.NEO4J_BACKUP_FILE}.cypher`;
            let neo_backup = `${config.BACKUP_ARCHIVE}/backup_${getDate()}_${config.NEO4J_BACKUP_FILE}.cypher`;
            // eslint-disable-next-line
            fs.copyFile(neo_original, neo_rename, async function (err, data) {
                if (err) {
                    console.log('copy file error');
                    resolve({error: err});
                    return;
                }
                if (args == "SUCCESS") {
                    let result;
                    if (config.AWS_ACCESS_KEY_ID && config.SECRET_ACCESS_KEY_ID && config.S3_BUCKET_NAME) {
                        result = await uploadFile(neo_rename, neo_backup);
                        // console.log(" backupNeo4j_APOC ", result);
                        TIMELOGGER.info('Backup File uploaded to '+ result.success);
                        return resolve(result);
                    } else {
                        moveToBackUp(neo_rename, neo_backup);
                        TIMELOGGER.info('AWS Configuration error');
                        return resolve({error: 'AWS Configuration error'});
                    }
                }
            });
        });
    })

}

//eslint-disable-next-line
const backupNeo4j = function () {
    // eslint-disable-next-line
    return new Promise((resolve, reject) => {
        let data = spawn("node", ["./app/neo4j-backup.js", "-a", "bolt://" + config.NEO4J_HOST, "-u",
            config.NEO4J_USERNAME, "-p", config.NEO4J_PASSWORD, "-d", `${config.NEO4J_BACKUP_FILE}`]);

        data.stdout.on("data", data => {
            console.log(`stdout: ${data}`);
            // TIMELOGGER.info(`stdout: ${JSON.stringify(data)}`);
        });

        data.stderr.on("data", data => {
            console.log(`stderr: ${data}`);
            TIMELOGGER.error(`stderr: ${JSON.stringify(data)}`);
            batch_process_log(data, startTime, ERROR);
        });

        data.on('error', (error) => {
            console.log(`error: ${error.message}`);
            TIMELOGGER.error(`error: ${error.message}`);
            batch_process_log(error, startTime, ERROR);
            return;
        });

        data.on("close", code => {
            console.log(`child process exited with code ${code} Zipping Backedup folder`);
            TIMELOGGER.info(`child process exited with code ${code} Zipping Backedup folder`);
            zipBackupFolder(function (result) {
                console.log(result);
                resolve(result);
            });
        });
    })
}

const zipBackupFolder = function (cb) {
    let neo4JZip = `${config.NEO4J_BACKUP_FILE}_${getDate()}.gz`;
    let neo4JBackupZip = `${config.BACKUP_ARCHIVE}/${config.NEO4J_BACKUP_FILE.slice(2)}_backup_${getDate()}.gz`;

    compressing.tgz.compressDir(`${config.NEO4J_BACKUP_FILE}`, neo4JZip)
        .then(async () => {
            console.log('File Compress Done Succefully');
            rimraf(config.NEO4J_BACKUP_FILE, function () {
                TIMELOGGER.info(`Neo4j backup Zip created and folder removed`);
                console.log("Neo4j backup Zip created and folder removed");
            });
            TIMELOGGER.info(`Zipped Successfully ${config.NEO4J_BACKUP_FILE}.gz`);
            if (config.AWS_ACCESS_KEY_ID && config.SECRET_ACCESS_KEY_ID && config.S3_BUCKET_NAME) {
                let result = await uploadFile(neo4JZip, neo4JBackupZip);
                console.log('result ', result);
                cb(result)
            } else {
                moveToBackUp(neo4JZip, neo4JBackupZip);
            }
        })
        .catch(err => {
            console.log('err ', err);
            TIMELOGGER.error(`${JSON.stringify(err)}`);
            batch_process_log(err, startTime, ERROR);
            cb({ error: err });
        });
}

function uploadFile(filePath, backupPath) {
    // eslint-disable-next-line
    return new Promise((resolve, reject) => {
        let fileName;
        fileName = `${filePath.slice(2)}`;
        if (fileName.includes('/')) {
            fileName = fileName.slice(fileName.lastIndexOf('/') + 1);
        }
        TIMELOGGER.info(`Uploading ${fileName} To S3.`);
        // fs.readFile(filePath, (err, data) => {
        // if (err) {
        //     TIMELOGGER.error(`${JSON.stringify(err)}`);
        //     batch_process_log(err, startTime, ERROR);
        //     return resolve({ error: err });
        //     // throw err;
        // }
        console.log(' filePath *** ', filePath);
        let fileContent = fs.readFileSync(filePath);
        const params = {
            Bucket: config.S3_BUCKET_NAME, // pass your bucket name
            Key: fileName, // file will be saved as testBucket/contacts.csv
            Body: fileContent
        };
        s3.upload(params, function (s3Err, data) {
            if (s3Err) {
                TIMELOGGER.error(`${JSON.stringify(s3Err)}`);
                batch_process_log(s3Err, startTime, ERROR);
                moveToBackUp(filePath, backupPath);
                return resolve({ error: s3Err });
            }
            console.log(`File uploaded successfully at ${data.Location}`);
            TIMELOGGER.info(`File uploaded successfully at ${data.Location}`);
            moveToBackUp(filePath, backupPath);
            return resolve({ success: `File uploaded successfully at ${data.Location}` });
        });
        // });
    });
}

const moveToBackUp = function (oldPath, newPath) {
    let dataBase = oldPath.includes('.sql') ? 'SQL' : 'NEO4J';
    if (!fs.existsSync(config.BACKUP_ARCHIVE)) {
        try {
            fs.mkdirSync(config.BACKUP_ARCHIVE);
        } catch (err) {
            // console.log('move_file mkdirSync err ');
            TIMELOGGER.error(`move_file mkdirSync err: ${err}`);
            batch_process_log(err, startTime, ERROR);
        }
    }
    var readStream = fs.createReadStream(oldPath);
    var writeStream = fs.createWriteStream(newPath);

    readStream.on('error', function (err) {
        if (err) {
            TIMELOGGER.error(`File Upload read stream error: ${err.message}`);
            batch_process_log(err, startTime, ERROR);
        }
    });
    writeStream.on('error', function (err) {

        if (err) {
            TIMELOGGER.error(`File Upload write stream error: ${err.message}`);
            batch_process_log(err, startTime, ERROR);
        }

    });

    readStream.on('close', function () {
        console.log(`File Archived for ${dataBase} database.`);
        TIMELOGGER.info(`File Archived for ${dataBase} database.`);
        deleteFile(oldPath);
    });

    readStream.pipe(writeStream);
}


var getDate = function () {
    let d = new Date();
    return `${d.getDate()}_${(d.getMonth() + 1)}_${d.getFullYear()}_${d.getHours()}_${d.getMinutes()}_${d.getSeconds()}`;
}

var deleteFile = function (filePath) {
    let dataBase = filePath.includes('.sql') ? 'SQL' : 'NEO4J';
    fs.unlink(filePath, function (err) {
        if (err) {
            TIMELOGGER.error(`File Upload write stream error: ${err.message}`);
            batch_process_log(err, startTime, ERROR);
        }

        TIMELOGGER.info(`File deleted after upload`);
        batch_process_log(`File deleted after upload for ${dataBase}`, startTime, SUCCESS);
    });
}

function batch_process_log(error, startTime, statusMessage) {
    var message = null;
    if (statusMessage === ERROR) {
        message = error.message;
    } else {
        message = error;
    }
    models.Batch_Process.create({
        start_time: startTime,
        end_time: models.sequelize.literal('NOW()'),
        process_status: statusMessage,
        log_message: message
    })
        .then(function () {
            TIMELOGGER.info(`batch_process_log done successfully STATUS: ${statusMessage} MESSAGE: ${message}`);
        })
        .catch(function (err) {
            TIMELOGGER.error(`batch_process_log err: ${err}`);
        });
}

// expose app
exports = module.exports = app;
