const express = require('express');
const chalk = require("chalk");
const router = express.Router();

const { fs, vol } = require("memfs");
const realFs = require("fs");
const path = require("path");

const snapshotFile = path.join(__dirname, "filesystem.json");

const paths = [
    "/trash",
    "/appData",
    "/usr/home/Applications",
    "/usr/home/Desktop",
    "/usr/home/Documents",
    "/usr/home/Downloads",
    "/usr/home/Music",
    "/usr/home/Pictures",
    "/usr/home/Videos"
];

router.post("/createDir", (req, res) => {
    const { path } = req.body;
    const status = checkDir(path);

    if (status) {
        res.status(409).json({
            message: "dir already exists"
        });
    } else {
        fs.mkdirSync(path);

        res.status(201).json({
            message: "success"
        });
    }
});

router.get("/readDir", (req, res) => {
    const { path } = req.body;

    if (!path) {
        return res.status(400).json({ message: "the provided input is invalid" });
    }

    const status = checkDir(path);

    if (status) {
        const result = fs.readdirSync(path);

        res.status(201).json({
            message: "success",
            contents: result
        });
    } else {
        res.status(406).json({
            message: "the provided path is not a directory"
        });
    }
});

router.delete("/rmDir", (req, res) => {
    const { path } = req.body;

    if (!path) {
        return res.status(400).json({ message: "the provided input is invalid" });
    }

    const status = checkDir(path);

    if (status) {
        try {
            fs.rmdirSync(path);

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
    const { path, content, type } = req.body;

    if (!path || typeof content !== "string" || typeof type !== "string") {
        return res.status(400).json({ message: "the provided input is invalid" });
    }

    const status = checkFile(path);

    if (status) {
        res.status(409).json({
            message: "file already exists"
        });
    } else {
        try {
            fs.writeFileSync(path, content, type);

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

router.get("/readFile", (req, res) => {
    const { path } = req.body;

    if (!path) {
        return res.status(400).json({ message: "the provided input is invalid" });
    }

    const status = checkFile(path);

    if (status) {
        const result = fs.readFileSync(path);

        res.status(201).json({
            message: "success",
            contents: result
        });
    } else {
        res.status(406).json({
            message: "the provided path is not a file"
        });
    }
});

router.delete("/rmFile", (req, res) => {
    const { path } = req.body;

    if (!path) {
        return res.status(400).json({ message: "the provided input is invalid" });
    }

    const status = checkFile(path);

    if (status) {
        try {
            fs.unlinkSync(path);

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

function saveFs(callback) {
    const snapshot = vol.toJSON();
    
    realFs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));

    callback(true, "[" + chalk.green.bold("DONE") + "]");
}

function checkFs(callback) {
    if (realFs.existsSync(snapshotFile)) {
        const snapshot = JSON.parse(realFs.readFileSync(snapshotFile, "utf8"));

        vol.fromJSON(snapshot);

        const volStatus = !(Object.keys(snapshot).length === 0 || (Object.keys(snapshot).length === 1 && snapshot['/'] === null));

        if (volStatus) {
            for (const path of paths) {
                if (!checkDir(path)) {
                    fs.mkdirSync(path);
                }
            }

            callback(true, '[' + chalk.green.bold("OK") + ']');
        } else {
            callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ' Unable to create virtual filesystem]');
        }
    } else {
        callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ' Unable to locate filesystem.json]');
    }
}

module.exports = {
    router,
    fs,
    vol,
    saveFs,
    checkFs
};