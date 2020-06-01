/**********************************************
config.js

@desc - config file for test suite
@authors - Puneet Tiwari
@version - 1.0.0
**********************************************/
//var os = require('os');

/**********************
  Globals
**********************/
var ENVIRON = "PROD";

exports.HOST_URL = process.env.API_URL;
exports.ENVIRON = ENVIRON;

// SQL specifics
exports.SQL = {
  "username": process.env.DB_USERNAME || "root",
  //"password": "process.env.SQL_PASSWORD",
  "password": process.env.DB_PASSWORD || "password",
  "database": process.env.DB_NAME || "dump_scheduler",
  "host": process.env.DB_HOST || "localhost",
  // "host":"localhost",
  // "host": "host.docker.internal", // for docker image
  "port": process.env.DB_PORT || "3306",
  "dialect": "mysql"
};

// exports.SECRET = '9211dc48153ba70a02d0df64b2550134';
exports.TOKENHEADER = 'x-access-token';
exports.LOG_FILE_PATH = process.env.LOG_FOLDER || '../dump_scheduler_log/';
exports.ERROR_FILE_PATH = process.env.ERROR_FILE_PATH || '../dump_scheduler_error_data/';

exports.SCHDULE_INTERVAL= '0 */1 * * * *';

exports.NEO4J_HOST = process.env.NEO4J_HOST || "52.37.166.152:7687/neo4j";
exports.NEO4J_USERNAME = process.env.NEO4J_USERNAME || "neo4j";
exports.NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "bloxtest";
exports.NEO4J_BACKUP_FILE = process.env.NEO4J_BACKUP_FILE || "./backup_neo4j"


exports.SQL_BACKUP_FOLDER = process.env.SQL_BACKUP_FOLDER || "./backup_sql"
exports.SQL_BACKUP_FILE = process.env.SQL_BACKUP_FILE || "dump"

exports.BACKUP_ARCHIVE = process.env.BACKUP_ARCHIVE || "./backup_archive";

exports.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "";
exports.SECRET_ACCESS_KEY_ID = process.env.SECRET_ACCESS_KEY_ID || "";
exports.S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";