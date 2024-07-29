const express = require('express');
const chalk = require("chalk");
const router = express.Router();

const fs = require("fs");
const path = require("path");

const copyFile = (src, dest) => {
    return new Promise((resolve, reject) => {
        fs.copyFile(src, dest, (err) => {
        if (err) reject(err);
        else resolve();
        });
    });
};

// Helper function to copy a directory
const copyDir = async (srcDir, destDir) => {
    // Ensure destination directory exists
    await fs.promises.mkdir(destDir, { recursive: true });

    // Read the contents of the source directory
    const items = await fs.promises.readdir(srcDir, { withFileTypes: true });

    // Copy each item to the destination directory
    await Promise.all(items.map(async (item) => {
        const srcPath = path.join(srcDir, item.name);
        const destPath = path.join(destDir, item.name);

        if (item.isDirectory()) {
            // Recursively copy subdirectories
            await copyDirectory(srcPath, destPath);
        } else {
            // Copy files
            await copyFile(srcPath, destPath);
        }
    }));
};

function checkFs(callback) {
    const testFilePath = path.join(__dirname, 'test_permission_check.tmp');

    fs.writeFile(testFilePath, 'test', (writeErr) => {
        if (writeErr) {
            callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ' No write permissions]');
        }

        fs.readFile(testFilePath, 'utf8', (readErr, data) => {
            if (readErr) {
                callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ' No read permissions]');
            }

            fs.unlink(testFilePath, (unlinkErr) => {
                if (unlinkErr) {
                    callback(false, '[' + chalk.red.bold("FAILED") + '] ---- [' + chalk.bold("REASON:") + ' No delete permissions]');
                }

                callback(true, '[' + chalk.green.bold("OK") + ']');
            });
        });
    });
}

module.exports = {
    copyFile,
    copyDir,
    checkFs
};