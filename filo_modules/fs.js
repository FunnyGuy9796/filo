const express = require('express');
const chalk = require("chalk");
const router = express.Router();

const fs = require("fs");
const path = require("path");

const configFile = path.join(__dirname, "..", "config.json");
const data = fs.readFileSync(configFile, "utf8");
const configData = JSON.parse(data);

const filesystem = configData.fs_path;

const paths = [
    "/.appData",
    "/sys",
    "/sys/trash",
    "/sys/apps",
    "/usr",
    "/usr/home",
    "/usr/home/Desktop",
    "/usr/home/Documents",
    "/usr/home/Downloads",
    "/usr/home/Music",
    "/usr/home/Pictures",
    "/usr/home/Videos"
];

router.post("/createDir", (req, res) => {
    const { oldPath } = req.body;
    const newPath = path.join(filesystem, oldPath);
    const status = checkDir(newPath);

    if (status) {
        res.status(409).json({
            message: "dir already exists"
        });
    } else {
        fs.mkdirSync(newPath);

        res.status(201).json({
            message: "success"
        });
    }
});

router.delete("/rmDir", (req, res) => {
    const { oldPath } = req.body;
    const newPath = path.join(filesystem, oldPath);

    if (!oldPath) {
        return res.status(400).json({ message: "the provided input is invalid" });
    }

    const status = checkDir(newPath);

    if (status) {
        try {
            fs.rmdirSync(newPath);

            res.status(201).json({
                message: "success"
            });
        } catch (error) {
            res.status(500).json({
                message: "failed deleting directory"
            });
        }
    } else {
        res.status(404).json({
            message: "directory does not exist"
        });
    }
});

router.post("/createFile", (req, res) => {
    const { oldPath, content } = req.body;
    const newPath = path.join(filesystem, oldPath);

    if (!oldPath || typeof content !== "string") {
        return res.status(400).json({ message: "the provided input is invalid" });
    }

    const status = checkFile(newPath);

    if (status) {
        res.status(409).json({
            message: "file already exists"
        });
    } else {
        try {
            fs.writeFileSync(newPath, content);

            res.status(201).json({
                message: "success"
            });
        } catch (error) {
            res.status(500).json({
                message: "failed writing to file"
            });
        }
    }
});

router.delete("/rmFile", (req, res) => {
    const { oldPath } = req.body;
    const newPath = path.join(filesystem, oldPath);

    if (!oldPath) {
        return res.status(400).json({
            message: "the provided input is invalid"
        });
    }

    const status = checkFile(newPath);

    if (status) {
        try {
            fs.unlinkSync(newPath);

            res.status(201).json({
                message: "success"
            });
        } catch (error) {
            res.status(500).json({
                message: "failed deleting file"
            });
        }
    } else {
        res.status(404).json({
            message: "file does not exist"
        });
    }
});

router.post("/stat", (req, res) => {
    const { oldPath } = req.body;
    const newPath = path.join(filesystem, oldPath);

    if (!oldPath) {
        return res.status(400).json({ message: "the provided input is invalid" });
    }

    try {
        const result = fs.statSync(newPath);

        res.status(201).json({
            message: "success",
            contents: result
        });
    } catch (error) {
        res.status(500).json({
            message: "failed to stat file or directory"
        });
    }
});

function copyDir(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const items = fs.readdirSync(source);

    items.forEach(item => {
        const sourcePath = path.join(source, item);
        const destinationPath = path.join(destination, item);

        if (fs.lstatSync(sourcePath).isDirectory()) {
            copyDir(sourcePath, destinationPath);
        } else {
            fs.copyFileSync(sourcePath, destinationPath);
        }
    });
}

function resolvePath(fakePath) {
    return path.join(filesystem, fakePath);
}

function checkDir(path) {
    try {
        return fs.existsSync(path) && fs.lstatSync(path).isDirectory();
    } catch (error) {
        return false;
    }
}

function checkFile(path) {
    try {
        return fs.existsSync(path) && fs.lstatSync(path).isFile();
    } catch (error) {
        return false;
    }
}

function checkFs(callback) {
    if (fs.existsSync(filesystem)) {
        try {
            fs.readdirSync(filesystem);

            paths.forEach(currPath => {
                const newPath = path.join(filesystem, currPath);
                if (!checkDir(newPath)) {
                    fs.mkdirSync(newPath);
                }
            });

            callback(true, '[' + chalk.green.bold("OK") + ']');
        } catch (error) {
            callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ` ${error}]`);
        }
    } else {
        fs.mkdirSync(filesystem, { recursive: true });

        try {
            fs.readdirSync(filesystem);

            paths.forEach(currPath => {
                const newPath = path.join(filesystem, currPath);
                if (!checkDir(newPath)) {
                    fs.mkdirSync(newPath);
                }
            });

            callback(true, '[' + chalk.green.bold("OK") + ']');
        } catch (error) {
            callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ` ${error}]`);
        }
    }
}

module.exports = {
    router,
    fs,
    copyDir,
    resolvePath,
    checkDir,
    checkFile,
    checkFs
};