/**********************************************
 BatchProcess.js

 @desc - This table maintains all the log information for weightage calculation
 @authors - Puneet TIwari
 @version - 0.0.1
 **********************************************/



"use strict";

module.exports = function(sequelize, Types) {
    var Batch_Process = sequelize.define('Batch_Process', {
            start_time :{ type: Types.DATE},
            end_time :{ type: Types.DATE},
            process_status:{ type: Types.STRING},
            log_message:{ type: Types.STRING}
        },
        {
            tableName: 'Batch_Process',
            timestamps: false,
            // eslint-disable-next-line
            classMethods: { associate: function(models){ } },
        }
    );

    return Batch_Process;
};
