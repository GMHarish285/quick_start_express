import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import chalk from "chalk";
import { createSpinner } from "nanospinner";
import { templates } from "./configs.js";
import validate from "validate-npm-package-name";
import {
    getServicesData,
    generateDockerComposeFile,
    userPrompts,
} from "./util/docker.js";
import { initMenu } from "./util/menu.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parentDir = path.dirname(__dirname);

export async function initCommand(options) {
    const selectedTemplate = options.template || "basic"; // Default to 'basic' if no template is specified
    const packageName = options.name || "qse-server"; // Default to 'qse-server' if no name is specified
    const removeNodemon = options.removeNodemon;
    const removeDependencies = options.removeDeps;

    if (!options.template) {
        initMenu(initCommand, options);
        return;
    }

    // Docker Compose options.
    const dockerCompose = options.dockerCompose;
    const cacheService = options.cacheService;
    const skipDb = options.skipDb || false;

    if (packageName) {
        const validateResult = validate(packageName);
        if (validateResult.validForNewPackages === false) {
            const errors = validateResult.errors || validateResult.warnings;
            console.error(
                chalk.red.bold(
                    `Invalid package name: ${errors.join(
                        ", ",
                    )}. Please provide a valid package name.`,
                ),
            );
            return;
        }
    }

    if (!templates[selectedTemplate]) {
        console.error(
            chalk.red(
                `Template ${chalk.bgRed.bold(
                    selectedTemplate,
                )} does not exist. To see available templates use ${chalk.yellow(
                    '"qse list"',
                )}.`,
            ),
        );
        return;
    }

    const targetDir = process.cwd();
    const templatePath = path.join(
        parentDir,
        "templates",
        templates[selectedTemplate].name,
    );

    const isUrl = templates[selectedTemplate].isUrl;
    const needDB = templates[selectedTemplate].needDB && !skipDb;

    let dockerTemplate =
        selectedTemplate.split("_")[0] === "express" ||
        selectedTemplate.split("_")[0] === "basic"
            ? "express"
            : selectedTemplate.split("_")[0];

    const dockerTemplatePath = path.join(
        parentDir,
        "templates",
        "Docker",
        dockerTemplate,
        "Dockerfile",
    );

    const destinationPath = path.join(targetDir);
    const dockerFileDestination = path.join(destinationPath, "Dockerfile");

    let runtimeNeedDB = false;
    if (dockerCompose) {
        try {
            console.log();
            const userPrompt = await userPrompts(needDB, cacheService);
            runtimeNeedDB = userPrompt.runtimeNeedDB;

            const serviceData = await getServicesData(
                packageName,
                selectedTemplate,
                runtimeNeedDB,
                userPrompt.addCacheService,
                cacheService,
            );

            console.log("Starting server initialization...");

            const dockerSpinner = createSpinner(
                `Creating Docker Compose File with Entered Services...`,
            ).start();

            const composeFileContent = generateDockerComposeFile(
                runtimeNeedDB,
                serviceData,
                packageName,
                selectedTemplate,
            );
            const composeFilePath = path.join(targetDir, "docker-compose.yml");

            fs.writeFileSync(composeFilePath, composeFileContent);
            dockerSpinner.success({
                text: `Docker Compose file generated successfully.`,
            });
        } catch (error) {
            console.log(chalk.red("Error generating Docker Compose file"));
            console.error(error.message);
            return;
        }
    } else {
        console.log();
        console.log("Starting server initialization...");
    }

    const copySpinner = createSpinner("Creating server files...").start();
    try {
        await fs.copy(templatePath, destinationPath);
        if (dockerCompose) {
            try {
                await fs.copyFile(dockerTemplatePath, dockerFileDestination);
            } catch (error) {
                copySpinner.error({ text: "Error creating Dockerfile.\n" });
                console.error(error.message);
            }
        }

        copySpinner.success({ text: "Created server files successfully." });

        if (removeNodemon) {
            const nodemonSpinner = createSpinner("Removing nodemon...").start();
            try {
                const packageJsonPath = path.join(
                    destinationPath,
                    "package.json",
                );
                const packageJsonContent = fs.readFileSync(
                    packageJsonPath,
                    "utf8",
                );
                const packageJson = JSON.parse(packageJsonContent);

                if (
                    packageJson.devDependencies &&
                    packageJson.devDependencies.nodemon
                ) {
                    delete packageJson.devDependencies.nodemon;
                    if (!Object.keys(packageJson.devDependencies).length) {
                        delete packageJson.devDependencies;
                    }
                }
                if (packageJson.scripts && packageJson.scripts.dev) {
                    delete packageJson.scripts.dev;
                }

                fs.writeFileSync(
                    packageJsonPath,
                    JSON.stringify(packageJson, null, 2),
                );

                nodemonSpinner.success({
                    text: "Removed nodemon successfully.",
                });
            } catch (err) {
                nodemonSpinner.error({ text: "Error removing nodemon.\n" });
                console.error(err.message);
            }
        }
    } catch (err) {
        copySpinner.error({ text: "Error creating server files.\n" });
        console.error(err.message);
    }

    const addNameAndTypeSpinner = createSpinner(
        "Adding name and type declaration...",
    ).start();
    try {
        const packageJsonPath = path.join(targetDir, "package.json");
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);
        packageJson.name = packageName; // Set custom package name
        packageJson.type = "module"; // Define type as module
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

        addNameAndTypeSpinner.success({
            text: "Added name and type declaration successfully.",
        });
    } catch (err) {
        addNameAndTypeSpinner.error({
            text: "Error adding type declaration.\n",
        });
        console.error(err.message);
    }

    if (!removeDependencies) {
        const installDependencies = createSpinner(
            "Installing dependency packages...",
        ).start();
        try {
            execSync("npm i", { stdio: "ignore", cwd: targetDir });

            installDependencies.success({
                text: "Installed dependencies successfully.",
            });
        } catch (err) {
            installDependencies.error({
                text: "Error installing dependencies.\n",
            });
            console.error(err);
        }
    }

    console.log(chalk.green.bold("\nSetup complete! To run your server:"));
    if (removeDependencies) {
        console.log(
            chalk.yellow("Install dependencies: "),
            chalk.white.bold("npm i"),
        );
    }
    console.log(chalk.yellow("Run:"), chalk.white.bold("npm start"));
    if (!removeNodemon) {
        console.log(
            chalk.yellow("Run with hot reloading:"),
            chalk.white.bold("npm run dev"),
        );
    }
    if (dockerCompose) {
        console.log(
            chalk.yellow("To start your services with Docker Compose:"),
            chalk.white.bold("docker compose up -d"),
        );
    }

    if (dockerCompose && isUrl === true && runtimeNeedDB === true) {
        console.log(
            chalk.yellow("Important Note:"),
            chalk.white("Use"),
            chalk.blueBright.bold("host.docker.internal"),
            chalk.white("instead of"),
            chalk.blueBright.bold("localhost/127.0.0.1"),
            chalk.white("in your Database Connection URL in the"),
            chalk.blueBright.bold(".env"),
            chalk.white("file for Docker to work correctly."),
        );
    }
}
