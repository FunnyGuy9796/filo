const express = require('express');
const router = express.Router();
const chalk = require("chalk");

const database = require("better-sqlite3");
const db = new database(":memory:");

function createNode(name, cols) {
    const colDefs = cols.map(col => `${col.name} ${col.type}`).join(', ');
    const createTableQuery = `CREATE TABLE IF NOT EXISTS ${name} (${colDefs})`;

    db.exec(createTableQuery);
}

router.post("/createNode/:name/:cols", (req, res) => {
    const { name, cols } = req.params;

    createNode(name, cols);

    res.status(201).json({
        message: "success"
    });
});

function addData(name, cols, data) {
    const colNames = cols.join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const insertQuery = `INSERT OR REPLACE INTO ${name} (${colNames}) VALUES (${placeholders})`;
    const insertStmt = db.prepare(insertQuery);

    data.forEach(row => {
        const values = cols.map(col => row[col]);
        insertStmt.run(...values);
    });
}

router.put("/addData/:name/:cols/:data", (req, res) => {
    const { name, cols, data } = req.params;

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

function removeData(name, condition) {
    const deleteDataQuery = `DELETE FROM ${name} WHERE ${condition}`;
    const stmt = db.prepare(deleteDataQuery);
    const result = stmt.run();
}

router.put("/removeData/:name/:condition", (req, res) => {
    const { name, condition } = req.params;

    removeData(name, condition);

    res.status(201).json({
        message: "success"
    });
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

function readData(name, condition) {
    const readQuery = `SELECT * FROM ${name} WHERE ${condition}`;
    const stmt = db.prepare(readQuery);
    const rows = stmt.all();
    return rows;
}

router.get("/readData/:name/:condition", (req, res) => {
    const { name, condition } = req.params;

    const result = readData(name, condition);

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