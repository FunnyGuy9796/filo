const express = require('express');
const router = express.Router();
const chalk = require("chalk");

const database = require("better-sqlite3");
const db = new database(":memory:");

function createNode(name, cols) {
    const colDefs = cols.map(col => {
        let colDef = `${col.name} ${col.type}`;
        if (col.primary) {
            colDef += " PRIMARY KEY";
        }
        return colDef;
    }).join(', ');

    const createTableQuery = `CREATE TABLE IF NOT EXISTS ${name} (${colDefs})`;
    db.exec(createTableQuery);
}

router.post("/createNode/:name", (req, res) => {
    const { name } = req.params;
    const { cols } = req.body;

    createNode(name, cols);

    res.status(201).json({
        message: "success"
    });
});

function addData(name, cols, data) {
    if (data.length === 0) return;

    const colNames = cols.join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const insertQuery = `INSERT INTO ${name} (${colNames}) VALUES (${placeholders})`;
    const insertStmt = db.prepare(insertQuery);

    data.forEach(row => {
        const values = cols.map(col => (row[col] !== undefined ? row[col] : null));

        try {
            insertStmt.run(...values);
        } catch(error) {
            console.log(chalk.cyan.bold("[FILO/MEMORY") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("ERROR ADDING DATA: ") + error);
        }
    });
}

router.put("/addData/:name", (req, res) => {
    const { name } = req.params;
    const { cols, data } = req.body;

    addData(name, cols, data);

    res.status(201).json({
        message: "success"
    });
});

function deleteNode(name) {
    const deleteTableQuery = `DROP TABLE IF EXISTS ${name}`;

    db.exec(deleteTableQuery);
}

router.delete("/deleteNode/:name", (req, res) => {
    const { name } = req.params;

    deleteNode(name);

    res.status(201).json({
        message: "success"
    });
});

function removeData(name, column, value) {
    const deleteDataQuery = `DELETE FROM ${name} WHERE ${column} = ?`;
    const stmt = db.prepare(deleteDataQuery);

    try {
        const result = stmt.run(value);
        return true;
    } catch(error) {
        console.log(chalk.cyan.bold("[FILO/MEMORY") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("ERROR REMOVING DATA: ") + error);
        return false;
    }
}

router.put("/removeData/:name/:condition", (req, res) => {
    const { name, condition } = req.params;

    let status = removeData(name, condition);

    if (status == true) {
        res.status(201).json({
            message: "success"
        });
    } else {
        res.status(201).json({
            message: "error"
        });
    }
});

function readNode(name) {
    const readQuery = `SELECT * FROM ${name}`;
    const stmt = db.prepare(readQuery);
    const rows = stmt.all();

    return rows;
}

router.get("/readNode/:name", (req, res) => {
    const { name } = req.params;

    const result = readNode(name);

    res.status(201).json({
        message: "success",
        node: result
    });
});

function readData(name, column, value) {
    const readQuery = `SELECT * FROM ${name} WHERE ${column} = ?`;
    const stmt = db.prepare(readQuery);
    
    try {
        const result = stmt.all(value);
        return result;
    } catch(error) {
        console.log(chalk.cyan.bold("[FILO/MEMORY") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("ERROR READING DATA: ") + error);
        return [];
    }
}

router.get("/readData/:name/:column/:value", (req, res) => {
    const { name, column, value } = req.params;

    const decodedValue = decodeURIComponent(value);

    const result = readData(name, column, decodedValue);

    res.status(201).json({
        message: "success",
        data: result
    });
});

function checkMem(callback) {
    const columns = [
        { name: "key", type: "TEXT" }
    ];

    const testData = [
        { key: "Test value" },
        { key: "Second test value" }
    ];

    createNode("test", columns);

    addData("test", columns.map(col => col.name), testData);

    let rows = readNode("test");

    if (rows.length > 0) {
        callback(true, '[' + chalk.green.bold("OK") + ']');

        deleteNode("test");
    } else {
        callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ' Unable to manipulate system memory]');

        deleteNode("test");
    }
}

module.exports = {
    router,
    db,
    createNode,
    addData,
    deleteNode,
    removeData,
    readNode,
    readData,
    checkMem
};