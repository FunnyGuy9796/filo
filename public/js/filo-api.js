class filo {
    static ui = class {
        static launchApp(appId) {
            if (window.parent && typeof window.parent.createWin === "function") {
                const x = 100, y = 100, width = 600, height = 400;

                if (appId == undefined) {
                    window.parent.createWin(window.customData.appId, x, y, width, height);
                } else {
                    window.parent.createWin(appId, x, y, width, height);
                }
            } else {
                console.error("launchApp(): Parent function is not available");
            }
        }

        static notify(title, body, actionText, action) {
            if (window.parent && typeof window.parent.showNotify === "function") {
                window.parent.showNotify(title, body, actionText, action);
            } else {
                console.error("notify(): Parent function is not available");
            }
        }
    }

    static mem = class {
        static async createNode(name, cols) {
            const response = await fetch("/api/mem/createNode/" + name + "/" + JSON.stringify(cols), {
                method: "POST"
            });

            const result = await response.json();

            console.log("mem.createNode(): ", result);
            return result;
        }

        static async addData(name, cols, data) {
            const response = await fetch("/api/mem/addData/" + name + "/" + JSON.stringify(cols) + "/" + JSON.stringify(data), {
                method: "PUT"
            });

            const result = await response.json();

            console.log("mem.addData(): ", result);
            return result;
        }

        static async deleteNode(name) {
            const response = await fetch("/api/mem/deleteNode/" + name, {
                method: "DELETE"
            });

            const result = await response.json();

            console.log("mem.deleteNode(): ", result);
            return result;
        }

        static async removeData(name, condition) {
            const response = await fetch("/api/mem/removeData/" + name + "/" + condition, {
                method: "PUT"
            });

            const result = await response.json();

            console.log("mem.removeData(): ", result);
            return result;
        }

        static async readNode(name) {
            const response = await fetch("/api/mem/readNode/" + name);
            const result = await response.json();

            console.log("mem.readNode(): ", result);
            return result;
        }

        static async readData(name, condition) {
            const response = await fetch("/api/mem/readData/" + name + "/" + condition);
            const result = await response.json();

            console.log("mem.readData(): ", result);
            return result;
        }
    }

    static sys = class {
        static async startService(id) {
            const response = await fetch("/start-service/" + id, {
                method: "POST"
            });

            console.log("sys.startService(): ", response);
            return response;
        }

        static async stopService(id) {
            const response = await fetch("/stop-service/" + id, {
                method: "POST"
            });

            console.log("sys.stopService(): ", response);
            return response;
        }
    }
}

window.filo = filo;