const DB_Connection = require('../database/db.js')

class UserModel {
    constructor(){
        this.db_connection = new DB_Connection();
    }

}

module.exports = UserModel;