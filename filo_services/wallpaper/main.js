const fs = require("fs");
const path = require("path");
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

        if (fs.existsSync(absPath)) {
            const cols = [
                { name: "path", type: "TEXT" }
            ];

            const data = [
                { path: absPath }
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
    init,
    stop,
    setWallpaper
};