const fs = require("fs");
const path = require("path");
const express = require('express');
const router = express.Router();
const chalk = require("chalk");
const memory = require("../../filo_modules/mem");
const dataFile = path.join(__dirname, "data.json");

const configFile = path.join(__dirname, "..", "..", "config.json");
const data = fs.readFileSync(configFile, "utf8");
const configData = JSON.parse(data);

const filesystem = configData.fs_path;

function setWallpaper(filePath) {
    try {
        const data = fs.readFileSync(dataFile, "utf8");
        const wallpaperData = JSON.parse(data);

        wallpaperData.image_path = filePath;

        fs.writeFile(dataFile, JSON.stringify(wallpaperData, null, 2), "utf8", (err) => {
            if (err) {
                console.log(chalk.cyan.bold("[FILO/SERVICES/WALLPAPER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + err);
                return;
            }

            const cols = [
                { name: "path", type: "TEXT" }
            ];

            const data = [
                { path: newPath }
            ];
            
            memory.addData("wallpaper", cols.map(col => col.name), data);
        });
    } catch(err) {
        console.log(chalk.cyan.bold("[FILO/SERVICES/WALLPAPER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + err);
    }
}

function init() {
    try {
        const data = fs.readFileSync(dataFile, "utf8");
        const wallpaperData = JSON.parse(data);

        let absPath = JSON.stringify(wallpaperData.image_path);
        absPath = absPath.replace(/(^")|("$)/g, '');

        const newPath = path.join(filesystem, absPath);

        const defaultPath = path.join(filesystem, ".appData/wallpaper/default-wallpaper.jpg");

        if (fs.existsSync(newPath)) {
            const cols = [
                { name: "path", type: "TEXT" }
            ];

            const data = [
                { path: newPath }
            ];

            memory.createNode("wallpaper", cols);
            memory.addData("wallpaper", cols.map(col => col.name), data);
        } else if (fs.existsSync(defaultPath)) {
            const cols = [
                { name: "path", type: "TEXT" }
            ];

            const data = [
                { path: defaultPath}
            ];

            memory.createNode("wallpaper", cols);
            memory.addData("wallpaper", cols.map(col => col.name), data);
        }
    } catch(err) {
        console.log(chalk.cyan.bold("[FILO/SERVICES/WALLPAPER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + err);
    }
}

function stop() {
    memory.deleteNode("wallpaper");

    return true;
}

module.exports = {
    router,
    init,
    stop,
    setWallpaper
};