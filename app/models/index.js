/*********************************************
index.js

@desc - main sequlize init file
      - creates a model for each file in the /models directory

@author - Punnet Tiwari
@version - 1.0.0
*********************************************/

"use strict";

/**********************
  Libs
**********************/

// External libs
var fs = require("fs"),
  path = require("path"),
  Sequelize = require("sequelize");

// Internal libs
var config = require('../config.js');

/**********************
  Globals
**********************/
var SQL = config.SQL;

// Sequlize instance
var sequelize = new Sequelize(SQL.database, SQL.username, SQL.password, {
  host: SQL.host, dialect: 'mysql', port: SQL.port,
  logging: false
})
var db = {};

/**********************
  Functions
**********************/

// Dynamically add all files in models directory
(function init_sequelize() {
  fs
    .readdirSync(__dirname)
    .filter(function (file) {
      return (file.indexOf(".") !== 0) && (file !== "index.js");
    })
    .forEach(function (file) {
      var model = sequelize["import"](path.join(__dirname, file));
      db[model.name] = model;
    });

  Object.keys(db).forEach(function (modelName) {
    if ("associate" in db[modelName]) {
      db[modelName].associate(db);
    }
  });

  db.sequelize = sequelize;
  module.exports = db;
})();
