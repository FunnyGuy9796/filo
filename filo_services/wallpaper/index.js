const fs = require("fs");
const path = require("path");
const express = require('express');
const router = express.Router();
const chalk = require("chalk");
const memory = require("../../filo_modules/mem");
const dataFile = path.join(__dirname, "data.json");

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

            fs.access(iconFilePath, fs.constants.F_OK, (err) => {
                if (err) {
                    console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Icon file for app" + chalk.bold("[" + appId + "]") + " could not be found");
                    
                    res.status(404).send("icon file not found");
                } else {
                    res.sendFile(iconFilePath);
                }
            });

            const cols = [
                { name: "path", type: "TEXT" }
            ];

            const data = [
                { path: filePath }
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

        let defaultPath = JSON.stringify(path.join(__dirname, "default-wallpaper.jpg"));
        defaultPath = defaultPath.replace(/(^")|("$)/g, '');

        if (fs.existsSync(absPath)) {
            const cols = [
                { name: "path", type: "TEXT" }
            ];

            const data = [
                { path: absPath }
            ];

            memory.createNode("wallpaper", cols);
            memory.addData("wallpaper", cols.map(col => col.name), data);
        } else {
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