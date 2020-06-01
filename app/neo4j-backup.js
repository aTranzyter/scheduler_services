/*
*   neo4j-backup.js - A node script for backing up a neo4j database.
*
*   @author Robert Mckinnon rob.mckinnon@gmail.com
*/

var neo4j = require('neo4j-driver');
var fs = require('fs');
var args = require('optimist').argv;

if (args.help) {
    displayHelp();
    process.exit(0);
}

var address = 'bolt://localhost:7687';
if (args.a || args.address) {
    if (args.a) {
        address = args.a;
    } else if (args.address) {
        address = args.address;
    }

}

var username = null;
if (!args.u && !args.username) {
    console.error('USERNAME is required!');
    displayHelp();
    process.exit(1);
} else {
    if (args.u) {
       username = args.u;
    } else {
        username = args.username;
    }
}

var password = null;
if (!args.p && !args.password) {
    console.error('password is required!');
    displayHelp();
    process.exit(1);
} else {
    if (args.p) {
        password = args.p;
    } else {
        password = args.password;
    }
}

var directory = './backup';
if (args.dir) {
    directory = args.dir;
}
if (args.d) {
    directory = args.d;
}

var driver = neo4j.driver(address, neo4j.auth.basic(username, password));
var session = driver.session();

createBackupDirectory();
backupNodes();

function backupNodes() {
    session.run('MATCH (n) RETURN n')
        .subscribe({
            onNext: function (record) {
                // console.log(' record ', record.get('count'));
                saveNode(record.get('n'))
            },
            onCompleted: function () {
                console.log(' completed Neo4j *****' )
                // session.close();
                backupRelationships();
            },
            onError: function (error) {
                console.log(error, ' 74');
                process.exit(1);
            }
        });
}

function backupRelationships() {
    session.run('MATCH (s)-[r]-(t) RETURN r')
        .subscribe({
            onNext: function (record) {
                saveRelationship(record.get('r'));
            },
            onCompleted: function () {
                session.close();
                process.exit();
            },
            onError: function (error) {
                console.log(error);
                process.exit(1);
            }
        });
}

function createBackupDirectory() {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    } else {
        console.error('DIRECTORY ' + directory + ' exists please specify a directory that does not exist.')
        // process.exit(1);
    }
}

function saveRelationship(relationship) {
    var id = relationship.identity.low;
    var body = JSON.stringify(relationship)
    fs.writeFileSync(directory + '/' + id + '.r', body, 'UTF-8', function(err) {
        if (err) {
            console.log('errors: ' + err);
        }
    });
}

function saveNode(node) {
    var id = node.identity.low;
    var body = JSON.stringify(node)
    fs.writeFileSync(directory + '/' + id + '.n', body, 'UTF-8', function(err) {
        if (err) {
            console.log('errors: ' + err);
        }
    });
}

function displayHelp() {
    var msg = `
Usage: neo4j-backup.sh [options...]
    -a ADDRESS, --address ADDRESS     
                The bolt address, default is bolt://localhost:7687
    -u USERNAME, --username USERNAME
                The user (required)
    -p PASSWORD, --password PASSWORD
                The password (required)
    -d DIRECTORY, --directory DIRECTORY
                The backup directory, default is './backup'
    --help      Display this help message
    `;
    console.log(msg);
}