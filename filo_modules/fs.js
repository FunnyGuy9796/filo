const express = require('express');
const chalk = require("chalk");
const router = express.Router();

const chardet = require('chardet');
const iconv = require('iconv-lite');
const { fs, vol } = require("memfs");
const realFs = require("fs");
const path = require("path");

const snapshotFile = path.join(__dirname, "filesystem.json");

const paths = [
    "/.trash",
    "/.appData",
    "/sys",
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

router.post("/readDir", (req, res) => {
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

router.post("/readFile", (req, res) => {
    const { path } = req.body;

    if (!path) {
        return res.status(400).json({ message: "the provided input is invalid" });
    }

    const status = checkFile(path);

    if (status) {
        try {
            const buffer = fs.readFileSync(path);
            const detectEncoding = chardet.detect(buffer);
            const content = iconv.decode(buffer, detectEncoding || "utf8");

            res.status(201).json({
                message: "success",
                contents: content
            });
        } catch (error) {
            res.status(500).json({
                message: "failed to read file"
            });
        }
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

router.post("/statFile", (req, res) => {
    const { path } = req.body;

    if (!path) {
        return res.status(400).json({ message: "the provided input is invalid" });
    }

    try {
        const result = fs.statSync(path);

        res.status(201).json({
            message: "success",
            contents: result
        });
    } catch (error) {
        res.status(500).json({
            message: "failed to stat file"
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
        try {
            const snapshot = JSON.parse(realFs.readFileSync(snapshotFile, "utf8"));

            vol.fromJSON(snapshot);

            paths.forEach(path => {
                if (!checkDir(path)) {
                    fs.mkdirSync(path);
                }
            });

            callback(true, '[' + chalk.green.bold("OK") + ']');
        } catch (error) {
            callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ` ${error}]`);
        }
    } else {
        callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ' Unable to locate filesystem.json]');
    }
}

module.exports = {
    router,
    fs,
    vol,
    checkDir,
    checkFile,
    saveFs,
    checkFs
};