var neo4j = require('neo4j-driver');
var fs = require('fs');
const config = require('../app/config');

var address = 'bolt://' + config.NEO4J_HOST;
var username = config.NEO4J_USERNAME;
var password = config.NEO4J_PASSWORD;

var driver = neo4j.driver(address, neo4j.auth.basic(username, password));
// var session = driver.session();


function create_APOC_backup(cb) {
    let session_new = driver.session();
    session_new.run(`CALL apoc.export.cypher.all("all.cypher", {
        format: "cypher-shell",
        useOptimizations: {type: "UNWIND_BATCH", unwindBatchSize: 20}
    })
    YIELD file, batches, source, format, nodes, relationships, properties, time, rows, batchSize
    RETURN file, batches, source, format, nodes, relationships, properties, time, rows, batchSize;`)
        // session.run(`CALL apoc.export.json.all("all.json",{useTypes:true})`)
        // session.run('MATCH (n) RETURN n')
        .subscribe({
            onNext: function () {
                // console.log('NEXT ', record.get('n'));
            },
            onCompleted: function () {
                console.log('completed ');
                session_new.close();
               return cb("SUCCESS");
            },
            onError: function (err) {
                console.log('err APOC CALL ** *** ** ', err);
                session_new.close();
                return cb({error: err})
            }
        })
}

function upload_APOC_backup(filePath, cb) {
    let fileText;
    // filePath = neo4j/all.cypher
    fs.readFile(filePath,
        { encoding: 'utf8', flag: 'r' },
        function (err, data) {
            if (err) {
                console.log(err);
                return cb({error: err});
            }
            else {
                fileText = data;
                // session.run(fileText)
                let session_new = driver.session();
                session_new.run(`CALL apoc.cypher.runMany('${fileText}',{})`)
                    .subscribe({
                        onNext: function () { },
                        onCompleted: function () {
                            console.log(' completed Neo4j ***** upload_APOC_backup')
                            session_new.close();
                          return cb({message: 'BackUp Restored Successfully'});
                        },
                        onError: function (error) {
                            console.log(error, ' upload_APOC_backup 74');
                            cb({error: {message: error.code}});
                            session_new.close();
                            // process.exit(1);
                        }
                    });
            }
        });

}

module.exports = { create_APOC_backup, upload_APOC_backup };