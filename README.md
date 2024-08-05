# Filo
Filo is a new web-based operating system that aims to be both user-friendly and lightweight.
## Goal
Filo was created with the goal of being a possible choice for a daily driver. The design is centered around portability and usability in order to provide a system suited for almost every use-case.
## Possible Use-Cases
- Running on a remote server or local machine and being used through a web browser
- Running on a remote server or local machine and being used through a custom Debian-based Linux distro in a web-wrapper
  - Essentially the main desktop environment for the system
## Installation Instructions
1. Clone this repository
     ```
     git clone https://github.com/FunnyGuy9796/filo.git
     cd filo
     ```
2. Configure the system by editing config.json
   - `port`: Defines which port Filo will run on
   - `services_path`: Defines where Filo services will be located on the host system
   - `apps_path`: Defines where Filo applications will be located on the host system
   - `network_required`: Defines whether a network connection is required to run Filo
3. Navigate to the cloned directory and enter the following commands
     ```
     npm install
     npm start
     ```
4. Once the system has booted navigate to the URL printed to the terminal
## API Documentation
Including the Filo API in your project is as simple as include a script tag in your .ejs file.
#### `<script src="/js/filo-api.js"></script>`
### UI
#### filo.ui.launchApp()
Allows you to dynamically launch another app from within your app.
##### Syntax
```
filo.ui.launchApp()
filo.ui.launchApp(appId)
filo.ui.launchApp(appId, args)
filo.ui.launchApp(args)
```
