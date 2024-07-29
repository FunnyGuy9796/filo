const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const memory = require("../../filo_modules/mem");
const dataFile = path.join(__dirname, "data.json");

function init() {
    const cols = [
        { name: "appId", type: "TEXT" }
    ];

    memory.createNode("taskbar", cols);

    const data = fs.readFileSync(dataFile, "utf8");
    const taskbarData = JSON.parse(data);

    taskbarData.forEach((item) => {
        const memData = [
            { appId: item.id }
        ];

        memory.addData("taskbar", cols.map(col => col.name), memData);
    });
}

function stop() {
    memory.deleteNode("taskbar");

    return true;
}

module.exports = {
    init,
    stop
};