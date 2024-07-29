const express = require("express");
const chalk = require("chalk");
const app = express();

const filesystem = require("./filo_modules/fs");
const network = require("./filo_modules/net");
const memory = require("./filo_modules/mem");

const fs = require("fs");
const path = require("path");
const configFile= "./config.json";
const servicesFile = "./services.json";

let fsStatus = false;
let netStatus = false;
let memStatus = false;

function waitForCondition(interval = 100) {
    return new Promise((resolve, reject) => {
        const timer = setInterval(() => {
            if (fsStatus && netStatus && memStatus) {
                clearInterval(timer);
                resolve();
            }
        }, interval);

        setTimeout(() => {
            clearInterval(timer);
            reject(new Error('Failed to access one or more system modules'));
        }, 100);
    });
}

async function stopService(serviceId) {
    const data = fs.readFileSync(configFile, "utf8");
    const configData = JSON.parse(data);

    const servicesPath = configData.services_path;
    const resolvedPath = require.resolve(path.join(servicesPath, serviceId, "main.js"));

    if (require.cache[resolvedPath]) {
        const result = await require(resolvedPath).stop();

        if (result) {
            memory.removeData("services", "id = '" + serviceId + "'");
            delete require.cache[resolvedPath];

            console.log(chalk.cyan.bold("[FILO/SERVICES]") + " -> Stopped system service | Service ID: " + serviceId);
        }
    }
}

async function startService(serviceId) {
    let rows = memory.readNode("services");
    let serviceExists = rows.some(row => row.id === serviceId);

    if (!serviceExists) {
        const data = fs.readFileSync(configFile, "utf8");
        const configData = JSON.parse(data);

        const servicesPath = configData.services_path;
        const absPath = path.join(servicesPath, serviceId, "main.js");

        if (fs.existsSync(absPath)) {
            const service = require(absPath);
            service.init();

            const cols = [
                { name: "id", type: "TEXT" }
            ];

            const data = [
                { id: serviceId }
            ];

            memory.addData("services", cols.map(col => col.name), data);

            console.log(chalk.cyan.bold("[FILO/SERVICES]") + " -> Started system service | Service ID: " + serviceId);
        }
    }
}

async function startServices() {
    try {
        const data = fs.readFileSync(servicesFile, "utf8");
        const servicesData = JSON.parse(data);

        console.log(chalk.cyan.bold("[FILO/SERVICES]") + " -> Services.. [" + chalk.green.bold("OK") + "]");

        const cols = [
            { name: "id", type: "TEXT" }
        ];

        memory.createNode("services", cols);

        servicesData.forEach((item) => {
            startService(item.id); 
        });

        app.post("/start-service/:serviceId", async (req, res) => {
            const { serviceId } = req.params;

            try {
                await startService(serviceId);
                res.status(200).send("success");
            } catch(error) {
                console.log(chalk.cyan.bold("[FILO/SERVICES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + error);
                res.status(500).send("failed");
            }
        });
    
        app.post("/stop-service/:serviceId", async (req, res) => {
            const { serviceId } = req.params;

            try {
                await stopService(serviceId);
                res.status(200).send("success");
            } catch(error) {
                console.log(chalk.cyan.bold("[FILO/SERVICES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + error);
                res.status(500).send("failed");
            }
        });
    } catch(err) {
        console.log(chalk.cyan.bold("[FILO/SERVICES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + err);

        cleanup();
        process.exit(1);
    }
}

function startApp(appId, uuid) {
    const data = fs.readFileSync(configFile, "utf8");
    const configData = JSON.parse(data);

    const appsPath = configData.apps_path;
    const absPath = path.join(appsPath, appId);

    if (fs.existsSync(absPath)) {
        const appConfigFile = path.join(absPath, "appConfig.json");
        const appData = fs.readFileSync(appConfigFile, "utf8");
        const appConfigData = JSON.parse(appData);

        const appIndexFile = appConfigData.index_file;

        const cols = [
            { name: "id", type: "TEXT" }
        ];

        const data = [
            { id: appId + uuid }
        ];

        memory.addData("applications", cols.map(col => col.name), data);

        return (req, res) => {
            const appFilePath = path.join(absPath, appIndexFile);
            const ext = path.extname(appFilePath);

            fs.access(appFilePath, fs.constants.F_OK, (err) => {
                if (err) {
                    console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Main file for app" + chalk.bold("[" + appId + "]") + " could not be found");
                    
                    res.status(404).send("app file not found");
                } else {
                    fs.readdir(absPath, (err, files) => {
                        if (err) {
                            console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Other files for app" + chalk.bold("[" + appId + "]") + " could not be found");
                    
                            res.status(404).send("unable to find app files");
                        }

                        files.forEach(file => {
                            const filePath = path.join(absPath, file);
                            const extname = path.extname(filePath);
            
                            if (extname === ".ejs") {
                                if (file == appIndexFile) {
                                    const routePath = "/" + appId;
                                    app.get(routePath, (req, res) => {
                                        res.render(path.basename(file, extname));
                                    });
                                } else {
                                    const routePath = "/" + appId + "/" + path.basename(file, extname);
                                    app.get(routePath, (req, res) => {
                                        res.render(path.basename(file, extname));
                                    });
                                }
                            }
                        });
                    });

                    if (ext === ".ejs") {
                        app.use("/" + appId, express.static(absPath));
                        app.set("views", absPath);

                        console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Started application | App: " + appId);

                        res.render(path.basename(appFilePath, ext));
                    } else {
                        console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Main file for app" + chalk.bold("[" + appId + "]") + " is invalid | Must be .ejs or .pug");
                        
                        res.sendFile(appFilePath);
                    }
                }
            });
        };
    } else {
        console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> App with ID " + chalk.bold("[" + appId + "]") + " could not be found");
        
        return res.status(404).send("app file not found");
    }
}

function startAppsProcessor() {
    const cols = [
        { name: "id", type: "TEXT" }
    ];

    memory.createNode("applications", cols);

    app.get("/app/:appId/:uuid", (req, res) => {
        const { appId, uuid } = req.params;
        
        startApp(appId, uuid)(req, res);
    });

    app.post("/stop-app/:appId/:uuid", (req, res) => {
        const { appId, uuid } = req.params;
        const appRunning = memory.readData("applications", "id = '" + appId + uuid + "'");

        memory.removeData("applications", "id = '" + appId + uuid + "'");
        console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Stopped application | App ID: " + appId + uuid);

        res.status(200).send("success");
    });

    console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Apps Processor.. [" + chalk.green.bold("OK") + "]");
}

async function boot() {
    try {
        await waitForCondition();

        try {
            const data = fs.readFileSync(configFile, "utf8");
            const configData = JSON.parse(data);

            console.log(chalk.cyan.bold("[FILO/CONFIG]") + " -> System configurations loaded successfully");

            const PORT = configData.port;

            startServices();
            startAppsProcessor();

            app.use(express.static(path.join(__dirname, 'public')));
            app.set("view engine", "ejs");

            app.use(express.json());

            app.get("/", (req, res) => {
                app.use(express.static(path.join(__dirname, 'public')));
                app.set("views", path.join(__dirname, "views"));

                res.render("desktop");
            });

            app.use("/api/mem", memory.router);

            app.get("/wallpaper", (req, res) => {
                let rows = memory.readNode("wallpaper");
                let wallpaperPath = rows.map(row => row.path);
                wallpaperPath = wallpaperPath.join(", ");

                fs.access(wallpaperPath, fs.constants.F_OK, (err) => {
                    if (err) {
                        console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("IMAGE NOT FOUND: ") + err);
                        res.status(404).send("Image not found");
                    } else {
                        res.sendFile(wallpaperPath);
                    }
                });
            });

            app.listen(PORT, () => {
                const now = new Date();
                const time = now.toLocaleString();
                const timeLen = time.length;
                const space = " ";
                const padding = Math.max((40 - timeLen) / 2, 0);

                console.log(chalk.cyan.bold("[FILO]") + " -> System booted successfully | http://localhost:" + PORT);
                console.log("");
                console.log(chalk.magenta.bold("----------------------------------------"));
                console.log(chalk.magenta.bold("           Welcome to Filo OS           "));
                console.log("");
                console.log(chalk.magenta.bold("              Current Time              "));
                console.log(chalk.magenta.bold(space.repeat(padding) + now.toLocaleString()));
                console.log(chalk.magenta.bold("----------------------------------------"));
                console.log("");
            });
        } catch(err) {
            console.log(chalk.cyan.bold("[FILO/CONFIG") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + err);

            cleanup();
            process.exit(1);
        }
    } catch (error) {
        console.log(chalk.cyan.bold("[FILO/MODULES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + error);

        cleanup();
        process.exit(1);
    }
}

function cleanup() {
    console.log(chalk.cyan.bold("[FILO]") + " -> Cleaning up before shutting down..");

    memory.db.close();
}

process.on('SIGINT', () => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO]") + " -> Terminated by user");

    cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO]") + " -> Terminated by system");

    cleanup();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("UNCAUGHT EXCEPTION: ") + err);

    cleanup();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("UNHANDLED REJECTION: ") + "Location: " + promise + " | Reason: " + reason);

    cleanup();
    process.exit(1);
});

console.log(chalk.cyan.bold("[FILO]") + " -> Booting system..");

console.log(chalk.cyan.bold("[FILO]") + " -> Checking system modules..");

filesystem.checkFs((status, message) => {
    console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> Filesystem.. " + message);

    if (status) {
        fsStatus = true;
    }
});

network.checkNet("http://www.example.com", (connected, message) => {
    console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> Network.. " + message);

    if (connected) {
        netStatus = true;
    } else {
        console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> " + chalk.red.bold("Network") + " | A network connection is required for certain components of Filo to function.");
    }
});

memory.checkMem((status, message) => {
    console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> Memory.. " + message);

    if (status) {
        memStatus = true;
    }
});

boot();